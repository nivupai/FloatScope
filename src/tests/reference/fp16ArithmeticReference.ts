import { positiveFP16Values, referenceEncodeFP16 } from './fp16Reference'

/** Test-only lattice decoder: no production decoding/encoding/arithmetic imports. */
function valueFromLattice(bits: number): number {
  const magnitude = bits % 32768
  const sign = bits < 32768 ? 1 : -1
  return magnitude < 0x7c00
    ? sign * positiveFP16Values[magnitude]
    : magnitude === 0x7c00
      ? sign * Infinity
      : NaN
}
const nan = (bits: number) => bits % 32768 > 0x7c00
const signaling = (bits: number) => nan(bits) && (bits & 512) === 0

export function referenceFP16Arithmetic(
  a: number,
  b: number,
  operation: 'add' | 'subtract',
) {
  const invalidNaN = signaling(a) || signaling(b)
  if (nan(a) || nan(b)) {
    const selected = signaling(a) ? a : signaling(b) ? b : nan(a) ? a : b
    return {
      bits: selected | 512,
      flags: {
        invalid: invalidNaN,
        overflow: false,
        underflow: false,
        inexact: false,
      },
      exact: null,
    }
  }
  // Independent finite reference: all FP16 operands are integers times 2^-24.
  // The largest possible sum coordinate is <2^41, so binary64 addition/subtraction
  // is exact (53-bit precision), including cancellation. Lattice search rounds once.
  const x = valueFromLattice(a)
  const y = valueFromLattice(b)
  const sum = operation === 'add' ? x + y : x - y
  if (Number.isNaN(sum))
    return {
      bits: 0x7e00,
      flags: {
        invalid: true,
        overflow: false,
        underflow: false,
        inexact: false,
      },
      exact: null,
    }
  const bits = referenceEncodeFP16(sum)
  const quantized = valueFromLattice(bits)
  const finite = Number.isFinite(x) && Number.isFinite(y)
  return {
    bits,
    exact: finite ? sum : null,
    flags: {
      invalid: false,
      overflow: finite && !Number.isFinite(quantized),
      underflow: false,
      inexact: finite && !Object.is(sum, quantized),
    },
  }
}
