import { positiveFP16Values } from './fp16Reference'

// Independent reference: integer lattice in global units of 2^-48, with binary
// search over midpoint thresholds. No production APIs, normalization, or GRS.
const coordinates = positiveFP16Values.map((value) => BigInt(value * 2 ** 24))
const lattice = coordinates.map((value) => value << 24n)
const magnitude = (bits: number) => bits & 0x7fff
const nan = (bits: number) => magnitude(bits) > 0x7c00
const signaling = (bits: number) => nan(bits) && (bits & 512) === 0
const inf = (bits: number) => magnitude(bits) === 0x7c00
const zero = (bits: number) => magnitude(bits) === 0
function coordinate(bits: number): bigint {
  const value = coordinates[magnitude(bits)]
  return bits < 32768 ? value : -value
}
function roundedUnits(units: bigint, zeroSign: number): number {
  const sign = units < 0n || (units === 0n && zeroSign) ? 32768 : 0
  const abs = units < 0n ? -units : units
  if (abs >= 65520n << 48n) return sign + 0x7c00
  if (abs >= lattice[0x7bff]) return sign + 0x7bff
  if (!abs) return sign
  let lo = 0,
    hi = lattice.length - 1
  while (hi - lo > 1) {
    const mid = Math.floor((hi + lo) / 2)
    if (lattice[mid] < abs) lo = mid
    else hi = mid
  }
  const twice = 2n * abs,
    midpoint = lattice[lo] + lattice[hi]
  return (
    sign +
    (twice < midpoint ? lo : twice > midpoint ? hi : lo % 2 === 0 ? lo : hi)
  )
}

export function referenceMultiply(a: number, b: number, c?: number) {
  const operands = c === undefined ? [a, b] : [a, b, c]
  const productSign = (a >>> 15) ^ (b >>> 15)
  const badProduct = (zero(a) && inf(b)) || (zero(b) && inf(a))
  const selected = operands.find(signaling) ?? operands.find(nan)
  const flags = {
    invalid: operands.some(signaling) || badProduct,
    overflow: false,
    underflow: false,
    inexact: false,
  }
  const result = (bits: number, units: bigint | null) => ({
    bits,
    flags,
    units,
  })
  if (selected !== undefined) return result(selected | 512, null)
  if (badProduct) return result(0x7e00, null)
  if (inf(a) || inf(b)) {
    if (c !== undefined && inf(c) && productSign !== c >>> 15) {
      flags.invalid = true
      return result(0x7e00, null)
    }
    return result((productSign << 15) | 0x7c00, null)
  }
  if (c !== undefined && inf(c)) return result(c, null)
  const product = coordinate(a) * coordinate(b)
  const units = product + (c === undefined ? 0n : coordinate(c) << 24n)
  const zeroSign = c === undefined ? productSign : productSign && c >>> 15
  const bits = roundedUnits(units, zeroSign)
  flags.overflow = magnitude(bits) === 0x7c00
  flags.inexact = flags.overflow || coordinate(bits) << 24n !== units
  // Precision-only RNE's final midpoint below the smallest normal: 2^-14 - 2^-26.
  const abs = units < 0n ? -units : units
  flags.underflow = abs !== 0n && abs < 4095n << 22n && flags.inexact
  return result(bits, units)
}
