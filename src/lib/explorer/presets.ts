import { decodeFP16 } from '../numerics'

/** Explicit raw patterns: never recreate presets by converting decimal literals. */
export const FP16_PRESETS = [
  { label: 'Positive zero', bits: 0x0000 },
  { label: 'Negative zero', bits: 0x8000 },
  { label: '1.0', bits: 0x3c00 },
  { label: '1.5', bits: 0x3e00 },
  { label: 'Smallest positive subnormal', bits: 0x0001 },
  { label: 'Largest positive subnormal', bits: 0x03ff },
  { label: 'Smallest positive normal', bits: 0x0400 },
  { label: 'Maximum finite positive', bits: 0x7bff },
  { label: 'Positive infinity', bits: 0x7c00 },
  { label: 'Quiet NaN · payload 1', bits: 0x7e01 },
].map((preset) =>
  Object.freeze({ ...preset, bits: decodeFP16(preset.bits).bits }),
)
