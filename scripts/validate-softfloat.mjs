// Optional development check. No SoftFloat source or binary is bundled with FP Play.
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import process from 'node:process'
import { resolve } from 'node:path'
import { withArithmetic } from './arithmetic-runtime.mjs'

const driver = process.argv[2]
if (!driver)
  throw new Error(
    'Usage: node scripts/validate-softfloat.mjs /path/to/softfloat-driver',
  )
await withArithmetic(async ({ calculateFP16, multiplyFP16, fmaFP16 }) => {
  const pairs = []
  const addPair = (a, b) => {
    pairs.push([a, b, 0, 0], [a, b, 1, 0], [a, b, 2, 0])
  }
  // Every raw encoding in A, including both zeros, infinities, and all NaNs.
  for (let bits = 0; bits <= 65535; bits += 1) {
    // Preserve earlier exhaustive add/sub-zero checks, plus mul ×0 and ×1/FMA identities.
    addPair(bits, 0)
    pairs.push([bits, 0x3c00, 2, 0], [bits, 0x3c00, 3, 0])
  }
  const directed = [
    0, 0x8000, 1, 0x8001, 0x03ff, 0x0400, 0x1000, 0x3bff, 0x3c00, 0x3c01,
    0x4000, 0x4c00, 0x7bff, 0xfbff, 0x7c00, 0xfc00, 0x7c01, 0xfc01, 0x7e01,
    0xfe02,
  ]
  for (const a of directed)
    for (const b of directed) {
      addPair(a, b)
      for (const c of directed) pairs.push([a, b, 3, c])
    }
  for (const [a, b, c] of [
    [0x3c01, 0x3c01, 0xbc02],
    [0x3c01, 0x3bfe, 0xbc00],
    [0x7bff, 0x4000, 0xfbff],
    [0x0400, 0x3bff, 0],
  ]) {
    pairs.push([a, b, 3, c])
    pairs.push([a, b, 2, 0])
  }
  let state = 0x12345678
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state & 65535
  }
  for (let i = 0; i < 50000; i += 1) addPair(next(), next())
  for (let i = 0; i < 50000; i += 1) pairs.push([next(), next(), 3, next()])
  const input =
    pairs
      .map(
        ([a, b, op, c]) =>
          `${a.toString(16)} ${b.toString(16)} ${op} ${c.toString(16)}`,
      )
      .join('\n') + '\n'
  const output = execFileSync(resolve(driver), [], {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .trim()
    .split('\n')
  if (output.length !== pairs.length)
    throw new Error('SoftFloat output count mismatch')
  let nanResults = 0
  for (let i = 0; i < pairs.length; i += 1) {
    const [a, b, op, c] = pairs[i]
    const result =
      op === 3
        ? fmaFP16(a, b, c)
        : op === 2
          ? multiplyFP16(a, b)
          : calculateFP16(a, b, op ? 'subtract' : 'add')
    const [raw, flags] = output[i].split(' ')
    const expected = Number.parseInt(raw, 16)
    const flagMask =
      (result.flags.invalid ? 16 : 0) |
      (result.flags.overflow ? 4 : 0) |
      (result.flags.underflow ? 2 : 0) |
      (result.flags.inexact ? 1 : 0)
    const isNaN = (expected & 0x7fff) > 0x7c00
    if (isNaN) nanResults += 1
    // SoftFloat specialization payload/sign policy differs from FP Play's policy.
    // Still require a quiet NaN and identical invalid/overflow/underflow/inexact flags.
    const bitsMatch = isNaN
      ? result.decoded.classification === 'nan' && result.decoded.isQuietNaN
      : result.bits === expected
    if (!bitsMatch || flagMask !== Number(flags))
      throw new Error(
        `Mismatch a=${a.toString(16)} b=${b.toString(16)} c=${c.toString(16)} op=${op}: actual ${result.bits.toString(16)}/${flagMask}, SoftFloat ${raw}/${flags}`,
      )
  }
  console.log(
    JSON.stringify({
      operations: pairs.length,
      counts: pairs.reduce(
        (counts, [, , op]) => {
          counts[op]++
          return counts
        },
        [0, 0, 0, 0],
      ),
      nanResults,
      mismatches: 0,
      rounding: 'nearest-even',
      tininess: 'after-rounding',
      nanComparison:
        'quiet classification and flags; custom payload policy tested separately',
    }),
  )
})
