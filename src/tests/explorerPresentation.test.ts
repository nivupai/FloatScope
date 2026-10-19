// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  formatExactFP16,
  parseDecimalInput,
} from '../lib/explorer/presentation'
import { decodeFP16 } from '../lib/numerics'

describe('Explorer presentation', () => {
  it('formats every finite FP16 value as its exact decimal expansion', () => {
    for (let bits = 0; bits <= 0xffff; bits += 1) {
      const decoded = decodeFP16(bits)
      if (!Number.isFinite(decoded.value)) continue
      const text = formatExactFP16(decoded.value)
      expect(Object.is(Number(text), decoded.value)).toBe(true)
      // Independent exact rational check: decimal * 2**24 must equal the
      // integer lattice coordinate, without a Number parse that could round.
      const unsigned = text.replace('-', '')
      const [whole, fractional = ''] = unsigned.split('.')
      const decimalInteger = BigInt(whole + fractional)
      const coordinate = BigInt(Math.abs(decoded.value) * 2 ** 24)
      expect(decimalInteger * (1n << 24n)).toBe(
        coordinate * 10n ** BigInt(fractional.length),
      )
    }
  })

  it.each([' .5 ', '+1.0', '-0', '1e-5', 'NaN', 'INFINITY', '-infinity'])(
    'accepts documented input %s',
    (input) => {
      expect(parseDecimalInput(input).ok).toBe(true)
    },
  )
})
