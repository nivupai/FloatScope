import { decodeFP16 } from './fp16'
import type { DecodedFP16 } from './fp16'

export type FP16Operation = 'add' | 'subtract'
export interface ArithmeticFlags {
  invalid: boolean
  overflow: boolean
  underflow: boolean
  inexact: boolean
}
export interface ExactDyadic {
  coefficient: bigint
  exponent: number
  /** Exact binary64 display projection: any finite FP16 sum needs at most 41 bits. */
  value: number
}
export interface FiniteSignificand {
  sign: 0 | 1
  exponent: number
  significand: bigint
}
export interface AlignmentData {
  commonExponent: number
  fractionalBits: number
  shiftRightA: number
  shiftRightB: number
  alignedA: bigint
  alignedB: bigint
  /** aligned integers multiply this exact power of two. */
  quantumExponent: number
}
export interface NormalizationData {
  magnitude: bigint
  leadingBitIndex: number | null
  exactExponent: number | null
  encodingExponent: number
  quantumExponent: number
  /** Positive: discard low bits; negative: shift left after cancellation. */
  shift: number
  retained: bigint
}
export interface RoundingBitsData {
  guard: 0 | 1
  round: 0 | 1
  sticky: 0 | 1
  discardCount: number
  discardedBits: string
  remainder: bigint
}
export interface RoundingDecision {
  increment: boolean
  halfway: boolean
  retainedWasOdd: boolean
  rounded: bigint
  carry: boolean
  finalSignificand: bigint
  finalExponent: number
}
export type ArithmeticStage =
  | { kind: 'decode'; a: DecodedFP16; b: DecodedFP16; effectiveBSign: 0 | 1 }
  | {
      kind: 'compare'
      a: FiniteSignificand
      b: FiniteSignificand
      difference: number
    }
  | ({ kind: 'align' } & AlignmentData)
  | {
      kind: 'arithmetic'
      signedA: bigint
      signedB: bigint
      sum: bigint
      exponent: number
    }
  | ({ kind: 'normalize' } & NormalizationData)
  | ({ kind: 'grs' } & RoundingBitsData)
  | ({ kind: 'round' } & RoundingDecision)
  | {
      kind: 'special'
      reason: 'nan' | 'invalid-infinities' | 'infinity'
      selectedNaNOperand: 'A' | 'B' | null
      signaling: boolean
    }
  | {
      kind: 'encode'
      bits: number
      decoded: DecodedFP16
      flags: ArithmeticFlags
    }

export interface FP16ArithmeticResult {
  operation: FP16Operation
  aBits: number
  bBits: number
  bits: number
  decoded: DecodedFP16
  flags: ArithmeticFlags
  roundingMode: 'nearest-even'
  tininessDetection: 'after-rounding'
  exact: ExactDyadic | null
  trace: ArithmeticStage[]
}

function finiteSignificand(
  decoded: DecodedFP16,
  sign: 0 | 1,
): FiniteSignificand {
  return {
    sign,
    exponent: decoded.unbiasedExponent ?? -14,
    significand: BigInt(
      decoded.fraction + (decoded.hasImplicitLeadingBit ? 1024 : 0),
    ),
  }
}

/**
 * Raw binary16 add/subtract, exact dyadic arithmetic and one nearest-even rounding.
 * NaN policy: first signaling NaN, otherwise first quiet NaN, in A/B order.
 * Quiet the selected pattern, preserving its original sign and low nine payload bits.
 * Invalid infinity combinations return canonical positive quiet NaN 0x7e00.
 */
export function calculateFP16(
  aBits: number,
  bBits: number,
  operation: FP16Operation,
): FP16ArithmeticResult {
  const a = decodeFP16(aBits)
  const b = decodeFP16(bBits)
  if (operation !== 'add' && operation !== 'subtract')
    throw new RangeError('Operation must be add or subtract')
  const effectiveBSign = (b.sign ^ (operation === 'subtract' ? 1 : 0)) as 0 | 1
  const flags: ArithmeticFlags = {
    invalid: false,
    overflow: false,
    underflow: false,
    inexact: false,
  }
  const trace: ArithmeticStage[] = [{ kind: 'decode', a, b, effectiveBSign }]
  function finish(
    bits: number,
    exact: ExactDyadic | null,
  ): FP16ArithmeticResult {
    const decoded = decodeFP16(bits)
    trace.push({ kind: 'encode', bits, decoded, flags: { ...flags } })
    return {
      operation,
      aBits,
      bBits,
      bits,
      decoded,
      flags,
      roundingMode: 'nearest-even',
      tininessDetection: 'after-rounding',
      exact,
      trace,
    }
  }

  const operands = [
    { name: 'A' as const, decoded: a },
    { name: 'B' as const, decoded: b },
  ]
  const signaling = operands.find(
    (operand) =>
      operand.decoded.classification === 'nan' && !operand.decoded.isQuietNaN,
  )
  const nan =
    signaling ??
    operands.find((operand) => operand.decoded.classification === 'nan')
  if (nan) {
    flags.invalid = signaling !== undefined
    trace.push({
      kind: 'special',
      reason: 'nan',
      selectedNaNOperand: nan.name,
      signaling: flags.invalid,
    })
    return finish(nan.decoded.bits | 0x0200, null)
  }
  if (a.classification === 'infinity' || b.classification === 'infinity') {
    if (
      a.classification === 'infinity' &&
      b.classification === 'infinity' &&
      a.sign !== effectiveBSign
    ) {
      flags.invalid = true
      trace.push({
        kind: 'special',
        reason: 'invalid-infinities',
        selectedNaNOperand: null,
        signaling: false,
      })
      return finish(0x7e00, null)
    }
    trace.push({
      kind: 'special',
      reason: 'infinity',
      selectedNaNOperand: null,
      signaling: false,
    })
    return finish(
      ((a.classification === 'infinity' ? a.sign : effectiveBSign) << 15) |
        0x7c00,
      null,
    )
  }

  const fa = finiteSignificand(a, a.sign)
  const fb = finiteSignificand(b, effectiveBSign)
  const commonExponent = Math.max(fa.exponent, fb.exponent)
  const minimumExponent = Math.min(fa.exponent, fb.exponent)
  const fractionalBits = commonExponent - minimumExponent
  const quantumExponent = minimumExponent - 10
  const alignedA = fa.significand << BigInt(fa.exponent - minimumExponent)
  const alignedB = fb.significand << BigInt(fb.exponent - minimumExponent)
  trace.push({
    kind: 'compare',
    a: fa,
    b: fb,
    difference: fa.exponent - fb.exponent,
  })
  // Right-align to the larger exponent conceptually, but retain the complete tail
  // as fixed-point bits. No premature sticky-bit compression or intermediate rounding.
  trace.push({
    kind: 'align',
    commonExponent,
    fractionalBits,
    shiftRightA: commonExponent - fa.exponent,
    shiftRightB: commonExponent - fb.exponent,
    alignedA,
    alignedB,
    quantumExponent,
  })
  const signedA = fa.sign === 1 ? -alignedA : alignedA
  const signedB = fb.sign === 1 ? -alignedB : alignedB
  const sum = signedA + signedB
  trace.push({
    kind: 'arithmetic',
    signedA,
    signedB,
    sum,
    exponent: quantumExponent,
  })
  // RNE cancellation is +0, except when both effective operands are negative zero.
  const sign =
    sum < 0n || (sum === 0n && fa.sign === 1 && fb.sign === 1) ? 1 : 0
  const magnitude = sum < 0n ? -sum : sum
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
  trace.push({
    kind: 'round',
    increment,
    halfway,
    retainedWasOdd,
    rounded,
    carry,
    finalSignificand,
    finalExponent,
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
  // Tininess after rounding AND inexact. For binary16 add/sub only, tiny results
  // are exact multiples of 2**-24, so underflow cannot be raised by valid operands.
  flags.underflow = !flags.overflow && (bits & 0x7c00) === 0 && flags.inexact
  const exactValue =
    sum === 0n && sign === 1 ? -0 : Number(sum) * 2 ** quantumExponent
  return finish(bits, {
    coefficient: sum,
    exponent: quantumExponent,
    value: exactValue,
  })
}

export function addFP16(aBits: number, bBits: number): FP16ArithmeticResult {
  return calculateFP16(aBits, bBits, 'add')
}
export function subtractFP16(
  aBits: number,
  bBits: number,
): FP16ArithmeticResult {
  return calculateFP16(aBits, bBits, 'subtract')
}
