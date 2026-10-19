/** Presentation only: these helpers do not encode or decode IEEE 754 fields. */
export function formatNumber(value: number): string {
  return Object.is(value, -0) ? '-0' : String(value)
}

/** All finite binary16 fractions terminate within 24 decimal places. FP16 only. */
export function formatExactFP16(value: number): string {
  if (!Number.isFinite(value) || value === 0) return formatNumber(value)
  return value.toFixed(24).replace(/\.?0+$/, '')
}

export type DecimalInputResult =
  { ok: true; value: number } | { ok: false; error: string }

/** Strict decimal/scientific input plus explicit, case-insensitive special values. */
export function parseDecimalInput(text: string): DecimalInputResult {
  const input = text.trim()
  if (/^nan$/i.test(input)) return { ok: true, value: NaN }
  if (/^[+-]?infinity$/i.test(input)) {
    return { ok: true, value: input.startsWith('-') ? -Infinity : Infinity }
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input)) {
    return {
      ok: false,
      error:
        'Enter a decimal such as -0.125 or 1e-5, or use Infinity, -Infinity, or NaN.',
    }
  }
  const value = Number(input)
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      error:
        'This decimal exceeds the binary64 range. Use Infinity or -Infinity explicitly.',
    }
  }
  return { ok: true, value }
}
