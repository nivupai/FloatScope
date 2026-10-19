import {
  decodeFP16,
  floatToFP16Bits,
  fp16BitsToFloat,
  nextDownFP16,
  nextUpFP16,
  ulpFP16,
} from './fp16'

const ZERO_RANK = 0x7bff
const FINITE_COUNT = 2 * ZERO_RANK + 1
export const MICROSCOPE_DOMAIN = 131072
export const MIN_VIEW_SPAN = 2 ** -30
export interface Viewport {
  min: number
  max: number
}
export interface LatticePoint {
  bits: number
  value: number
  ulp: number
}

/** Sorted finite numerical lattice; the single geometric zero uses +0 encoding. */
function bitsAtRank(rank: number): number {
  return rank < ZERO_RANK ? 0x8000 + ZERO_RANK - rank : rank - ZERO_RANK
}

/** Inclusive viewport, O(log N + limit); sampled entries are actual FP16 points. */
export function generateFP16Viewport(min: number, max: number, limit = 121) {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max ||
    !Number.isFinite(max - min)
  )
    throw new RangeError(
      'Viewport bounds must be finite, increasing, and have finite width',
    )
  if (!Number.isInteger(limit) || limit < 2 || limit > 512)
    throw new RangeError('Point limit must be an integer from 2 to 512')
  function bound(value: number, inclusive: boolean) {
    let low = 0
    let high = FINITE_COUNT
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      const current = fp16BitsToFloat(bitsAtRank(mid))
      if (current < value || (inclusive && current === value)) low = mid + 1
      else high = mid
    }
    return low
  }
  const first = bound(min, false)
  const end = bound(max, true)
  const total = end - first
  const rendered = Math.min(total, limit)
  const points: LatticePoint[] = []
  for (let i = 0; i < rendered; i += 1) {
    const rank =
      first +
      (rendered === 1 ? 0 : Math.floor((i * (total - 1)) / (rendered - 1)))
    const bits = bitsAtRank(rank)
    points.push({ bits, value: fp16BitsToFloat(bits), ulp: ulpFP16(bits) })
  }
  return { points, total, sampled: total > limit }
}

/** Plot-only constraints; input/rounding analysis is not restricted to this domain. */
export function fitViewport(center: number, span: number): Viewport {
  if (!Number.isFinite(center) || !Number.isFinite(span) || span <= 0)
    throw new RangeError('Finite center and positive finite span required')
  const width = Math.max(MIN_VIEW_SPAN, Math.min(2 * MICROSCOPE_DOMAIN, span))
  const bounded = Math.max(
    -MICROSCOPE_DOMAIN + width / 2,
    Math.min(MICROSCOPE_DOMAIN - width / 2, center),
  )
  return { min: bounded - width / 2, max: bounded + width / 2 }
}

export function viewportForTarget(value: number): Viewport {
  const bits = floatToFP16Bits(value)
  const spacing = ulpFP16(bits)
  const center = Number.isNaN(value)
    ? 0
    : Math.max(-65520, Math.min(65520, value))
  return fitViewport(center, Number.isFinite(spacing) ? spacing * 12 : 384)
}

export interface RoundingInterval {
  lower: number
  upper: number
  lowerIncluded: boolean
  upperIncluded: boolean
}

/** Real finite-input preimage under RNE; signed zeros additionally require sign. */
export function roundingIntervalFP16(bits: number): RoundingInterval | null {
  const d = decodeFP16(bits)
  if (d.classification === 'nan') return null
  if (d.classification === 'infinity')
    return d.sign === 0
      ? {
          lower: 65520,
          upper: Infinity,
          lowerIncluded: true,
          upperIncluded: false,
        }
      : {
          lower: -Infinity,
          upper: -65520,
          lowerIncluded: false,
          upperIncluded: true,
        }
  if (d.classification === 'zero')
    return d.sign === 0
      ? { lower: 0, upper: 2 ** -25, lowerIncluded: true, upperIncluded: true }
      : {
          lower: -(2 ** -25),
          upper: -0,
          lowerIncluded: true,
          upperIncluded: true,
        }
  const previous = fp16BitsToFloat(nextDownFP16(bits))
  const next = fp16BitsToFloat(nextUpFP16(bits))
  // The virtual next unbounded-binade value is ±65536, not infinity.
  const lower = (d.value + (Number.isFinite(previous) ? previous : -65536)) / 2
  const upper = (d.value + (Number.isFinite(next) ? next : 65536)) / 2
  const even = bits % 2 === 0
  return { lower, upper, lowerIncluded: even, upperIncluded: even }
}

export function analyzeFP16Rounding(input: number) {
  const bits = floatToFP16Bits(input)
  const decoded = decodeFP16(bits)
  const value = decoded.value
  const interval = roundingIntervalFP16(bits)
  const finiteInput = Number.isFinite(input)
  const absoluteError = finiteInput ? Math.abs(value - input) : null
  const relativeError =
    absoluteError !== null && input !== 0
      ? absoluteError / Math.abs(input)
      : null
  const tie =
    finiteInput &&
    input !== 0 &&
    interval !== null &&
    (input === interval.lower || input === interval.upper)
  const direction = Number.isNaN(input)
    ? 'Unordered (NaN)'
    : Object.is(input, value)
      ? 'Exact (no rounding)'
      : value > input
        ? 'Toward +Infinity'
        : 'Toward -Infinity'
  return {
    input,
    bits,
    decoded,
    interval,
    absoluteError,
    relativeError,
    tie,
    direction,
    previous: {
      bits: nextDownFP16(bits),
      value: fp16BitsToFloat(nextDownFP16(bits)),
    },
    next: { bits: nextUpFP16(bits), value: fp16BitsToFloat(nextUpFP16(bits)) },
  }
}

/** Positive magnitude regions; zero is excluded from the logarithmic x axis. */
export function fp16ULPRegions() {
  const regions = [
    {
      label: 'Subnormals',
      lower: 2 ** -24,
      upper: 2 ** -14,
      bits: 1,
      exponent: null as number | null,
      ulp: ulpFP16(1),
    },
  ]
  for (let exponent = 1; exponent <= 30; exponent += 1) {
    const bits = exponent << 10
    const d = decodeFP16(bits)
    regions.push({
      label: `Normal binade 2^${d.unbiasedExponent}`,
      lower: d.value,
      upper: 2 * d.value,
      bits,
      exponent: d.unbiasedExponent,
      ulp: ulpFP16(bits),
    })
  }
  return regions
}
