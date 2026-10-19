import { useState } from 'react'
import { formatFP16Bits, fp16BitsToHex, ulpFP16 } from '../../lib/numerics'
import {
  analyzeFP16Rounding,
  viewportForTarget,
} from '../../lib/numerics/microscope'
import {
  formatExactFP16,
  formatNumber,
  parseDecimalInput,
} from '../../lib/explorer/presentation'
import { MICROSCOPE_EXAMPLES } from '../../lib/microscope/examples'
import { formatInterval } from '../../lib/microscope/presentation'
import { NumberLine } from './NumberLine'
import { ULPChart } from './ULPChart'

export function PrecisionMicroscope() {
  const [target, setTarget] = useState<number>(1.0001)
  const [draft, setDraft] = useState('1.0001')
  const [entered, setEntered] = useState('1.0001')
  const [viewport, setViewport] = useState(() => viewportForTarget(1.0001))
  const [example, setExample] = useState<number | null>(0)
  const [error, setError] = useState<string | null>(null)
  const analysis = analyzeFP16Rounding(target)
  function selectTarget(value: number, fit = false) {
    setTarget(value)
    setDraft(formatNumber(value))
    setEntered(formatNumber(value))
    setExample(null)
    setError(null)
    if (fit) setViewport(viewportForTarget(value))
  }
  const rows = [
    ['Microscope original binary64', formatNumber(target)],
    ['Microscope quantized FP16', formatExactFP16(analysis.decoded.value)],
    [
      'Microscope previous FP16',
      analysis.decoded.classification === 'nan'
        ? 'Unordered'
        : formatExactFP16(analysis.previous.value),
    ],
    [
      'Microscope next FP16',
      analysis.decoded.classification === 'nan'
        ? 'Unordered'
        : formatExactFP16(analysis.next.value),
    ],
    ['Microscope rounding direction', analysis.direction],
    [
      'Microscope absolute error',
      analysis.absoluteError === null
        ? 'Undefined (nonfinite input)'
        : formatNumber(analysis.absoluteError),
    ],
    [
      'Microscope relative error',
      analysis.relativeError === null
        ? target === 0
          ? 'Undefined (zero denominator)'
          : 'Undefined (nonfinite input)'
        : formatNumber(analysis.relativeError),
    ],
    ['Microscope ULP', formatExactFP16(ulpFP16(analysis.bits))],
  ]
  return (
    <section
      id="microscope"
      className="explorer microscope"
      aria-labelledby="microscope-heading"
    >
      <div className="explorer-header">
        <div>
          <span className="eyebrow">Milestone 4 / Precision laboratory</span>
          <h2 id="microscope-heading">Floating-Point Precision Microscope</h2>
        </div>
        <span className="encoding-badge">
          <code>FP16</code>
          <span>RNE · ties to even</span>
        </span>
      </div>
      <div className="explorer-content">
        <p className="muted">
          Move between scales to see where numbers exist, where they do not, and
          which value rounding chooses. The original binary64 target and the
          selected FP16 encoding are separate.
        </p>
        <form
          className="microscope-input"
          onSubmit={(e) => {
            e.preventDefault()
            const result = parseDecimalInput(draft)
            if (!result.ok) {
              setError(result.error)
              return
            }
            selectTarget(result.value, true)
            setEntered(draft.trim())
          }}
        >
          <label htmlFor="microscope-input">
            Microscope target (decimal / binary64)
          </label>
          <div className="input-row">
            <input
              id="microscope-input"
              value={draft}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error !== null}
              aria-describedby={`microscope-parsing${error ? ' microscope-error' : ''}`}
              onChange={(e) => {
                setDraft(e.target.value)
                setError(null)
              }}
            />
            <button className="primary-button" type="submit">
              Analyze target
            </button>
          </div>
          <p id="microscope-parsing" className="text-small muted">
            Decimal text is parsed to binary64 before FP16 conversion; it is not
            an exact decimal-rational input. Accepts scientific notation, -0,
            Infinity, -Infinity, and NaN. Apply edits with Enter or Analyze
            target.
          </p>
          {error && (
            <p id="microscope-error" role="alert" className="input-error">
              {error}
            </p>
          )}
        </form>
        <section
          className="microscope-examples"
          aria-labelledby="microscope-examples-heading"
        >
          <h3 id="microscope-examples-heading">Experiments to try</h3>
          <div className="presets">
            {MICROSCOPE_EXAMPLES.map((item, index) => (
              <button
                className="preset-button"
                type="button"
                key={item.label}
                aria-pressed={example === index}
                onClick={() => {
                  selectTarget(item.value, true)
                  setExample(index)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {example !== null && (
            <p
              className="precision-note"
              aria-label="Microscope example explanation"
            >
              {MICROSCOPE_EXAMPLES[example].explanation}
            </p>
          )}
        </section>
        <NumberLine
          viewport={viewport}
          target={target}
          bits={analysis.bits}
          interval={analysis.interval}
          onViewport={setViewport}
          onTarget={selectTarget}
          onFit={() => setViewport(viewportForTarget(target))}
        />
        <section
          className="panel microscope-analysis"
          aria-labelledby="rounding-heading"
        >
          <p className="eyebrow">02 / Rounding and error</p>
          <h3 id="rounding-heading">From the target to its nearest encoding</h3>
          <p className="text-small muted">
            Last applied input text:{' '}
            <output aria-live="off" aria-label="Microscope entered text">
              {entered}
            </output>
            . Binary64 outputs below use shortest round-trip decimal notation;
            FP16 values and finite halfway boundaries are displayed exactly.
          </p>
          <dl className="microscope-metrics">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label.replace('Microscope ', '')}</dt>
                <dd>
                  <output aria-live="off" aria-label={label}>
                    {value}
                  </output>
                </dd>
              </div>
            ))}
          </dl>
          <dl className="microscope-encoding">
            <div>
              <dt>Selected FP16 hexadecimal</dt>
              <dd>
                <output aria-live="off" aria-label="Microscope selected hex">
                  {fp16BitsToHex(analysis.bits)}
                </output>
              </dd>
            </div>
            <div>
              <dt>Selected FP16 binary</dt>
              <dd>
                <output aria-live="off" aria-label="Microscope selected binary">
                  {formatFP16Bits(analysis.bits)}
                </output>
              </dd>
            </div>
          </dl>
          <div className="explanation">
            <p>
              Finite-input rounding cell:{' '}
              <output aria-live="off" aria-label="Microscope rounding interval">
                {formatInterval(analysis.interval)}
              </output>
            </p>
            <p>
              Square brackets include the endpoint; parentheses exclude it.
              Halfway endpoints belong to the even retained significand. Cells
              are asymmetric at powers of two. Zero uses separate sign-dependent
              half-cells; exact ±0 are not halfway ties.
            </p>
            {analysis.tie && (
              <p
                className="microscope-tie"
                role="status"
                aria-label="Halfway tie"
              >
                Exact halfway tie → round-to-nearest, ties-to-even.{' '}
                {Number.isFinite(analysis.decoded.value)
                  ? `The even retained significand wins: ${fp16BitsToHex(analysis.bits)}.`
                  : 'The even significand carries to virtual magnitude 65536, overflowing to infinity.'}
              </p>
            )}
          </div>
          <p className="text-small muted">
            Absolute error = |FP16 − binary64 input|. Relative error = absolute
            error / |input|, undefined at zero or for nonfinite input. Errors
            use binary64 arithmetic; relative division can round. Finite-input
            FP16 overflow has infinite absolute and relative error. Infinities
            saturate on outward stepping; NaN is unordered.
          </p>
        </section>
        <ULPChart
          target={target}
          onSelect={(value) => selectTarget(value, true)}
        />
      </div>
      <p
        className="explorer-status"
        role="status"
        aria-label="Microscope selection"
        aria-live="polite"
      >
        Target {formatNumber(target)} → FP16{' '}
        {formatExactFP16(analysis.decoded.value)} (
        {fp16BitsToHex(analysis.bits)}). {analysis.direction}.
      </p>
    </section>
  )
}
