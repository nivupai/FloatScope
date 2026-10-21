// @vitest-environment node
/// <reference types="node" />
import { strictEqual, deepStrictEqual } from 'node:assert'
import { describe, expect, it } from 'vitest'
import { decodeFP16 } from '../lib/numerics/fp16'
import {
  multiplyFP16,
  fmaFP16,
  nonfusedMultiplyAddFP16,
  compareMultiplyAddFP16,
} from '../lib/numerics/fp16Multiply'
import type {
  FP16MultiplyResult,
  MultiplyStage,
} from '../lib/numerics/fp16Multiply'
import { referenceMultiply } from './reference/fp16MultiplyReference'
import { referenceFP16Arithmetic } from './reference/fp16ArithmeticReference'
import { MULTIPLY_EXAMPLES } from '../lib/arithmetic/multiplyExamples'
import { formatExactDyadic } from '../lib/arithmetic/presentation'

const clear = {
  invalid: false,
  overflow: false,
  underflow: false,
  inexact: false,
}
function stage<K extends MultiplyStage['kind']>(
  r: FP16MultiplyResult,
  kind: K,
) {
  const s = r.trace.find(
    (x): x is Extract<MultiplyStage, { kind: K }> => x.kind === kind,
  )
  if (!s) throw new Error(`Missing ${kind}`)
  return s
}
function match(a: number, b: number, c?: number) {
  const actual = c === undefined ? multiplyFP16(a, b) : fmaFP16(a, b, c)
  const expected = referenceMultiply(a, b, c)
  const context = `${a.toString(16)} ${b.toString(16)} ${c?.toString(16) ?? 'mul'}`
  strictEqual(actual.bits, expected.bits, context)
  deepStrictEqual(actual.flags, expected.flags, context)
  if (actual.exact) {
    strictEqual(
      actual.exact.coefficient << BigInt(actual.exact.exponent + 48),
      expected.units,
      context,
    )
    // Independently compare every decimal digit using the oracle's global integer.
    const text = formatExactDyadic(actual.exact)
    const [whole, fraction = ''] = text.replace('-', '').split('.')
    const decimal = BigInt(whole + fraction) * (text.startsWith('-') ? -1n : 1n)
    strictEqual(
      decimal * (1n << 48n),
      expected.units! * 10n ** BigInt(fraction.length),
      context,
    )
  } else strictEqual(expected.units, null, context)
  return actual
}

describe('exact binary16 multiplication and FMA', () => {
  it.each(MULTIPLY_EXAMPLES)('independently verifies $label', (example) => {
    const r = match(example.a, example.b, example.c)
    expect(r.bits).toBe(example.expected)
    if (example.nonfused !== undefined)
      expect(
        nonfusedMultiplyAddFP16(example.a, example.b, example.c!).bits,
      ).toBe(example.nonfused)
  })

  it.each([
    [0x0000, 0xbc00, 0x8000],
    [0x8000, 0xbc00, 0x0000],
    [0x7c00, 0xbc00, 0xfc00],
    [0xfc00, 0xbc00, 0x7c00],
    [0x0003, 0x3800, 0x0002],
    [0x8001, 0x3800, 0x8000],
    [0x0400, 0x3bff, 0x0400],
    [0x0400, 0x3bfe, 0x03ff],
    [0x3c03, 0x3e00, 0x3e04],
    [0xbc01, 0x3e00, 0xbe02],
    [0x7e11, 0xfc22, 0xfe22],
    [0xfc11, 0x7c22, 0xfe11],
  ])('multiplies %i and %i into %i', (a, b, bits) =>
    expect(match(a, b).bits).toBe(bits),
  )

  it.each([
    [0, 0x3c00, 0x8000, 0],
    [0x8000, 0x3c00, 0x8000, 0x8000],
    [0x8000, 0xbc00, 0, 0],
    [0x3c00, 0x3c00, 0xbc00, 0],
    [0, 0x7c00, 0x7e11, 0x7e11],
    [0, 0x7c00, 0xfc11, 0xfe11],
    [0x7c00, 0xbc00, 0x7c00, 0x7e00],
    [0x7c00, 0xbc00, 0xfc00, 0xfc00],
    [0x7e11, 0xfe22, 0xfc33, 0xfe33],
    [0x3c00, 0x3c00, 0x7c00, 0x7c00],
  ])('fuses %i × %i + %i into %i', (a, b, c, bits) =>
    expect(match(a, b, c).bits).toBe(bits),
  )

  it('distinguishes exact tininess, inexact underflow, and a tiny midpoint rounding to normal', () => {
    expect(match(0x0400, 0x3800).flags).toEqual(clear)
    expect(match(0x0001, 0x3800).flags).toEqual({
      ...clear,
      inexact: true,
      underflow: true,
    })
    expect(match(0x0400, 0x3bff).flags).toEqual({
      ...clear,
      inexact: true,
      underflow: true,
    })
    expect(match(0x0001, 0x3800, 0x0001).bits).toBe(2)
    expect(match(0x0001, 0x3800, 0x0001).flags).toEqual({
      ...clear,
      underflow: true,
      inexact: true,
    })
  })

  it('detects tininess after precision-only rounding even when the stored result is normal', () => {
    // These are independent exact multiples of the minimum-subnormal quantum.
    const below = match(0x03ff, 0x3bff, 1) // 1023.50048828125 quanta
    expect(below.bits).toBe(0x0400)
    expect(below.flags).toEqual({ ...clear, underflow: true, inexact: true })
    expect(stage(below, 'round').tinyAfterPrecisionRounding).toBe(true)
    const tie = match(0x03fd, 0x3a00, 0x0102) // 1021 * .75 + 258 = 1023.75 quanta
    expect(tie.bits).toBe(0x0400)
    expect(tie.flags).toEqual({ ...clear, inexact: true })
    expect(stage(tie, 'round').tinyAfterPrecisionRounding).toBe(false)
  })

  it('keeps the FMA product unbounded until after cancellation and combines nonfused flags separately', () => {
    const r = compareMultiplyAddFP16(0x7bff, 0x4000, 0xfbff)
    expect(r.fused.flags).toEqual(clear)
    expect(r.fused.exactProduct?.value).toBe(131008)
    expect(r.fused.decoded.value).toBe(65504)
    expect(r.nonfused.product.flags).toEqual({
      ...clear,
      overflow: true,
      inexact: true,
    })
    expect(r.nonfused.addition.flags).toEqual(clear)
    expect(r.nonfused.flags).toEqual(r.nonfused.product.flags)
    expect(r.difference).toBeNull()
    const tiny = compareMultiplyAddFP16(1, 0x3800, 0x3c00)
    expect(tiny.fused.flags.underflow).toBe(false)
    expect(tiny.nonfused.flags.underflow).toBe(true)
  })

  it('retains FMA residuals smaller than binary64 addition can preserve', () => {
    const r = match(1, 1, 0x3c00) // 1 + 2^-48, representable in binary64
    expect(formatExactDyadic(r.exact!)).toBe(
      '1.000000000000003552713678800500929355621337890625',
    )
    const wide = match(0x7bff, 0x7bff, 1) // exact product plus minsub needs >53 bits
    expect(wide.exact!.coefficient.toString(2).length).toBeGreaterThan(53)
    expect(formatExactDyadic(wide.exact!)).toBe(
      '4290774016.000000059604644775390625',
    )
    expect(wide.flags.overflow).toBe(true)
  })

  it('reconstructs product, alignment, GRS, rounding, and encoding from actual traces', () => {
    let state = 0x9723f0ab
    for (let i = 0; i < 5000; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const a = state & 0xffff
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const b = state & 0xffff
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const c = state & 0xffff
      const r = i % 2 ? match(a, b) : match(a, b, c)
      deepStrictEqual(stage(r, 'encode').flags, r.flags)
      if (!r.exact) {
        strictEqual(r.trace.length, 3)
        strictEqual(r.trace[1].kind, 'multiply-special')
        continue
      }
      strictEqual(r.trace.length, 8)
      const p = stage(r, 'multiply')
      strictEqual(p.product, p.significandA * p.significandB)
      strictEqual(p.exponent, p.exponentA + p.exponentB)
      if (r.operation === 'fma') {
        const align = stage(r, 'align-product'),
          arithmetic = stage(r, 'arithmetic')
        strictEqual(
          align.alignedProduct,
          align.product << BigInt(align.shiftProduct),
        )
        strictEqual(
          align.alignedAddend,
          align.addend << BigInt(align.shiftAddend),
        )
        strictEqual(
          arithmetic.signedA + arithmetic.signedB,
          r.exact.coefficient,
        )
        strictEqual(align.exponent, r.exact.exponent)
      }
      const n = stage(r, 'normalize'),
        grs = stage(r, 'grs'),
        round = stage(r, 'round')
      strictEqual(
        n.shift > 0
          ? (n.retained << BigInt(n.shift)) + grs.remainder
          : n.retained >> BigInt(-n.shift),
        n.magnitude,
      )
      strictEqual(grs.guard, grs.discardedBits[0] === '1' ? 1 : 0)
      strictEqual(grs.round, grs.discardedBits[1] === '1' ? 1 : 0)
      strictEqual(grs.sticky, grs.discardedBits.slice(2).includes('1') ? 1 : 0)
      strictEqual(round.rounded, n.retained + (round.increment ? 1n : 0n))
      const sign =
        r.exact.coefficient < 0n || Object.is(r.exact.value, -0) ? 0x8000 : 0
      const m = Number(round.finalSignificand)
      const bits =
        round.finalExponent > 15
          ? sign | 0x7c00
          : m < 1024
            ? sign | m
            : sign | ((round.finalExponent + 15) << 10) | (m - 1024)
      strictEqual(bits, r.bits)
    }
  }, 30000)

  it('checks every raw pattern multiplied by +1/−1 and fused with both zero signs', () => {
    for (let bits = 0; bits <= 65535; bits++) {
      match(bits, 0x3c00)
      match(bits, 0xbc00)
      match(bits, 0x3c00, 0)
      match(bits, 0x3c00, 0x8000)
    }
  }, 30000)

  it('differentially checks 30,000 deterministic pairs/triples and nonfused flags', () => {
    let state = 0x68efc921
    const next = () => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return state & 0xffff
    }
    for (let i = 0; i < 30000; i++) {
      const a = next(),
        b = next(),
        c = next()
      match(a, b)
      match(a, b, c)
      const p = referenceMultiply(a, b),
        sum = referenceFP16Arithmetic(p.bits, c, 'add')
      const r = nonfusedMultiplyAddFP16(a, b, c)
      strictEqual(r.product.bits, p.bits)
      strictEqual(r.bits, sum.bits)
      for (const flag of Object.keys(clear) as (keyof typeof clear)[])
        strictEqual(r.flags[flag], p.flags[flag] || sum.flags[flag])
    }
  }, 30000)

  it('enumerates a complete special-value cross product with signed zero, qNaN, and sNaN', () => {
    const values = [
      0, 0x8000, 1, 0x8001, 0x0400, 0x8400, 0x3c00, 0xbc00, 0x7bff, 0xfbff,
      0x7c00, 0xfc00, 0x7e11, 0xfe22, 0x7c33, 0xfc44,
    ]
    for (const a of values)
      for (const b of values) {
        match(a, b)
        for (const c of values) match(a, b, c)
      }
  }, 30000)

  it.each([-1, 65536, 1.5, Infinity, NaN])(
    'validates each operand position for %s',
    (bits) => {
      expect(() => multiplyFP16(bits, 0)).toThrow(RangeError)
      expect(() => multiplyFP16(0, bits)).toThrow(RangeError)
      expect(() => fmaFP16(0, 0, bits)).toThrow(RangeError)
      expect(() => nonfusedMultiplyAddFP16(0, 0, bits)).toThrow(RangeError)
    },
  )

  it('returns independently decoded raw outputs with canonical invalid-result NaNs', () => {
    const r = multiplyFP16(0, 0xfc00)
    expect(r.bits).toBe(0x7e00)
    expect(r.decoded).toEqual(decodeFP16(0x7e00))
    expect(r.flags).toEqual({ ...clear, invalid: true })
    expect(r.trace.map((s) => s.kind)).toEqual([
      'decode-multiply',
      'multiply-special',
      'encode',
    ])
  })
})
