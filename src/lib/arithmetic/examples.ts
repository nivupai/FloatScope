import type { FP16Operation } from '../numerics/fp16Arithmetic'

export interface ArithmeticExample {
  label: string
  a: number
  b: number
  operation: FP16Operation
  expected: number
  explanation: string
}
export const ARITHMETIC_EXAMPLES: readonly ArithmeticExample[] = [
  {
    label: 'Exact addition',
    a: 0x3c00,
    b: 0x3800,
    operation: 'add',
    expected: 0x3e00,
    explanation:
      '1 + 0.5 = 1.5 exactly. Alignment shifts the smaller significand by one position; no bits are discarded in rounding.',
  },
  {
    label: 'Large exponent difference',
    a: 0x3c00,
    b: 0x0001,
    operation: 'add',
    expected: 0x3c00,
    explanation:
      '1 + 2^-24 rounds back to 1. The entire tiny contribution is retained during alignment; a sticky bit later records that the discarded tail is nonzero.',
  },
  {
    label: 'Tie to even',
    a: 0x3c00,
    b: 0x1000,
    operation: 'add',
    expected: 0x3c00,
    explanation:
      '1 + 2^-11 is an exact halfway case. G=1, R=0, S=0; the retained significand at 1 is even, so it does not increment.',
  },
  {
    label: 'Cancellation',
    a: 0x3c01,
    b: 0x3c00,
    operation: 'subtract',
    expected: 0x1400,
    explanation:
      '1.0009765625 - 1 = 2^-10. Cancellation exposes low-order bits and normalization shifts the result left by ten positions without losing precision.',
  },
  {
    label: 'Subnormal arithmetic',
    a: 0x0001,
    b: 0x0001,
    operation: 'add',
    expected: 0x0002,
    explanation:
      'Two minimum subnormals sum exactly to 2^-23. A tiny exact result does not raise underflow under the tiny-and-inexact rule.',
  },
  {
    label: 'Subnormal to normal',
    a: 0x03ff,
    b: 0x0001,
    operation: 'add',
    expected: 0x0400,
    explanation:
      'The largest subnormal plus one minimum-subnormal quantum becomes the smallest normal, exactly. There is no spacing jump at this boundary.',
  },
  {
    label: 'Overflow',
    a: 0x7bff,
    b: 0x4c00,
    operation: 'add',
    expected: 0x7c00,
    explanation:
      '65504 + 16 = 65520, the overflow midpoint. Even rounding carries to virtual 65536, producing Infinity with overflow and inexact set.',
  },
  {
    label: 'Infinity arithmetic',
    a: 0x7c00,
    b: 0x3c00,
    operation: 'add',
    expected: 0x7c00,
    explanation:
      'Positive infinity plus a finite value stays positive infinity. Ordinary alignment and rounding stages are bypassed.',
  },
  {
    label: 'Invalid infinities',
    a: 0x7c00,
    b: 0x7c00,
    operation: 'subtract',
    expected: 0x7e00,
    explanation:
      'Infinity - Infinity is invalid. This implementation returns canonical positive quiet NaN 0x7e00 and sets invalid, without inventing finite pipeline stages.',
  },
  {
    label: 'Signaling NaN',
    a: 0x7c01,
    b: 0x3c00,
    operation: 'add',
    expected: 0x7e01,
    explanation:
      'Signaling NaN payload 1 is quieted, preserves sign and payload, and sets invalid. The deterministic payload-selection rule is a FloatScope policy, not a mandated universal hardware choice.',
  },
]
