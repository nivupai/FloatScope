// Deterministic search, independently verified with a global integer-lattice oracle.
import console from 'node:console'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { withArithmetic } from './arithmetic-runtime.mjs'

const hex = (bits) => `0x${bits.toString(16).padStart(4, '0')}`
function decimal(units, zeroSign = false) {
  if (units === 0n) return zeroSign ? '-0' : '0'
  const neg = units < 0n,
    abs = neg ? -units : units
  const digits = (abs * 5n ** 48n).toString().padStart(49, '0')
  return `${neg ? '-' : ''}${digits.slice(0, -48)}.${digits.slice(-48)}`.replace(
    /\.?0+$/,
    '',
  )
}
await withArithmetic(
  ({ compareMultiplyAddFP16, referenceMultiply, fp16BitsToFloat }) => {
    const valueText = (bits) =>
      (bits & 0x7fff) >= 0x7c00
        ? String(fp16BitsToFloat(bits))
        : decimal(referenceMultiply(bits, 0x3c00).units, bits === 0x8000)
    const seed = 0x6f70656e
    let state = seed,
      attempts = 0
    const next = () => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return state & 0xffff
    }
    const examples = []
    // Include the two educational divergences, then discover five additional triples.
    const directed = [
      [0x3c01, 0x3c01, 0xbc02],
      [0x7bff, 0x4000, 0xfbff],
    ]
    while (examples.length < 7 && attempts < 100000) {
      const [a, b, c] = directed[attempts] ?? [next(), next(), next()]
      attempts++
      if ([a, b, c].some((bits) => (bits & 0x7fff) >= 0x7c00)) continue
      const comparison = compareMultiplyAddFP16(a, b, c)
      const { fused, nonfused } = comparison
      if (
        fused.bits === nonfused.bits ||
        fused.decoded.classification === 'nan' ||
        nonfused.decoded.classification === 'nan'
      )
        continue
      const reference = referenceMultiply(a, b, c),
        product = referenceMultiply(a, b)
      if (
        reference.bits !== fused.bits ||
        product.bits !== nonfused.product.bits
      )
        throw new Error('Independent lattice mismatch')
      // Independently check rounded-product + C as an FMA with an exact ×1.
      const nonfusedReference = referenceMultiply(product.bits, 0x3c00, c)
      if (nonfusedReference.bits !== nonfused.bits)
        throw new Error('Independent nonfused lattice mismatch')
      const input = [
        [a, b, 3, c],
        [a, b, 2, 0],
        [nonfused.product.bits, c, 0, 0],
      ]
      if (process.argv[2]) {
        const output = execFileSync(resolve(process.argv[2]), [], {
          encoding: 'utf8',
          input: input
            .map(
              ([x, y, op, z]) =>
                `${x.toString(16)} ${y.toString(16)} ${op} ${z.toString(16)}\n`,
            )
            .join(''),
        })
          .trim()
          .split('\n')
        for (const [i, r] of [
          fused,
          nonfused.product,
          nonfused.addition,
        ].entries()) {
          const [bits, flags] = output[i].split(' ')
          const mask =
            (r.flags.invalid ? 16 : 0) |
            (r.flags.overflow ? 4 : 0) |
            (r.flags.underflow ? 2 : 0) |
            (r.flags.inexact ? 1 : 0)
          if (Number.parseInt(bits, 16) !== r.bits || Number(flags) !== mask)
            throw new Error('SoftFloat counterexample mismatch')
        }
      }
      examples.push({
        operands: [a, b, c].map(hex),
        values: [a, b, c].map(valueText),
        exactProduct: decimal(product.units),
        exactResult: decimal(reference.units),
        roundedProduct: {
          bits: hex(nonfused.product.bits),
          value: valueText(nonfused.product.bits),
        },
        fused: {
          bits: hex(fused.bits),
          value: valueText(fused.bits),
          flags: fused.flags,
        },
        nonfused: {
          bits: hex(nonfused.bits),
          value: valueText(nonfused.bits),
          flags: nonfused.flags,
        },
        difference:
          comparison.difference === null
            ? 'Undefined for nonfinite output'
            : decimal(
                referenceMultiply(fused.bits, 0x3c00).units -
                  referenceMultiply(nonfused.bits, 0x3c00).units,
              ),
        explanation: nonfused.product.flags.overflow
          ? 'Intermediate multiplication overflows before cancellation; FMA retains the exact finite product until after addition.'
          : 'Intermediate multiplication rounding discards bits before addition; FMA preserves them until its single final rounding.',
      })
    }
    if (examples.length !== 7)
      throw new Error('Search failed to discover requested counterexamples')
    console.log(
      JSON.stringify(
        {
          seed: hex(seed),
          attempts,
          independentLatticeVerified: true,
          softFloatVerified: !!process.argv[2],
          examples,
        },
        null,
        2,
      ),
    )
  },
)
