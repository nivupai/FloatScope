// @vitest-environment node
/// <reference types="node" />
import { strictEqual, deepStrictEqual } from 'node:assert'
import { describe, expect, it } from 'vitest'
import {
  addFP16,
  calculateFP16,
  subtractFP16,
} from '../lib/numerics/fp16Arithmetic'
import type {
  ArithmeticStage,
  FP16ArithmeticResult,
  FP16Operation,
} from '../lib/numerics/fp16Arithmetic'
import { decodeFP16 } from '../lib/numerics'
import { referenceFP16Arithmetic } from './reference/fp16ArithmeticReference'
import { referenceEncodeFP16 } from './reference/fp16Reference'
import { ARITHMETIC_EXAMPLES } from '../lib/arithmetic/examples'
import { formatExactDyadic } from '../lib/arithmetic/presentation'

const clear = {
  invalid: false,
  overflow: false,
  underflow: false,
  inexact: false,
}
function stage<K extends ArithmeticStage['kind']>(
  result: FP16ArithmeticResult,
  kind: K,
) {
  const found = result.trace.find(
    (item): item is Extract<ArithmeticStage, { kind: K }> => item.kind === kind,
  )
  if (!found) throw new Error(`Missing ${kind}`)
  return found
}

const directed: [number, number, FP16Operation, number][] = [
  [0x3c00, 0x3800, 'add', 0x3e00],
  [0x3c00, 1, 'add', 0x3c00],
  [0x3c00, 0x1000, 'add', 0x3c00],
  [0x3c01, 0x1000, 'add', 0x3c02],
  [0xbc00, 0x9000, 'add', 0xbc00],
  [0xbc01, 0x9000, 'add', 0xbc02],
  [0x3fff, 0x1000, 'add', 0x4000],
  [0x3c01, 0x3c00, 'subtract', 0x1400],
  [0x0001, 0x0001, 'add', 0x0002],
  [0x03ff, 1, 'add', 0x0400],
  [0x0400, 1, 'subtract', 0x03ff],
  [0x0400, 0x03ff, 'subtract', 1],
  [0x83ff, 0x8001, 'add', 0x8400],
  [0x8400, 0x8001, 'subtract', 0x83ff],
  [0x7bff, 0x4800, 'add', 0x7bff],
  [0x7bff, 0x4c00, 'add', 0x7c00],
  [0xfbff, 0xcc00, 'add', 0xfc00],
  [0x7bff, 0x7bff, 'add', 0x7c00],
  [0x7bff, 0xfbff, 'add', 0x0000],
  [0x0001, 0x8001, 'add', 0x0000],
]

describe('FP16 exact dyadic addition and subtraction', () => {
  it.each(directed)('computes %i %i %s as %i', (a, b, operation, bits) => {
    const result = calculateFP16(a, b, operation)
    expect(result.bits).toBe(bits)
    expect(result.bits).toBe(referenceFP16Arithmetic(a, b, operation).bits)
    expect(result.flags).toEqual(referenceFP16Arithmetic(a, b, operation).flags)
    expect(result.exact?.value).toBe(
      referenceFP16Arithmetic(a, b, operation).exact,
    )
    expect(result.trace.map((item) => item.kind)).toEqual([
      'decode',
      'compare',
      'align',
      'arithmetic',
      'normalize',
      'grs',
      'round',
      'encode',
    ])
  })

  it.each([0, 0x8000])(
    'handles every effective signed-zero combination with A=%i',
    (a) => {
      for (const b of [0, 0x8000])
        for (const operation of ['add', 'subtract'] as const) {
          const result = calculateFP16(a, b, operation)
          expect(result.bits).toBe(
            referenceFP16Arithmetic(a, b, operation).bits,
          )
          expect(result.flags).toEqual(clear)
          expect(result.exact?.value).toBe(result.decoded.value)
        }
    },
  )

  it('preserves all alignment-tail bits and normalizes cancellation without rounding', () => {
    const result = addFP16(0x3c00, 1)
    expect(stage(result, 'align')).toMatchObject({
      commonExponent: 0,
      fractionalBits: 14,
      shiftRightA: 0,
      shiftRightB: 14,
      alignedA: 1024n << 14n,
      alignedB: 1n,
      quantumExponent: -24,
    })
    expect(stage(result, 'grs')).toMatchObject({
      guard: 0,
      round: 0,
      sticky: 1,
      discardCount: 14,
      remainder: 1n,
    })
    expect(result.flags).toEqual({ ...clear, inexact: true })
    const canceled = subtractFP16(0x3c01, 0x3c00)
    expect(stage(canceled, 'normalize')).toMatchObject({
      shift: -10,
      retained: 1024n,
      exactExponent: -10,
    })
    expect(stage(canceled, 'grs')).toMatchObject({
      guard: 0,
      round: 0,
      sticky: 0,
    })
    expect(canceled.flags).toEqual(clear)
  })

  it.each([
    [0x0c00, 0, 1, 0, false],
    [0x1000, 1, 0, 0, false],
    [0x1001, 1, 0, 1, true],
    [0x1200, 1, 1, 0, true],
  ] as const)(
    'derives GRS for B=%i and increments correctly',
    (b, guard, round, sticky, increment) => {
      const result = addFP16(0x3c00, b)
      expect(stage(result, 'grs')).toMatchObject({ guard, round, sticky })
      expect(stage(result, 'round').increment).toBe(increment)
    },
  )

  it('distinguishes even/odd ties, carry rounding, and exponent-range overflow', () => {
    expect(stage(addFP16(0x3c00, 0x1000), 'round')).toMatchObject({
      halfway: true,
      retainedWasOdd: false,
      increment: false,
    })
    expect(stage(addFP16(0x3c01, 0x1000), 'round')).toMatchObject({
      halfway: true,
      retainedWasOdd: true,
      increment: true,
    })
    expect(stage(addFP16(0x3fff, 0x1000), 'round')).toMatchObject({
      halfway: true,
      carry: true,
    })
    expect(addFP16(0x7bff, 0x4c00).flags).toEqual({
      ...clear,
      overflow: true,
      inexact: true,
    })
    // 65504 + 65504 has no discarded remainder but still exceeds the finite range.
    const overflow = addFP16(0x7bff, 0x7bff)
    expect(stage(overflow, 'grs').remainder).toBe(0n)
    expect(overflow.flags).toEqual({ ...clear, overflow: true, inexact: true })
  })

  it('reports exact tiny results without spurious underflow or inexact flags', () => {
    for (const [a, b, operation] of [
      [0x0400, 0x03ff, 'subtract'],
      [1, 1, 'add'],
      [0x8001, 0, 'add'],
    ] as const) {
      const result = calculateFP16(a, b, operation)
      expect(result.flags).toEqual(clear)
      expect(result.tininessDetection).toBe('after-rounding')
    }
  })

  it('checks every attainable outward rounding midpoint, on both signs, including overflow', () => {
    // Below exponent -13, half a quantum is smaller than the operand grid: a sum
    // of two binary16 operands cannot land on those midpoints. Every higher
    // midpoint is attainable by adding a representable half-spacing power of two.
    for (let lower = 0x0800; lower <= 0x7bff; lower += 1) {
      const exponent = (lower >>> 10) - 15
      const halfSpacing = referenceEncodeFP16(2 ** (exponent - 11))
      const even = lower % 2 === 0 ? lower : lower + 1
      for (const sign of [0, 0x8000]) {
        const result = addFP16(lower | sign, halfSpacing | sign)
        strictEqual(result.bits, even | sign)
        strictEqual(stage(result, 'round').halfway, true)
        strictEqual(stage(result, 'round').increment, lower % 2 !== 0)
        strictEqual(result.flags.inexact, true)
        strictEqual(result.flags.overflow, lower === 0x7bff)
        strictEqual(result.flags.underflow, false)
      }
    }
  }, 30000)

  it('checks zero identities and finite self-cancellation over all 65,536 patterns', () => {
    for (let a = 0; a <= 0xffff; a += 1) {
      for (const operation of ['add', 'subtract'] as const) {
        const actual = calculateFP16(a, 0, operation)
        const expected = referenceFP16Arithmetic(a, 0, operation)
        strictEqual(actual.bits, expected.bits)
        deepStrictEqual(actual.flags, expected.flags)
      }
      if ((a & 0x7fff) < 0x7c00) {
        const canceled = subtractFP16(a, a)
        strictEqual(canceled.bits, 0)
        deepStrictEqual(canceled.flags, clear)
      }
    }
  }, 30000)

  it('differentially validates 25,000 deterministic operand pairs in both operations', () => {
    let state = 0xa5c31e79
    const next = () => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return state & 65535
    }
    for (let i = 0; i < 25000; i += 1) {
      const a = next(),
        b = next()
      for (const operation of ['add', 'subtract'] as const) {
        const result = calculateFP16(a, b, operation)
        const expected = referenceFP16Arithmetic(a, b, operation)
        const context = `${a.toString(16)} ${operation} ${b.toString(16)}`
        strictEqual(result.bits, expected.bits, context)
        deepStrictEqual(result.flags, expected.flags, context)
        strictEqual(result.exact?.value ?? null, expected.exact, context)
      }
    }
  }, 30000)

  it('reconstructs finite results, GRS, and final encoding from the actual trace', () => {
    let state = 12345
    for (let i = 0; i < 5000; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const a = state & 0xffff
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const b = state & 0xffff
      const result = calculateFP16(a, b, i % 2 ? 'add' : 'subtract')
      const encoding = stage(result, 'encode')
      strictEqual(encoding.bits, result.bits)
      deepStrictEqual(encoding.flags, result.flags)
      if (!result.exact) continue
      const aligned = stage(result, 'align'),
        arithmetic = stage(result, 'arithmetic')
      const normalized = stage(result, 'normalize'),
        grs = stage(result, 'grs'),
        rounded = stage(result, 'round')
      strictEqual(
        arithmetic.signedA + arithmetic.signedB,
        result.exact.coefficient,
      )
      strictEqual(
        Number(aligned.alignedA) * 2 ** aligned.quantumExponent,
        Math.abs(decodeFP16(a).value),
      )
      strictEqual(
        Number(aligned.alignedB) * 2 ** aligned.quantumExponent,
        Math.abs(decodeFP16(b).value),
      )
      strictEqual(arithmetic.exponent, result.exact.exponent)
      const discarded = grs.discardedBits
      strictEqual(grs.guard, discarded[0] === '1' ? 1 : 0)
      strictEqual(grs.round, discarded[1] === '1' ? 1 : 0)
      strictEqual(grs.sticky, discarded.slice(2).includes('1') ? 1 : 0)
      const reconstructed =
        normalized.shift > 0
          ? (normalized.retained << BigInt(normalized.shift)) + grs.remainder
          : normalized.retained >> BigInt(-normalized.shift)
      strictEqual(reconstructed, normalized.magnitude)
      strictEqual(
        rounded.rounded,
        normalized.retained + (rounded.increment ? 1n : 0n),
      )
      const compared = stage(result, 'compare')
      const sign =
        arithmetic.sum < 0n ||
        (arithmetic.sum === 0n &&
          compared.a.sign === 1 &&
          compared.b.sign === 1)
          ? 0x8000
          : 0
      // Repack using only pre-encoding trace fields, rather than trusting encode.bits.
      const fraction = Number(rounded.finalSignificand)
      const packed =
        rounded.finalExponent > 15
          ? sign | 0x7c00
          : fraction < 1024
            ? sign | fraction
            : sign | ((rounded.finalExponent + 15) << 10) | (fraction - 1024)
      strictEqual(packed, result.bits)
      strictEqual(Number(formatExactDyadic(result.exact)), result.exact.value)
    }
  }, 30000)

  it.each(ARITHMETIC_EXAMPLES)(
    'verifies the documented $label preset',
    (example) => {
      expect(calculateFP16(example.a, example.b, example.operation).bits).toBe(
        example.expected,
      )
    },
  )

  it.each([-1, 65536, 1.5, Infinity, NaN])(
    'rejects invalid raw operand %s',
    (bits) => {
      expect(() => addFP16(bits, 0)).toThrow(RangeError)
      expect(() => subtractFP16(0, bits)).toThrow(RangeError)
    },
  )
  it('rejects unsupported operation names', () => {
    expect(() => calculateFP16(0, 0, 'multiply' as FP16Operation)).toThrow(
      RangeError,
    )
  })
})

describe('special-value policy and short-circuit traces', () => {
  it.each([
    [0x7c00, 0x3c00, 'add', 0x7c00, false],
    [0x3c00, 0xfc00, 'subtract', 0x7c00, false],
    [0x7c00, 0xfc00, 'add', 0x7e00, true],
    [0x7c00, 0x7c00, 'subtract', 0x7e00, true],
    [0xfc00, 0xfc00, 'add', 0xfc00, false],
    [0xfc00, 0x7c00, 'subtract', 0xfc00, false],
    [0x7e11, 0xfe22, 'add', 0x7e11, false],
    [0x7e11, 0xfc22, 'add', 0xfe22, true],
    [0xfc11, 0x7c22, 'add', 0xfe11, true],
    [0x3c00, 0xfc11, 'subtract', 0xfe11, true],
    [0x3c00, 0xfe11, 'subtract', 0xfe11, false],
    [0x7fff, 0x3c00, 'add', 0x7fff, false],
  ] as const)(
    'handles %i %i %s as %i with invalid=%s',
    (a, b, operation, bits, invalid) => {
      const result = calculateFP16(a, b, operation)
      expect(result.bits).toBe(bits)
      expect(result.flags).toEqual({ ...clear, invalid })
      expect(result.exact).toBeNull()
      expect(result.trace.map((item) => item.kind)).toEqual([
        'decode',
        'special',
        'encode',
      ])
    },
  )
})
