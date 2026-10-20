import {
  decodeFP16,
  floatToFP16Bits,
  formatFP16Bits,
  fp16BitsToHex,
} from '../numerics'
import { formatNumber, parseDecimalInput } from '../explorer/presentation'
import type { ArithmeticStage, ExactDyadic } from '../numerics/fp16Arithmetic'

export function parseArithmeticOperand(
  text: string,
  mode: 'decimal' | 'hex',
): { ok: true; bits: number; source: string } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (mode === 'hex') {
    if (!/^0x[0-9a-f]{4}$/i.test(trimmed))
      return {
        ok: false,
        error:
          'Raw hexadecimal must be 0x followed by exactly four hex digits, for example 0x3c00.',
      }
    const bits = Number.parseInt(trimmed.slice(2), 16)
    decodeFP16(bits)
    return { ok: true, bits, source: `Raw ${fp16BitsToHex(bits)}` }
  }
  const parsed = parseDecimalInput(trimmed)
  return parsed.ok
    ? {
        ok: true,
        bits: floatToFP16Bits(parsed.value),
        source: `Entered ${trimmed}; binary64 ${formatNumber(parsed.value)}`,
      }
    : parsed
}

export function formatExactDyadic(exact: ExactDyadic): string {
  if (exact.coefficient === 0n) return formatNumber(exact.value)
  const negative = exact.coefficient < 0n
  const magnitude = negative ? -exact.coefficient : exact.coefficient
  if (exact.exponent >= 0)
    return `${negative ? '-' : ''}${magnitude << BigInt(exact.exponent)}`
  const places = -exact.exponent
  const digits = (magnitude * 5n ** BigInt(places))
    .toString()
    .padStart(places + 1, '0')
  return `${negative ? '-' : ''}${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(
    /\.?0+$/,
    '',
  )
}

export function fixedPointBits(
  integer: bigint,
  fractionalBits: number,
): string {
  const digits = integer.toString(2).padStart(11 + fractionalBits, '0')
  return fractionalBits
    ? `${digits.slice(0, -fractionalBits)}.${digits.slice(-fractionalBits)}`
    : digits
}

export const STAGE_TITLES: Record<ArithmeticStage['kind'], string> = {
  decode: 'Operand decoding',
  compare: 'Exponent comparison',
  align: 'Lossless significand alignment',
  arithmetic: 'Signed significand arithmetic',
  normalize: 'Normalization',
  grs: 'Guard, round, sticky',
  round: 'Nearest-even rounding decision',
  special: 'Special-value short circuit',
  encode: 'Result encoding and flags',
}

/** Every displayed intermediate is a field of the computation's discriminated trace. */
export function describeStage(stage: ArithmeticStage): {
  explanation: string
  rows: [string, string][]
} {
  switch (stage.kind) {
    case 'decode':
      return {
        explanation:
          'Decode the raw operands using the binary16 engine. Subtraction reverses B’s effective arithmetic sign, but NaN propagation uses the original raw NaN sign and payload.',
        rows: [
          [
            'A raw / class',
            `${fp16BitsToHex(stage.a.bits)} / ${stage.a.classification}`,
          ],
          ['A binary', formatFP16Bits(stage.a.bits)],
          [
            'B raw / class',
            `${fp16BitsToHex(stage.b.bits)} / ${stage.b.classification}`,
          ],
          ['B binary', formatFP16Bits(stage.b.bits)],
          ['B effective sign', String(stage.effectiveBSign)],
        ],
      }
    case 'compare':
      return {
        explanation:
          'Normals have an implicit 1; subnormals and zeros do not. Their effective exponent is -14. Compare exponents before alignment.',
        rows: [
          [
            'A exponent / integer significand',
            `${stage.a.exponent} / ${stage.a.significand}`,
          ],
          [
            'B exponent / integer significand',
            `${stage.b.exponent} / ${stage.b.significand}`,
          ],
          ['Exponent difference A − B', String(stage.difference)],
        ],
      }
    case 'align':
      return {
        explanation:
          'Conceptually shift the smaller significand right to the larger exponent. Preserve the complete fractional tail as fixed-point BigInts, so alignment introduces no rounding. The binary point separates fractional significand bits, not operand value units.',
        rows: [
          ['Common exponent', String(stage.commonExponent)],
          ['A right shift', String(stage.shiftRightA)],
          ['B right shift', String(stage.shiftRightB)],
          ['Fractional bits retained', String(stage.fractionalBits)],
          [
            'A aligned binary',
            fixedPointBits(stage.alignedA, stage.fractionalBits),
          ],
          [
            'B aligned binary',
            fixedPointBits(stage.alignedB, stage.fractionalBits),
          ],
          ['Exact integer scale', `2^${stage.quantumExponent}`],
        ],
      }
    case 'arithmetic':
      return {
        explanation:
          'Apply the operand signs and add the exact aligned integers. The sum times the common power of two is the exact mathematical result. No binary64 operand addition is used here.',
        rows: [
          ['Signed A integer', String(stage.signedA)],
          ['Signed B integer', String(stage.signedB)],
          ['Exact signed sum', String(stage.sum)],
          [
            'Sum magnitude bits',
            (stage.sum < 0n ? -stage.sum : stage.sum).toString(2),
          ],
          ['Exact power-of-two scale', `2^${stage.exponent}`],
        ],
      }
    case 'normalize':
      return {
        explanation:
          stage.leadingBitIndex === null
            ? 'The exact result is zero; there is no leading significand bit. Under nearest-even, cancellation gives +0 unless both effective operands are negative zero.'
            : 'Locate the exact leading bit. Select eleven-bit normal precision, or the fixed subnormal quantum. A negative shift restores leading bits after cancellation; a positive shift identifies bits that the rounding stage will discard.',
        rows: [
          ['Exact magnitude binary', stage.magnitude.toString(2)],
          [
            'Leading bit index',
            stage.leadingBitIndex === null
              ? 'None (zero)'
              : String(stage.leadingBitIndex),
          ],
          [
            'Exact leading exponent',
            stage.exactExponent === null
              ? 'Not applicable'
              : String(stage.exactExponent),
          ],
          ['Working exponent (floor -14)', String(stage.encodingExponent)],
          ['Rounding quantum', `2^${stage.quantumExponent}`],
          ['Shift (right + / left −)', String(stage.shift)],
          [
            'Retained binary before rounding',
            stage.retained.toString(2).padStart(11, '0'),
          ],
        ],
      }
    case 'grs':
      return {
        explanation:
          'Guard is the first discarded bit; round is the second; sticky is the OR of every remaining discarded bit. These are derived from the exact magnitude, including the full alignment tail.',
        rows: [
          ['Guard', String(stage.guard)],
          ['Round', String(stage.round)],
          ['Sticky', String(stage.sticky)],
          ['Discarded bit count', String(stage.discardCount)],
          ['Discarded binary (all bits)', stage.discardedBits || 'None'],
          ['Exact discarded remainder', String(stage.remainder)],
        ],
      }
    case 'round':
      return {
        explanation:
          'Increment iff guard is 1 and either round, sticky, or the retained low bit is 1. An exact halfway tie chooses the even significand. A carry renormalizes once; finite exponent-range overflow is applied during encoding.',
        rows: [
          ['Exact halfway tie', String(stage.halfway)],
          ['Retained significand odd', String(stage.retainedWasOdd)],
          ['Increment', String(stage.increment)],
          [
            'After increment binary',
            stage.rounded.toString(2).padStart(11, '0'),
          ],
          ['Carry renormalization', String(stage.carry)],
          [
            'Final significand binary',
            stage.finalSignificand.toString(2).padStart(11, '0'),
          ],
          ['Final working exponent', String(stage.finalExponent)],
        ],
      }
    case 'special':
      return {
        explanation:
          stage.reason === 'nan'
            ? 'Select the first signaling NaN, otherwise the first quiet NaN, in A/B order. Quiet it and preserve its original sign and low nine payload bits. Any signaling input raises invalid.'
            : stage.reason === 'invalid-infinities'
              ? 'Opposing effective infinities have no defined sum. Return canonical quiet NaN 0x7e00 and raise invalid.'
              : 'An infinity result bypasses ordinary significand alignment, normalization, and rounding. No finite exact result is reported.',
        rows: [
          ['Short-circuit reason', stage.reason],
          [
            'Selected NaN operand',
            stage.selectedNaNOperand ?? 'Not applicable',
          ],
          ['Signaling NaN present', String(stage.signaling)],
        ],
      }
    case 'encode':
      return {
        explanation:
          'Pack the final sign, exponent, and fraction, or encode the special result. Flags are per-operation, not sticky global processor state. Underflow requires both tininess after rounding and inexactness.',
        rows: [
          ['Result binary', formatFP16Bits(stage.bits)],
          ['Result hex', fp16BitsToHex(stage.bits)],
          ['Result classification', stage.decoded.classification],
          ...Object.entries(stage.flags).map(
            ([key, flag]): [string, string] => [key, flag ? 'Raised' : 'Clear'],
          ),
        ],
      }
  }
}
