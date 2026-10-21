export interface MultiplyExample {
  label: string
  a: number
  b: number
  c?: number
  operation: 'multiply' | 'fma'
  expected: number
  nonfused?: number
  explanation: string
}
/** Explicit vectors checked by an independent lattice oracle and SoftFloat. */
export const MULTIPLY_EXAMPLES: readonly MultiplyExample[] = [
  {
    label: 'Exact multiplication',
    a: 0x3e00,
    b: 0x4000,
    operation: 'multiply',
    expected: 0x4200,
    explanation:
      '1.5 × 2 = 3 exactly. All product bits fit; no rounding flags are raised.',
  },
  {
    label: 'Product sign and exponent',
    a: 0xc000,
    b: 0x4200,
    operation: 'multiply',
    expected: 0xc600,
    explanation:
      '−2 × 3 = −6. XOR the operand signs and add their integer-significand scale exponents.',
  },
  {
    label: 'Exact subnormal product',
    a: 0x0400,
    b: 0x3800,
    operation: 'multiply',
    expected: 0x0200,
    explanation:
      '2^-14 × 0.5 = 2^-15, an exact subnormal. Tininess alone does not raise underflow.',
  },
  {
    label: 'Tiny product underflow',
    a: 0x0001,
    b: 0x3800,
    operation: 'multiply',
    expected: 0x0000,
    explanation:
      '2^-24 × 0.5 = 2^-25, halfway to the minimum subnormal. Even zero wins; underflow and inexact are raised.',
  },
  {
    label: 'Product overflow',
    a: 0x7bff,
    b: 0x4000,
    operation: 'multiply',
    expected: 0x7c00,
    explanation:
      '65504 × 2 = 131008 exceeds FP16 range. Nearest-even returns Infinity with overflow and inexact.',
  },
  {
    label: 'Invalid zero × infinity',
    a: 0x0000,
    b: 0x7c00,
    operation: 'multiply',
    expected: 0x7e00,
    explanation:
      'Zero × infinity is invalid, returning canonical quiet NaN 0x7e00 with an explicit special-value short circuit.',
  },
  {
    label: 'Multiplication midpoint',
    a: 0x3c01,
    b: 0x3e00,
    operation: 'multiply',
    expected: 0x3e02,
    explanation:
      '1.0009765625 × 1.5 = 1.50146484375. The retained significand is odd at this exact midpoint, so G=1,R=0,S=0 increments to the even 1.501953125.',
  },
  {
    label: 'Fused cancellation',
    a: 0x3c01,
    b: 0x3bfe,
    c: 0xbc00,
    operation: 'fma',
    expected: 0x8010,
    nonfused: 0x0000,
    explanation:
      '(1 + 2^-10) × (1 − 2^-10) − 1 = −2^-20. FMA retains the product residual; rounding the product to 1 first loses it and gives +0.',
  },
  {
    label: 'FMA preserves product bits',
    a: 0x3c01,
    b: 0x3c01,
    c: 0xbc02,
    operation: 'fma',
    expected: 0x0010,
    nonfused: 0x0000,
    explanation:
      '(1 + 2^-10)^2 − (1 + 2^-9) = 2^-20. Fused output is 0x0010; the nonfused product rounds away 2^-20, so its final result is zero.',
  },
  {
    label: 'FMA avoids intermediate overflow',
    a: 0x7bff,
    b: 0x4000,
    c: 0xfbff,
    operation: 'fma',
    expected: 0x7bff,
    nonfused: 0x7c00,
    explanation:
      '65504 × 2 − 65504 = 65504 exactly in FMA, with no flags. Nonfused multiplication overflows before subtraction; its output remains Infinity with overflow and inexact in the combined flags.',
  },
]
