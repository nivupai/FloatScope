import type { ArithmeticFlags, ArithmeticStage } from './fp16Arithmetic'

export type RoundingStage = Extract<
  ArithmeticStage,
  { kind: 'normalize' | 'grs' | 'round' }
>
export function clearArithmeticFlags(): ArithmeticFlags {
  return { invalid: false, overflow: false, underflow: false, inexact: false }
}

/** Internal finite dyadic rounding shared by add/sub, multiply, and FMA.
 * Magnitude is nonnegative and multiplies 2^quantumExponent. No Number rounding.
 */
export function roundDyadicFP16(
  magnitude: bigint,
  quantumExponent: number,
  sign: 0 | 1,
): {
  bits: number
  flags: ArithmeticFlags
  trace: RoundingStage[]
} {
  const flags = clearArithmeticFlags()
  const trace: RoundingStage[] = []
  const leadingBitIndex =
    magnitude === 0n ? null : magnitude.toString(2).length - 1
  const exactExponent =
    leadingBitIndex === null ? null : leadingBitIndex + quantumExponent
  const encodingExponent = Math.max(-14, exactExponent ?? -14)
  const outputQuantum = encodingExponent - 10
  const shift = outputQuantum - quantumExponent
  const retained =
    shift > 0 ? magnitude >> BigInt(shift) : magnitude << BigInt(-shift)
  trace.push({
    kind: 'normalize',
    magnitude,
    leadingBitIndex,
    exactExponent,
    encodingExponent,
    quantumExponent: outputQuantum,
    shift,
    retained,
  })
  const discardCount = Math.max(0, shift)
  const remainder = shift > 0 ? magnitude - (retained << BigInt(shift)) : 0n
  const guard = (
    shift >= 1 ? Number((magnitude >> BigInt(shift - 1)) & 1n) : 0
  ) as 0 | 1
  const round = (
    shift >= 2 ? Number((magnitude >> BigInt(shift - 2)) & 1n) : 0
  ) as 0 | 1
  const sticky = (
    shift >= 3 && (magnitude & ((1n << BigInt(shift - 2)) - 1n)) !== 0n ? 1 : 0
  ) as 0 | 1
  trace.push({
    kind: 'grs',
    guard,
    round,
    sticky,
    discardCount,
    discardedBits: discardCount
      ? remainder.toString(2).padStart(discardCount, '0')
      : '',
    remainder,
  })
  const retainedWasOdd = (retained & 1n) !== 0n
  const halfway = guard === 1 && round === 0 && sticky === 0
  const increment =
    guard === 1 && (round === 1 || sticky === 1 || retainedWasOdd)
  const rounded = retained + (increment ? 1n : 0n)
  const carry = rounded === 2048n
  const finalSignificand = carry ? rounded >> 1n : rounded
  const finalExponent = encodingExponent + (carry ? 1 : 0)
  // RNE at eleven-bit precision with unbounded exponents reaches 2^-14 at
  // 2^-14 - 2^-26 = 4095 * 2^-26. Its even midpoint belongs to the normal side.
  // This is a predicate, not intermediate rounding of the result. A final normal
  // 0x0400 can still raise underflow if precision-only rounding remains tiny.
  const tinyAfterPrecisionRounding =
    magnitude !== 0n &&
    (quantumExponent >= -26
      ? magnitude << BigInt(quantumExponent + 26) < 4095n
      : magnitude < 4095n << BigInt(-26 - quantumExponent))
  trace.push({
    kind: 'round',
    increment,
    halfway,
    retainedWasOdd,
    rounded,
    carry,
    finalSignificand,
    finalExponent,
    tinyAfterPrecisionRounding,
  })
  flags.overflow = finalExponent > 15
  flags.inexact = remainder !== 0n || flags.overflow
  let bits: number
  if (flags.overflow) bits = (sign << 15) | 0x7c00
  else if (
    finalSignificand === 0n ||
    (finalExponent === -14 && finalSignificand < 1024n)
  )
    bits = (sign << 15) | Number(finalSignificand)
  else
    bits =
      (sign << 15) |
      ((finalExponent + 15) << 10) |
      Number(finalSignificand - 1024n)
  // Tininess after rounding AND inexact; exact tiny results never raise underflow.
  flags.underflow = tinyAfterPrecisionRounding && flags.inexact
  return { bits, flags, trace }
}
