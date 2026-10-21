import { useState } from 'react'
import { decodeFP16, floatToFP16Bits, fp16BitsToHex } from '../lib/numerics'
import {
  formatExactFP16,
  formatNumber,
  parseDecimalInput,
} from '../lib/explorer/presentation'
import { FP16_PRESETS } from '../lib/explorer/presets'
import { BitFields } from './BitFields'
import { ValueBreakdown } from './ValueBreakdown'
import { PrecisionPanel } from './PrecisionPanel'

export function FP16Explorer() {
  const [bits, setBits] = useState(0x3e00)
  const [draft, setDraft] = useState('1.5')
  const [original, setOriginal] = useState<{
    text: string
    value: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const decoded = decodeFP16(bits)

  function selectBits(nextBits: number) {
    const next = decodeFP16(nextBits)
    setBits(next.bits)
    setDraft(formatExactFP16(next.value))
    setOriginal(null)
    setError(null)
  }

  return (
    <section
      id="explorer"
      aria-labelledby="explorer-heading"
      className="explorer"
    >
      <div className="explorer-header">
        <div>
          <span className="eyebrow">01 / Bit Explorer</span>
          <h2 id="explorer-heading">FP16 Explorer</h2>
        </div>
        <div className="encoding-badge">
          <code>{fp16BitsToHex(bits)}</code>
          <span>{decoded.classification}</span>
        </div>
      </div>
      <div className="explorer-content">
        <section className="decimal-panel" aria-labelledby="decimal-heading">
          <div>
            <h3 id="decimal-heading">Start with a number</h3>
            <p className="muted text-small">
              Convert a binary64 input to binary16, or edit the bits below.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const result = parseDecimalInput(draft)
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                setBits(floatToFP16Bits(result.value))
                setOriginal({ text: draft.trim(), value: result.value })
                setError(null)
              }}
            >
              <label htmlFor="decimal-input">Decimal / special value</label>
              <div className="input-row">
                <input
                  id="decimal-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft}
                  aria-invalid={error !== null}
                  aria-describedby={`decimal-help${error ? ' decimal-error' : ''}`}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    setError(null)
                  }}
                />
                <button className="primary-button" type="submit">
                  Convert to FP16 <span aria-hidden="true">→</span>
                </button>
              </div>
              <p id="decimal-help" className="muted text-small">
                Decimal or scientific notation; −0 as <code>-0</code>;{' '}
                <code>Infinity</code>, <code>-Infinity</code>, or{' '}
                <code>NaN</code> (case-insensitive). Decimal text is first
                parsed to JavaScript binary64.
              </p>
              {error && (
                <p id="decimal-error" role="alert" className="input-error">
                  {error}
                </p>
              )}
            </form>
          </div>
          <div className="conversion" aria-label="Quantization comparison">
            {original ? (
              <>
                <span className="eyebrow">Last converted input / binary64</span>
                <output
                  aria-live="off"
                  aria-label="Original input"
                  className="original-value"
                >
                  {original.text}
                </output>
                <p className="muted text-small">
                  Parsed Number: <code>{formatNumber(original.value)}</code>
                </p>
                <span className="conversion-arrow" aria-hidden="true">
                  ↓
                </span>
                <span className="eyebrow">Quantized / binary16</span>
                <output
                  aria-live="off"
                  aria-label="Quantized FP16 value"
                  className="quantized-value"
                >
                  {formatExactFP16(decoded.value)}
                </output>
                <p className="text-small conversion-result">
                  {Number.isNaN(original.value)
                    ? 'Canonical quiet NaN · 0x7e00'
                    : Object.is(original.value, decoded.value)
                      ? 'Exactly representable in FP16'
                      : 'Rounded · nearest, ties to even'}
                </p>
              </>
            ) : (
              <>
                <span className="eyebrow">Raw encoding selected</span>
                <p>Bit edits and presets preserve the exact pattern.</p>
                <p className="muted text-small">
                  Convert a decimal to compare the original binary64 input with
                  its quantized FP16 value.
                </p>
              </>
            )}
          </div>
        </section>
        <BitFields
          bits={bits}
          onToggle={(position) => selectBits(bits ^ (1 << position))}
        />
        <div className="detail-panels">
          <ValueBreakdown decoded={decoded} />
          <PrecisionPanel bits={bits} onSelect={selectBits} />
        </div>
        <section className="preset-panel" aria-labelledby="presets-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Reference patterns</p>
              <h3 id="presets-heading">Explore the edge cases</h3>
            </div>
            <span className="muted text-small">
              Explicit, validated 16-bit encodings
            </span>
          </div>
          <div className="presets">
            {FP16_PRESETS.map((preset) => (
              <button
                key={preset.bits}
                className="preset-button"
                type="button"
                aria-pressed={bits === preset.bits}
                onClick={() => selectBits(preset.bits)}
              >
                <span>{preset.label}</span>
                <code>{fp16BitsToHex(preset.bits)}</code>
              </button>
            ))}
          </div>
        </section>
      </div>
      <p
        role="status"
        aria-label="FP16 selection"
        aria-live="polite"
        aria-atomic="true"
        className="explorer-status"
      >
        {fp16BitsToHex(bits)} · {decoded.classification} ·{' '}
        {formatExactFP16(decoded.value)}
      </p>
    </section>
  )
}
