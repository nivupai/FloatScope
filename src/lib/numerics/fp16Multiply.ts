import { decodeFP16 } from './fp16'
import type { DecodedFP16 } from './fp16'
import { addFP16 } from './fp16Arithmetic'
import type {
  ArithmeticFlags,
  ArithmeticStage,
  ExactDyadic,
  FP16ArithmeticResult,
} from './fp16Arithmetic'
import { clearArithmeticFlags, roundDyadicFP16 } from './roundDyadicFP16'

type SharedStage = Extract<
  ArithmeticStage,
  { kind: 'normalize' | 'grs' | 'round' | 'arithmetic' | 'encode' }
>
export type MultiplyStage =
  | SharedStage
  | { kind: 'decode-multiply'; a: DecodedFP16; b: DecodedFP16 }
  | { kind: 'decode-fma'; a: DecodedFP16; b: DecodedFP16; c: DecodedFP16 }
  | { kind: 'product-sign'; signA: 0 | 1; signB: 0 | 1; sign: 0 | 1 }
  | {
      kind: 'multiply'
      significandA: bigint
      significandB: bigint
      product: bigint
      sign: 0 | 1
      exponentA: number
      exponentB: number
      exponent: number
    }
  | {
      kind: 'product-exponent'
      exponentA: number
      exponentB: number
      exponent: number
    }
  | {
      kind: 'align-product'
      product: bigint
      addend: bigint
      productExponent: number
      addendExponent: number
      shiftProduct: number
      shiftAddend: number
      alignedProduct: bigint
      alignedAddend: bigint
      exponent: number
    }
  | {
      kind: 'multiply-special'
      reason: 'nan' | 'zero-times-infinity' | 'opposing-infinities' | 'infinity'
      selectedNaNOperand: 'A' | 'B' | 'C' | null
      signaling: boolean
      invalidProduct: boolean
    }

export interface FP16MultiplyResult {
  operation: 'multiply' | 'fma'
  aBits: number
  bBits: number
  cBits: number | null
  bits: number
  decoded: DecodedFP16
  exact: ExactDyadic | null
  /** Unrounded finite a*b, including when finite FMA's final sum overflows. */
  exactProduct: ExactDyadic | null
  flags: ArithmeticFlags
  roundingMode: 'nearest-even'
  tininessDetection: 'after-rounding'
  trace: MultiplyStage[]
}

function significand(x: DecodedFP16): bigint {
  return BigInt(x.fraction + (x.hasImplicitLeadingBit ? 1024 : 0))
}
function scale(x: DecodedFP16): number {
  return (x.unbiasedExponent ?? -14) - 10
}
function dyadic(
  coefficient: bigint,
  exponent: number,
  zeroSign: 0 | 1,
): ExactDyadic {
  return {
    coefficient,
    exponent,
    value:
      coefficient === 0n && zeroSign ? -0 : Number(coefficient) * 2 ** exponent,
  }
}

/** Exact raw FP16 multiply; shared nearest-even rounding and tininess after rounding. */
export function multiplyFP16(a: number, b: number): FP16MultiplyResult {
  return calculateProduct(a, b, null)
}
/** True FMA: no intermediate product rounding, range restriction, or exception. */
export function fmaFP16(a: number, b: number, c: number): FP16MultiplyResult {
  return calculateProduct(a, b, c)
}

function calculateProduct(
  aBits: number,
  bBits: number,
  cBits: number | null,
): FP16MultiplyResult {
  const a = decodeFP16(aBits),
    b = decodeFP16(bBits)
  const c = cBits === null ? null : decodeFP16(cBits)
  const trace: MultiplyStage[] = [
    c ? { kind: 'decode-fma', a, b, c } : { kind: 'decode-multiply', a, b },
  ]
  const flags = clearArithmeticFlags()
  let exactProduct: ExactDyadic | null = null
  const signProduct = (a.sign ^ b.sign) as 0 | 1
  const zero = (x: DecodedFP16) => x.classification === 'zero'
  const infinity = (x: DecodedFP16) => x.classification === 'infinity'
  const invalidProduct = (zero(a) && infinity(b)) || (infinity(a) && zero(b))
  const operands = [
    { name: 'A' as const, decoded: a },
    { name: 'B' as const, decoded: b },
    ...(c ? [{ name: 'C' as const, decoded: c }] : []),
  ]
  const signaling = operands.find(
    ({ decoded }) => decoded.classification === 'nan' && !decoded.isQuietNaN,
  )
  const nan =
    signaling ??
    operands.find(({ decoded }) => decoded.classification === 'nan')
  flags.invalid = !!signaling || invalidProduct

  function finish(bits: number, exact: ExactDyadic | null): FP16MultiplyResult {
    const decoded = decodeFP16(bits)
    trace.push({ kind: 'encode', bits, decoded, flags: { ...flags } })
    return {
      operation: c ? 'fma' : 'multiply',
      aBits,
      bBits,
      cBits,
      bits,
      decoded,
      exact,
      exactProduct,
      flags,
      roundingMode: 'nearest-even',
      tininessDetection: 'after-rounding',
      trace,
    }
  }
  function special(
    reason: Extract<MultiplyStage, { kind: 'multiply-special' }>['reason'],
    bits: number,
  ) {
    trace.push({
      kind: 'multiply-special',
      reason,
      selectedNaNOperand: nan?.name ?? null,
      signaling: !!signaling,
      invalidProduct,
    })
    return finish(bits, null)
  }
  // Check invalid zero*infinity even when C is a quiet NaN; still propagate C's payload.
  if (nan) return special('nan', nan.decoded.bits | 0x0200)
  if (invalidProduct) return special('zero-times-infinity', 0x7e00)
  const infiniteProduct = infinity(a) || infinity(b)
  if (infiniteProduct && c && infinity(c) && signProduct !== c.sign) {
    flags.invalid = true
    return special('opposing-infinities', 0x7e00)
  }
  if (infiniteProduct || (c && infinity(c)))
    return special(
      'infinity',
      ((infiniteProduct ? signProduct : c!.sign) << 15) | 0x7c00,
    )

  const ma = significand(a),
    mb = significand(b)
  const exponentA = scale(a),
    exponentB = scale(b)
  const product = ma * mb
  const productExponent = exponentA + exponentB
  const signedProduct = signProduct ? -product : product
  exactProduct = dyadic(signedProduct, productExponent, signProduct)
  if (!c)
    trace.push({
      kind: 'product-sign',
      signA: a.sign,
      signB: b.sign,
      sign: signProduct,
    })
  trace.push({
    kind: 'multiply',
    significandA: ma,
    significandB: mb,
    product,
    sign: signProduct,
    exponentA,
    exponentB,
    exponent: productExponent,
  })
  let coefficient = signedProduct,
    exponent = productExponent,
    sign = signProduct
  if (c) {
    const addend = significand(c),
      addendExponent = scale(c)
    exponent = Math.min(productExponent, addendExponent)
    const shiftProduct = productExponent - exponent,
      shiftAddend = addendExponent - exponent
    const alignedProduct = product << BigInt(shiftProduct),
      alignedAddend = addend << BigInt(shiftAddend)
    trace.push({
      kind: 'align-product',
      product,
      addend,
      productExponent,
      addendExponent,
      shiftProduct,
      shiftAddend,
      alignedProduct,
      alignedAddend,
      exponent,
    })
    const signedA = signProduct ? -alignedProduct : alignedProduct
    const signedB = c.sign ? -alignedAddend : alignedAddend
    coefficient = signedA + signedB
    trace.push({
      kind: 'arithmetic',
      signedA,
      signedB,
      sum: coefficient,
      exponent,
    })
    // Exact nonzero cancellation is +0. Equal-sign zero terms retain that sign.
    sign =
      coefficient < 0n ||
      (coefficient === 0n && signProduct === 1 && c.sign === 1)
        ? 1
        : 0
  } else {
    trace.push({
      kind: 'product-exponent',
      exponentA,
      exponentB,
      exponent: productExponent,
    })
  }
  const rounded = roundDyadicFP16(
    coefficient < 0n ? -coefficient : coefficient,
    exponent,
    sign,
  )
  trace.push(...rounded.trace)
  Object.assign(flags, rounded.flags)
  return finish(rounded.bits, dyadic(coefficient, exponent, sign))
}

export interface NonfusedMultiplyAddResult {
  product: FP16MultiplyResult
  addition: FP16ArithmeticResult
  bits: number
  decoded: DecodedFP16
  /** Union of the separately rounded multiply and add indicators. */
  flags: ArithmeticFlags
}
export function nonfusedMultiplyAddFP16(
  a: number,
  b: number,
  c: number,
): NonfusedMultiplyAddResult {
  decodeFP16(c) // Validate all raw operands before executing either operation.
  const product = multiplyFP16(a, b)
  const addition = addFP16(product.bits, c)
  const flags = clearArithmeticFlags()
  for (const key of Object.keys(flags) as (keyof ArithmeticFlags)[])
    flags[key] = product.flags[key] || addition.flags[key]
  return {
    product,
    addition,
    bits: addition.bits,
    decoded: addition.decoded,
    flags,
  }
}

export function compareMultiplyAddFP16(a: number, b: number, c: number) {
  const fused = fmaFP16(a, b, c),
    nonfused = nonfusedMultiplyAddFP16(a, b, c)
  // Difference of two finite FP16 values is exact in binary64 (global grid <2^41).
  const difference =
    Number.isFinite(fused.decoded.value) &&
    Number.isFinite(nonfused.decoded.value)
      ? fused.decoded.value - nonfused.decoded.value
      : null
  return { fused, nonfused, difference }
}
