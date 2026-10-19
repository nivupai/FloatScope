// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { floatToFP16Bits, fp16BitsToFloat, ulpFP16 } from '../lib/numerics'
import {
  analyzeFP16Rounding,
  fitViewport,
  fp16ULPRegions,
  generateFP16Viewport,
  MICROSCOPE_DOMAIN,
  MIN_VIEW_SPAN,
  roundingIntervalFP16,
  viewportForTarget,
} from '../lib/numerics/microscope'
import {
  positiveFP16Values,
  adjacentPositiveFloat64,
} from './reference/fp16Reference'
import { formatBoundary, formatInterval } from '../lib/microscope/presentation'

const independentLattice = [
  ...positiveFP16Values
    .slice(1)
    .reverse()
    .map((value) => -value),
  ...positiveFP16Values,
]

describe('viewport-based FP16 lattice', () => {
  it.each([
    [-0.0000002, 0.0000002],
    [0.999, 1.003],
    [-1.003, -0.999],
    [2 ** -14 - 4 * 2 ** -24, 2 ** -14 + 4 * 2 ** -24],
    [-(2 ** -14) - 4 * 2 ** -24, -(2 ** -14) + 4 * 2 ** -24],
    [998, 1002],
    [65400, 65600],
    [-65600, -65400],
    [70000, 80000],
    [-80000, -70000],
  ])(
    'generates exactly the independent finite lattice in [%s, %s]',
    (min, max) => {
      const expected = independentLattice.filter(
        (value) => value >= min && value <= max,
      )
      const actual = generateFP16Viewport(min, max, 512)
      expect(actual.sampled).toBe(false)
      expect(actual.total).toBe(expected.length)
      expect(actual.points.map((point) => point.value)).toEqual(expected)
      for (const point of actual.points) {
        expect(fp16BitsToFloat(point.bits)).toBe(point.value)
        expect(point.ulp).toBe(ulpFP16(point.bits))
      }
    },
  )

  it('caps broad views without synthesizing fake points or losing visible endpoints', () => {
    const result = generateFP16Viewport(-131072, 131072)
    expect(result.total).toBe(63487)
    expect(result.points).toHaveLength(121)
    expect(result.sampled).toBe(true)
    expect(result.points[0].value).toBe(-65504)
    expect(result.points.at(-1)?.value).toBe(65504)
    const values = new Set(independentLattice)
    for (const point of result.points)
      expect(values.has(point.value)).toBe(true)
    expect(new Set(result.points.map((point) => point.value)).size).toBe(121)
    expect(result.points.map((point) => point.value)).toEqual(
      result.points.map((point) => point.value).sort((a, b) => a - b),
    )
  })

  it('includes endpoints, has one geometric zero, and handles a single-point window', () => {
    expect(
      generateFP16Viewport(-Number.MIN_VALUE, Number.MIN_VALUE).points,
    ).toEqual([{ bits: 0, value: 0, ulp: 2 ** -24 }])
    expect(
      generateFP16Viewport(1, 1 + 2 ** -10).points.map((p) => p.bits),
    ).toEqual([0x3c00, 0x3c01])
  })

  it('compares varied bounded viewports against the independent lattice', () => {
    for (let i = 1; i <= 40; i += 1) {
      const center = (i % 2 ? -1 : 1) * 2 ** (((i * 7) % 40) - 24)
      const width = (Math.abs(center) * ((i % 5) + 1)) / 3
      const min = center - width
      const max = center + width
      const expected = independentLattice.filter(
        (value) => value >= min && value <= max,
      )
      const result = generateFP16Viewport(min, max, 33)
      expect(result.total).toBe(expected.length)
      expect(result.points.length).toBeLessThanOrEqual(33)
      const available = new Set(expected)
      for (const point of result.points)
        expect(available.has(point.value)).toBe(true)
      if (expected.length) {
        expect(result.points[0].value).toBe(expected[0])
        expect(result.points.at(-1)?.value).toBe(expected.at(-1))
      }
    }
  })

  it.each([
    [1, 1],
    [2, 1],
    [NaN, 2],
    [0, Infinity],
    [-Number.MAX_VALUE, Number.MAX_VALUE],
  ])('rejects invalid viewport %s, %s', (min, max) => {
    expect(() => generateFP16Viewport(min, max)).toThrow(RangeError)
  })
  it.each([0, 1, 513, 2.5, NaN])('rejects invalid point budget %s', (limit) => {
    expect(() => generateFP16Viewport(0, 1, limit)).toThrow(RangeError)
  })

  it('bounds pan/zoom geometry independently of unrestricted input analysis', () => {
    expect(fitViewport(0, 1e9)).toEqual({
      min: -MICROSCOPE_DOMAIN,
      max: MICROSCOPE_DOMAIN,
    })
    const tiny = fitViewport(1, Number.MIN_VALUE)
    expect(tiny.max - tiny.min).toBe(MIN_VIEW_SPAN)
    expect(fitViewport(1e9, 128).max).toBe(MICROSCOPE_DOMAIN)
    for (const target of [
      -Infinity,
      Infinity,
      NaN,
      -0,
      Number.MIN_VALUE,
      Number.MAX_VALUE,
    ]) {
      const view = viewportForTarget(target)
      expect(Number.isFinite(view.min)).toBe(true)
      expect(view.max).toBeGreaterThan(view.min)
      expect(view.max).toBeLessThanOrEqual(MICROSCOPE_DOMAIN)
      expect(view.min).toBeGreaterThanOrEqual(-MICROSCOPE_DOMAIN)
    }
    expect(() => fitViewport(NaN, 1)).toThrow(RangeError)
    expect(() => fitViewport(0, 0)).toThrow(RangeError)
  })
})

describe('exact nearest-even rounding intervals', () => {
  it('does not mistake adjacent binary64 values on either side of a tie for ties', () => {
    const midpoint = 1 + 2 ** -11
    for (const direction of [-1, 1] as const) {
      const neighbor = adjacentPositiveFloat64(midpoint, direction)
      for (const sign of [-1, 1])
        expect(analyzeFP16Rounding(sign * neighbor).tie).toBe(false)
    }
    expect(analyzeFP16Rounding(midpoint).tie).toBe(true)
    expect(analyzeFP16Rounding(-midpoint).tie).toBe(true)
  })

  it('has asymmetric normal cells at positive and negative powers of two', () => {
    expect(roundingIntervalFP16(0x3c00)).toEqual({
      lower: 1 - 2 ** -12,
      upper: 1 + 2 ** -11,
      lowerIncluded: true,
      upperIncluded: true,
    })
    expect(roundingIntervalFP16(0xbc00)).toEqual({
      lower: -1 - 2 ** -11,
      upper: -1 + 2 ** -12,
      lowerIncluded: true,
      upperIncluded: true,
    })
    expect(roundingIntervalFP16(0x3c01)).toMatchObject({
      lowerIncluded: false,
      upperIncluded: false,
    })
  })

  it('handles sign-dependent zero half-cells and exact underflow ties', () => {
    expect(roundingIntervalFP16(0)).toEqual({
      lower: 0,
      upper: 2 ** -25,
      lowerIncluded: true,
      upperIncluded: true,
    })
    expect(roundingIntervalFP16(0x8000)).toEqual({
      lower: -(2 ** -25),
      upper: -0,
      lowerIncluded: true,
      upperIncluded: true,
    })
    expect(analyzeFP16Rounding(0).tie).toBe(false)
    expect(analyzeFP16Rounding(-0).tie).toBe(false)
    expect(analyzeFP16Rounding(2 ** -25)).toMatchObject({ bits: 0, tie: true })
    expect(analyzeFP16Rounding(-(2 ** -25))).toMatchObject({
      bits: 0x8000,
      tie: true,
    })
    expect(analyzeFP16Rounding(adjacentPositiveFloat64(2 ** -25, 1)).bits).toBe(
      1,
    )
  })

  it('does not invent a spacing jump at the subnormal-to-normal boundary', () => {
    const cell = roundingIntervalFP16(0x0400)!
    expect(cell.lower).toBe(2 ** -14 - 2 ** -25)
    expect(cell.upper).toBe(2 ** -14 + 2 ** -25)
    expect(analyzeFP16Rounding(cell.lower)).toMatchObject({
      bits: 0x0400,
      tie: true,
    })
    expect(
      analyzeFP16Rounding(adjacentPositiveFloat64(cell.lower, -1)).bits,
    ).toBe(0x03ff)
  })

  it('uses virtual ±65536 at the overflow ties and unbounded infinity cells', () => {
    expect(roundingIntervalFP16(0x7bff)).toEqual({
      lower: 65488,
      upper: 65520,
      lowerIncluded: false,
      upperIncluded: false,
    })
    expect(roundingIntervalFP16(0x7c00)).toEqual({
      lower: 65520,
      upper: Infinity,
      lowerIncluded: true,
      upperIncluded: false,
    })
    expect(roundingIntervalFP16(0xfc00)).toEqual({
      lower: -Infinity,
      upper: -65520,
      lowerIncluded: false,
      upperIncluded: true,
    })
    expect(analyzeFP16Rounding(65520)).toMatchObject({
      bits: 0x7c00,
      tie: true,
      absoluteError: Infinity,
      relativeError: Infinity,
    })
    expect(analyzeFP16Rounding(-65520)).toMatchObject({
      bits: 0xfc00,
      tie: true,
    })
    expect(analyzeFP16Rounding(adjacentPositiveFloat64(65520, -1)).bits).toBe(
      0x7bff,
    )
    expect(roundingIntervalFP16(0x7e01)).toBeNull()
    expect(() => roundingIntervalFP16(65536)).toThrow(RangeError)
  })

  it('independently validates every finite nonzero cell and both endpoint owners', () => {
    // A separate integer-lattice oracle supplies neighbors, never the production decoder.
    for (let magnitude = 1; magnitude < 0x7c00; magnitude += 1) {
      const value = positiveFP16Values[magnitude]
      const smaller = positiveFP16Values[magnitude - 1]
      const larger =
        magnitude === 0x7bff ? 65536 : positiveFP16Values[magnitude + 1]
      for (const sign of [0, 0x8000]) {
        const bits = sign + magnitude
        const cell = roundingIntervalFP16(bits)!
        const expectedLower = sign
          ? -(value + larger) / 2
          : (value + smaller) / 2
        const expectedUpper = sign
          ? -(value + smaller) / 2
          : (value + larger) / 2
        expect(cell.lower).toBe(expectedLower)
        expect(cell.upper).toBe(expectedUpper)
        const even = magnitude % 2 === 0
        expect(cell.lowerIncluded).toBe(even)
        expect(cell.upperIncluded).toBe(even)
        expect(floatToFP16Bits(cell.lower) === bits).toBe(even)
        expect(floatToFP16Bits(cell.upper) === bits).toBe(even)
      }
    }
  }, 30000)

  it('reports errors against the binary64 input, including undefined cases', () => {
    const tie = analyzeFP16Rounding(1 + 2 ** -11)
    expect(tie).toMatchObject({
      bits: 0x3c00,
      absoluteError: 2 ** -11,
      relativeError: 1 / 2049,
      direction: 'Toward -Infinity',
      tie: true,
    })
    expect(analyzeFP16Rounding(-(1 + 2 ** -11)).direction).toBe(
      'Toward +Infinity',
    )
    expect(analyzeFP16Rounding(1).absoluteError).toBe(0)
    expect(analyzeFP16Rounding(0).relativeError).toBeNull()
    expect(analyzeFP16Rounding(-0).decoded.value).toBe(-0)
    expect(analyzeFP16Rounding(Number.MIN_VALUE)).toMatchObject({
      bits: 0,
      absoluteError: Number.MIN_VALUE,
      relativeError: 1,
    })
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(analyzeFP16Rounding(value).absoluteError).toBeNull()
      expect(analyzeFP16Rounding(value).relativeError).toBeNull()
    }
    expect(analyzeFP16Rounding(NaN).direction).toBe('Unordered (NaN)')
  })

  it('displays exact halfway decimals rather than rounded FP16-only formatting', () => {
    expect(formatBoundary(2 ** -25)).toBe('0.0000000298023223876953125')
    expect(formatBoundary(-0)).toBe('-0')
    expect(formatInterval(roundingIntervalFP16(0))).toBe(
      '[0, 0.0000000298023223876953125]',
    )
  })
})

describe('positive ULP regions', () => {
  it('models all subnormal and normal regions with the engine as source of truth', () => {
    const regions = fp16ULPRegions()
    expect(regions).toHaveLength(31)
    expect(regions[0]).toMatchObject({
      lower: 2 ** -24,
      upper: 2 ** -14,
      ulp: 2 ** -24,
      exponent: null,
    })
    expect(regions[1].ulp).toBe(regions[0].ulp)
    for (let i = 2; i < regions.length; i += 1)
      expect(regions[i].ulp).toBe(regions[i - 1].ulp * 2)
    expect(regions.at(-1)).toMatchObject({
      lower: 32768,
      upper: 65536,
      ulp: 32,
    })
    for (let bits = 1; bits < 0x7c00; bits += 1) {
      const value = positiveFP16Values[bits]
      const region = regions.find((r) => value >= r.lower && value < r.upper)!
      expect(region).toBeDefined()
      expect(region.ulp).toBe(ulpFP16(bits))
    }
  })
})
