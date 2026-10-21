// Optional development check. No SoftFloat source or binary is bundled with FP Play.
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import process from 'node:process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL, URL } from 'node:url'
import ts from 'typescript'

const driver = process.argv[2]
if (!driver)
  throw new Error(
    'Usage: node scripts/validate-softfloat.mjs /path/to/softfloat-driver',
  )
const temporary = mkdtempSync(join(tmpdir(), 'fp-play-arithmetic-'))
try {
  for (const name of ['fp16', 'fp16Arithmetic']) {
    const source = readFileSync(
      new URL(`../src/lib/numerics/${name}.ts`, import.meta.url),
      'utf8',
    )
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText
    writeFileSync(
      join(temporary, `${name}.mjs`),
      compiled.replace(/from (['"])\.\/fp16\1/g, "from './fp16.mjs'"),
    )
  }
  const { calculateFP16 } = await import(
    pathToFileURL(join(temporary, 'fp16Arithmetic.mjs')).href
  )
  const pairs = []
  const addPair = (a, b) => {
    pairs.push([a, b, 0], [a, b, 1])
  }
  // Every raw encoding in A, including both zeros, infinities, and all NaNs.
  for (let bits = 0; bits <= 65535; bits += 1) addPair(bits, 0)
  const directed = [
    0, 0x8000, 1, 0x8001, 0x03ff, 0x0400, 0x1000, 0x3bff, 0x3c00, 0x3c01,
    0x4000, 0x4c00, 0x7bff, 0xfbff, 0x7c00, 0xfc00, 0x7c01, 0xfc01, 0x7e01,
    0xfe02,
  ]
  for (const a of directed) for (const b of directed) addPair(a, b)
  let state = 0x12345678
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state & 65535
  }
  for (let i = 0; i < 50000; i += 1) addPair(next(), next())
  const input =
    pairs
      .map(([a, b, op]) => `${a.toString(16)} ${b.toString(16)} ${op}`)
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
    const [a, b, op] = pairs[i]
    const result = calculateFP16(a, b, op ? 'subtract' : 'add')
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
        `Mismatch a=${a.toString(16)} b=${b.toString(16)} op=${op}: actual ${result.bits.toString(16)}/${flagMask}, SoftFloat ${raw}/${flags}`,
      )
  }
  console.log(
    JSON.stringify({
      operations: pairs.length,
      nanResults,
      mismatches: 0,
      rounding: 'nearest-even',
      tininess: 'after-rounding',
      nanComparison:
        'quiet classification and flags; custom payload policy tested separately',
    }),
  )
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
