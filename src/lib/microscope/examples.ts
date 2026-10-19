export const MICROSCOPE_EXAMPLES = [
  {
    label: 'Why 1.0001 becomes 1',
    value: 1.0001,
    explanation:
      'The gap above 1 is 2^-10. 1.0001 is below the halfway boundary 1.00048828125, so it rounds down to 1.',
  },
  {
    label: 'Spacing near 1',
    value: 1,
    explanation:
      'The gap below 1 is 2^-11, while the gap above is 2^-10. A normal binade has constant absolute spacing.',
  },
  {
    label: 'Spacing near 1000',
    value: 1000.1,
    explanation:
      'In the [512, 1024) binade the spacing is 0.5. Values such as 1000.1 round to 1000.',
  },
  {
    label: 'Subnormal precision',
    value: 3 * 2 ** -24,
    explanation:
      'Subnormals have a fixed spacing of 2^-24. Absolute spacing stays constant while relative precision deteriorates toward zero.',
  },
  {
    label: 'Gradual underflow',
    value: 2 ** -25,
    explanation:
      'Half the smallest subnormal is an exact tie. The even zero significand wins; values just above the tie round to the smallest subnormal.',
  },
  {
    label: 'Exponent boundary',
    value: 2 - 2 ** -11,
    explanation:
      'This is halfway between the value below 2 and 2. The even significand at 2 wins. Spacing doubles on entering [2, 4).',
  },
  {
    label: 'Maximum finite and overflow',
    value: 65520,
    explanation:
      '65504 is the largest finite FP16 value. At 65520 the tie to virtual 65536 carries beyond the exponent range, producing Infinity.',
  },
] as const
