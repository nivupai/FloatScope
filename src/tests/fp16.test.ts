// @vitest-environment node
/// <reference types="node" />
import { strictEqual } from 'node:assert'
import { describe, expect, it } from 'vitest'
import {
  decodeFP16,
  floatToFP16Bits,
  formatFP16Bits,
  fp16BitsToFloat,
  fp16BitsToHex,
  isExactlyRepresentableFP16,
  nextDownFP16,
  nextUpFP16,
  ulpFP16,
} from '../lib/numerics'
import {
  adjacentPositiveFloat64,
  positiveFP16Values,
  referenceEncodeFP16,
} from './reference/fp16Reference'

const vectors = [
  { bits: 0x0000, value: 0, classification: 'zero', exponent: null },
  { bits: 0x8000, value: -0, classification: 'zero', exponent: null },
  { bits: 0x3c00, value: 1, classification: 'normal', exponent: 0 },
  { bits: 0xbc00, value: -1, classification: 'normal', exponent: 0 },
  { bits: 0x3e00, value: 1.5, classification: 'normal', exponent: 0 },
  { bits: 0x0001, value: 2 ** -24, classification: 'subnormal', exponent: -14 },
  {
    bits: 0x03ff,
    value: 1023 * 2 ** -24,
    classification: 'subnormal',
    exponent: -14,
  },
  { bits: 0x0400, value: 2 ** -14, classification: 'normal', exponent: -14 },
  { bits: 0x7bff, value: 65504, classification: 'normal', exponent: 15 },
  { bits: 0xfbff, value: -65504, classification: 'normal', exponent: 15 },
  { bits: 0x7c00, value: Infinity, classification: 'infinity', exponent: null },
  {
    bits: 0xfc00,
    value: -Infinity,
    classification: 'infinity',
    exponent: null,
  },
] as const

describe('binary16 representation', () => {
  it.each(vectors)('encodes and decodes $bits ($classification)', (vector) => {
    expect(floatToFP16Bits(vector.value)).toBe(vector.bits)
    expect(fp16BitsToFloat(vector.bits)).toBe(vector.value)
    expect(decodeFP16(vector.bits)).toMatchObject({
      bits: vector.bits,
      sign: vector.bits >= 0x8000 ? 1 : 0,
      classification: vector.classification,
      unbiasedExponent: vector.exponent,
      value: vector.value,
      hasImplicitLeadingBit: vector.classification === 'normal',
      isQuietNaN: null,
      nanPayload: null,
    })
  })

  it('exposes raw fields and distinguishes stored fraction from the leading bit', () => {
    expect(decodeFP16(0xbe00)).toEqual({
      bits: 0xbe00,
      sign: 1,
      exponent: 15,
      fraction: 512,
      unbiasedExponent: 0,
      classification: 'normal',
      value: -1.5,
      hasImplicitLeadingBit: true,
      isQuietNaN: null,
      nanPayload: null,
    })
    expect(decodeFP16(0x03ff)).toMatchObject({
      exponent: 0,
      fraction: 1023,
      hasImplicitLeadingBit: false,
    })
  })

  it.each([
    [0x7c01, false, 1],
    [0x7dff, false, 511],
    [0x7e00, true, 0],
    [0xffff, true, 511],
    [0xfc01, false, 1],
  ] as const)('preserves raw NaN metadata for %i', (bits, quiet, payload) => {
    expect(decodeFP16(bits)).toMatchObject({
      bits,
      sign: bits >= 0x8000 ? 1 : 0,
      classification: 'nan',
      unbiasedExponent: null,
      value: NaN,
      hasImplicitLeadingBit: false,
      isQuietNaN: quiet,
      nanPayload: payload,
    })
    expect(floatToFP16Bits(fp16BitsToFloat(bits))).toBe(0x7e00)
  })

  it('formats fixed-width binary and lowercase hexadecimal strings', () => {
    expect(formatFP16Bits(0x0001)).toBe('0000000000000001')
    expect(formatFP16Bits(0xbe00)).toBe('1011111000000000')
    expect(formatFP16Bits(0xffff)).toBe('1111111111111111')
    expect(fp16BitsToHex(0x0000)).toBe('0x0000')
    expect(fp16BitsToHex(0xbe00)).toBe('0xbe00')
    expect(fp16BitsToHex(0xffff)).toBe('0xffff')
  })

  it.each([-1, 65536, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER])(
    'rejects invalid raw pattern %s consistently without masking',
    (bits) => {
      for (const api of [
        decodeFP16,
        fp16BitsToFloat,
        formatFP16Bits,
        fp16BitsToHex,
        nextUpFP16,
        nextDownFP16,
        ulpFP16,
      ]) {
        expect(() => api(bits)).toThrow(RangeError)
      }
    },
  )
})

describe('round-to-nearest, ties-to-even', () => {
  it.each([
    [2 ** -25, 0x0000],
    [-(2 ** -25), 0x8000],
    [3 * 2 ** -25, 0x0002],
    [5 * 2 ** -25, 0x0002],
    [1 + 2 ** -11, 0x3c00],
    [1 + 3 * 2 ** -11, 0x3c02],
    [2 - 2 ** -11, 0x4000],
    [-(2 - 2 ** -11), 0xc000],
    [2 ** -14 - 2 ** -25, 0x0400],
    [65519, 0x7bff],
    [65520, 0x7c00],
    [-65520, 0xfc00],
    [Number.MIN_VALUE, 0x0000],
    [-Number.MIN_VALUE, 0x8000],
    [Number.MAX_VALUE, 0x7c00],
    [-Number.MAX_VALUE, 0xfc00],
    [NaN, 0x7e00],
  ])('rounds %s to %i', (value, bits) => {
    expect(floatToFP16Bits(value)).toBe(bits)
  })

  it('does not double round through binary32 near a binary16 tie', () => {
    const midpoint = 1 + 2 ** -11
    const above = adjacentPositiveFloat64(midpoint, 1)
    expect(Math.fround(above)).toBe(midpoint)
    expect(floatToFP16Bits(above)).toBe(0x3c01)
    expect(floatToFP16Bits(-above)).toBe(0xbc01)
    const oddMidpoint = 1 + 3 * 2 ** -11
    const below = adjacentPositiveFloat64(oddMidpoint, -1)
    expect(Math.fround(below)).toBe(oddMidpoint)
    expect(floatToFP16Bits(below)).toBe(0x3c01)
    expect(floatToFP16Bits(-below)).toBe(0xbc01)
  })

  it('checks every finite gap at its exact midpoint and binary64 neighbors, both signs', () => {
    for (let lower = 0; lower < positiveFP16Values.length - 1; lower += 1) {
      const midpoint =
        (positiveFP16Values[lower] + positiveFP16Values[lower + 1]) / 2
      const even = lower % 2 === 0 ? lower : lower + 1
      const probes = [
        [adjacentPositiveFloat64(midpoint, -1), lower],
        [midpoint, even],
        [adjacentPositiveFloat64(midpoint, 1), lower + 1],
      ]
      for (const [value, expected] of probes) {
        expect(floatToFP16Bits(value)).toBe(expected)
        expect(floatToFP16Bits(-value)).toBe(expected + 0x8000)
      }
    }
    expect(floatToFP16Bits(adjacentPositiveFloat64(65520, -1))).toBe(0x7bff)
    expect(floatToFP16Bits(adjacentPositiveFloat64(65520, 1))).toBe(0x7c00)
    expect(floatToFP16Bits(-adjacentPositiveFloat64(65520, -1))).toBe(0xfbff)
    expect(floatToFP16Bits(-adjacentPositiveFloat64(65520, 1))).toBe(0xfc00)
  })

  it('agrees with the independent lattice oracle and native conversion when available', () => {
    const native = Math as typeof Math & {
      f16round?: (value: number) => number
    }
    const nativeView = new DataView(new ArrayBuffer(2)) as DataView & {
      setFloat16?: (
        offset: number,
        value: number,
        littleEndian?: boolean,
      ) => void
    }
    const assertReference = (value: number) => {
      const expected = referenceEncodeFP16(value)
      const actual = floatToFP16Bits(value)
      expect(actual).toBe(expected)
      if (native.f16round)
        expect(fp16BitsToFloat(actual)).toBe(native.f16round(value))
      if (nativeView.setFloat16) {
        nativeView.setFloat16(0, value, false)
        const raw = nativeView.getUint16(0, false)
        // Native NaN encodings are implementation-defined, so compare classification.
        if (Number.isNaN(value)) expect(raw & 0x7fff).toBeGreaterThan(0x7c00)
        else expect(actual).toBe(raw)
      }
    }

    // Every binary64 exponent field, both signs, four distinct fractions.
    const view = new DataView(new ArrayBuffer(8))
    for (let exponent = 0n; exponent < 2048n; exponent += 1n) {
      for (const fraction of [0n, 1n, 0x8000000000000n, 0xfffffffffffffn]) {
        view.setBigUint64(0, (exponent << 52n) | fraction)
        const value = view.getFloat64(0)
        assertReference(value)
        assertReference(-value)
      }
    }
    // Fixed-seed full-width binary64 patterns make randomized coverage reproducible.
    let state = 0x123456789abcdef0n
    for (let i = 0; i < 4096; i += 1) {
      state = BigInt.asUintN(64, state ^ (state << 13n))
      state ^= state >> 7n
      state = BigInt.asUintN(64, state ^ (state << 17n))
      view.setBigUint64(0, state)
      assertReference(view.getFloat64(0))
    }
  })
})

describe('exhaustive binary16 validation', () => {
  it('independently verifies decoding and re-encoding all 65,536 patterns', () => {
    expect(positiveFP16Values).toHaveLength(0x7c00)
    const counts = { zero: 0, subnormal: 0, normal: 0, infinity: 0, nan: 0 }
    for (let bits = 0; bits <= 0xffff; bits += 1) {
      const decoded = decodeFP16(bits)
      const magnitude = bits % 0x8000
      const polarity = bits < 0x8000 ? 1 : -1
      const expectedValue =
        magnitude < 0x7c00
          ? polarity * positiveFP16Values[magnitude]
          : magnitude === 0x7c00
            ? polarity * Infinity
            : NaN
      const expectedClassification =
        magnitude === 0
          ? 'zero'
          : magnitude < 1024
            ? 'subnormal'
            : magnitude < 0x7c00
              ? 'normal'
              : magnitude === 0x7c00
                ? 'infinity'
                : 'nan'
      // Avoid 393,216 Chai expectation wrappers in this exhaustive Node-only loop.
      // strictEqual uses Object.is too, preserving NaN equality and signed zero.
      const context = `FP16 pattern 0x${bits.toString(16).padStart(4, '0')}`
      strictEqual(decoded.value, expectedValue, context)
      strictEqual(decoded.classification, expectedClassification, context)
      strictEqual(decoded.exponent, Math.floor(magnitude / 1024), context)
      strictEqual(decoded.fraction, magnitude % 1024, context)
      strictEqual(
        floatToFP16Bits(decoded.value),
        magnitude > 0x7c00 ? 0x7e00 : bits,
        context,
      )
      strictEqual(
        isExactlyRepresentableFP16(decoded.value),
        magnitude <= 0x7c00,
        context,
      )
      counts[decoded.classification] += 1
    }
    expect(counts).toEqual({
      zero: 2,
      subnormal: 2046,
      normal: 61440,
      infinity: 2,
      nan: 2046,
    })
  })
})

describe('binary16 introspection', () => {
  it.each([
    [0x0000, 0x0001, 0x8001],
    [0x8000, 0x0001, 0x8001],
    [0x0001, 0x0002, 0x0000],
    [0x8001, 0x8000, 0x8002],
    [0x03ff, 0x0400, 0x03fe],
    [0x0400, 0x0401, 0x03ff],
    [0x3c00, 0x3c01, 0x3bff],
    [0xbc00, 0xbbff, 0xbc01],
    [0x7bff, 0x7c00, 0x7bfe],
    [0xfbff, 0xfbfe, 0xfc00],
    [0x7c00, 0x7c00, 0x7bff],
    [0xfc00, 0xfbff, 0xfc00],
    [0x7c01, 0x7c01, 0x7c01],
    [0xfe55, 0xfe55, 0xfe55],
  ])('steps from raw %i to nextUp %i and nextDown %i', (bits, up, down) => {
    expect(nextUpFP16(bits)).toBe(up)
    expect(nextDownFP16(bits)).toBe(down)
  })

  it('checks adjacency over the complete ordered non-NaN lattice and preserves every NaN', () => {
    const ordered = [
      0xfc00,
      ...Array.from({ length: 0x7bff }, (_, i) => 0xfbff - i),
      0x8000,
      0x0000,
      ...Array.from({ length: 0x7bff }, (_, i) => i + 1),
      0x7c00,
    ]
    for (const [index, bits] of ordered.entries()) {
      const up =
        bits === 0x8000 ? 1 : ordered[Math.min(index + 1, ordered.length - 1)]
      const down = bits === 0 ? 0x8001 : ordered[Math.max(index - 1, 0)]
      expect(nextUpFP16(bits)).toBe(up)
      expect(nextDownFP16(bits)).toBe(down)
    }
    for (let payload = 1; payload <= 1023; payload += 1) {
      for (const prefix of [0x7c00, 0xfc00]) {
        expect(nextUpFP16(prefix + payload)).toBe(prefix + payload)
        expect(nextDownFP16(prefix + payload)).toBe(prefix + payload)
      }
    }
  })

  it.each([
    [0x0000, 2 ** -24],
    [0x8000, 2 ** -24],
    [0x0001, 2 ** -24],
    [0x03ff, 2 ** -24],
    [0x0400, 2 ** -24],
    [0x3bff, 2 ** -11],
    [0x3c00, 2 ** -10],
    [0xbc00, 2 ** -10],
    [0x4000, 2 ** -9],
    [0x7bff, 32],
    [0xfbff, 32],
    [0x7c00, Infinity],
    [0xfc00, Infinity],
    [0x7c01, NaN],
  ])('defines binade ULP at raw %i as %s', (bits, expected) => {
    expect(ulpFP16(bits)).toBe(expected)
  })

  it('verifies ULP for every finite magnitude against positive lattice spacing', () => {
    for (let bits = 0; bits < positiveFP16Values.length; bits += 1) {
      const expected =
        bits === 0x7bff
          ? 32
          : positiveFP16Values[bits + 1] - positiveFP16Values[bits]
      expect(ulpFP16(bits)).toBe(expected)
      expect(ulpFP16(bits + 0x8000)).toBe(expected)
    }
    // At -1 the next greater value is in the smaller binade: ULP is not that gap.
    expect(fp16BitsToFloat(nextUpFP16(0xbc00)) + 1).toBe(2 ** -11)
    expect(ulpFP16(0xbc00)).toBe(2 ** -10)
  })

  it.each([
    [0, true],
    [-0, true],
    [1.5, true],
    [2 ** -24, true],
    [65504, true],
    [Infinity, true],
    [-Infinity, true],
    [NaN, false],
    [0.1, false],
    [1 + 2 ** -11, false],
    [Number.MIN_VALUE, false],
    [65520, false],
  ])('reports exact representability of %s as %s', (value, expected) => {
    expect(isExactlyRepresentableFP16(value as number)).toBe(expected)
  })
})
