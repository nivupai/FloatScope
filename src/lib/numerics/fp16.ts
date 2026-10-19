/** IEEE 754 binary16 classification; the sign of zero/infinity is in `sign`. */
export type FP16Classification =
  'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan'

export interface DecodedFP16 {
  readonly bits: number
  readonly sign: 0 | 1
  readonly exponent: number
  readonly fraction: number
  /** Normal exponent, or -14 for subnormals; null for zero/infinity/NaN. */
  readonly unbiasedExponent: number | null
  readonly classification: FP16Classification
  /** Exact for finite binary16, including -0; NaN payload/sign live in raw fields. */
  readonly value: number
  readonly hasImplicitLeadingBit: boolean
  /** null for non-NaNs; binary16's most significant fraction bit marks quiet NaNs. */
  readonly isQuietNaN: boolean | null
  /** The low nine fraction bits, excluding the quiet bit; null for non-NaNs. */
  readonly nanPayload: number | null
}

const SIGN_MASK = 0x8000
const MAGNITUDE_MASK = 0x7fff
const INFINITY_BITS = 0x7c00
const CANONICAL_NAN = 0x7e00

function assertFP16Bits(bits: number): void {
  if (!Number.isInteger(bits) || bits < 0 || bits > 0xffff) {
    throw new RangeError('FP16 bits must be an integer from 0 to 65535')
  }
}

/** Round a nonnegative integer divided by 2**shift, with exact ties-to-even. */
function roundRightTiesToEven(significand: bigint, shift: number): bigint {
  const width = BigInt(shift)
  const retained = significand >> width
  const remainder = significand - (retained << width)
  const halfway = 1n << (width - 1n)
  return remainder > halfway ||
    (remainder === halfway && (retained & 1n) === 1n)
    ? retained + 1n
    : retained
}

/**
 * Round a JavaScript binary64 Number directly to binary16 (nearest, ties-to-even).
 * Preserves signed zero. Every NaN encodes as the positive quiet NaN 0x7e00.
 * No binary32 intermediate or native FP16 conversion is used.
 */
export function floatToFP16Bits(value: number): number {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value, false)
  const raw = view.getBigUint64(0, false)
  const sign = Number(raw >> 63n) << 15
  const exponent = Number((raw >> 52n) & 0x7ffn)
  const fraction = raw & 0xfffffffffffffn

  if (exponent === 0x7ff) {
    return fraction === 0n ? sign | INFINITY_BITS : CANONICAL_NAN
  }

  // The input equals significand * 2**sourceExponent, exactly.
  const significand = exponent === 0 ? fraction : (1n << 52n) | fraction
  const sourceExponent = exponent === 0 ? -1074 : exponent - 1023 - 52
  let unbiasedExponent = exponent === 0 ? -1022 : exponent - 1023

  if (unbiasedExponent < -14) {
    // All subnormals share the quantum 2**-24. A carry to 1024 produces
    // 0x0400, the smallest normal, without any second rounding step.
    const rounded = roundRightTiesToEven(significand, -24 - sourceExponent)
    return sign | Number(rounded)
  }

  if (unbiasedExponent > 15) return sign | INFINITY_BITS

  // Keep eleven significant bits (one implicit + ten stored) from binary64's
  // 53-bit significand. BigInt retains every discarded bit for the tie test.
  let rounded = roundRightTiesToEven(significand, 42)
  if (rounded === 2048n) {
    rounded = 1024n
    unbiasedExponent += 1
  }
  if (unbiasedExponent > 15) return sign | INFINITY_BITS

  return sign | ((unbiasedExponent + 15) << 10) | Number(rounded - 1024n)
}

/** Inspect a raw uint16 pattern without losing its NaN payload or sign. */
export function decodeFP16(bits: number): DecodedFP16 {
  assertFP16Bits(bits)
  const sign = (bits >>> 15) as 0 | 1
  const exponent = (bits >>> 10) & 0x1f
  const fraction = bits & 0x3ff
  const polarity = sign === 0 ? 1 : -1
  let classification: FP16Classification
  let value: number
  let unbiasedExponent: number | null = null

  if (exponent === 0) {
    classification = fraction === 0 ? 'zero' : 'subnormal'
    if (fraction !== 0) unbiasedExponent = -14
    value = polarity * fraction * 2 ** -24
  } else if (exponent === 0x1f) {
    classification = fraction === 0 ? 'infinity' : 'nan'
    value = fraction === 0 ? polarity * Infinity : NaN
  } else {
    classification = 'normal'
    unbiasedExponent = exponent - 15
    value = polarity * (1024 + fraction) * 2 ** (unbiasedExponent - 10)
  }

  return {
    bits,
    sign,
    exponent,
    fraction,
    unbiasedExponent,
    classification,
    value,
    hasImplicitLeadingBit: classification === 'normal',
    isQuietNaN: classification === 'nan' ? (fraction & 0x200) !== 0 : null,
    nanPayload: classification === 'nan' ? fraction & 0x1ff : null,
  }
}

/** Decode to an exact Number; raw NaN payloads/signs are not retained in Number. */
export function fp16BitsToFloat(bits: number): number {
  return decodeFP16(bits).value
}

/** Exactly sixteen binary digits, sign first, with no separators. */
export function formatFP16Bits(bits: number): string {
  assertFP16Bits(bits)
  return bits.toString(2).padStart(16, '0')
}

/** Lowercase hexadecimal with a 0x prefix and exactly four digits. */
export function fp16BitsToHex(bits: number): string {
  assertFP16Bits(bits)
  return `0x${bits.toString(16).padStart(4, '0')}`
}

/**
 * Return the raw bits of the least binary16 value strictly greater than the input.
 * Both zeros step to +minimum subnormal. +Infinity saturates. NaNs retain raw bits.
 */
export function nextUpFP16(bits: number): number {
  assertFP16Bits(bits)
  const magnitude = bits & MAGNITUDE_MASK
  if (magnitude > INFINITY_BITS || bits === INFINITY_BITS) return bits
  if (magnitude === 0) return 0x0001
  return (bits & SIGN_MASK) !== 0 ? bits - 1 : bits + 1
}

/**
 * Return the raw bits of the greatest binary16 value strictly less than the input.
 * Both zeros step to -minimum subnormal. -Infinity saturates. NaNs retain raw bits.
 */
export function nextDownFP16(bits: number): number {
  assertFP16Bits(bits)
  const magnitude = bits & MAGNITUDE_MASK
  if (magnitude > INFINITY_BITS || bits === (SIGN_MASK | INFINITY_BITS))
    return bits
  if (magnitude === 0) return 0x8001
  return (bits & SIGN_MASK) !== 0 ? bits + 1 : bits - 1
}

/**
 * Binade ULP, in numeric units, for a raw pattern: 2**max(e - 10, -24).
 * Sign-independent; 2**-24 at zero/subnormals, 32 at maximum finite,
 * Infinity at either infinity, NaN at NaNs. At a power of two this is the
 * spacing on the larger-magnitude side, not necessarily nextUp(x) - x.
 */
export function ulpFP16(bits: number): number {
  const decoded = decodeFP16(bits)
  if (decoded.classification === 'nan') return NaN
  if (decoded.classification === 'infinity') return Infinity
  return 2 ** Math.max((decoded.unbiasedExponent ?? -14) - 10, -24)
}

/** Signed zeros and infinities are representable; NaN is excluded by policy. */
export function isExactlyRepresentableFP16(value: number): boolean {
  return (
    !Number.isNaN(value) &&
    Object.is(fp16BitsToFloat(floatToFP16Bits(value)), value)
  )
}
