import { useState } from 'react'
import { ArithmeticTrace } from './ArithmeticTrace'
import type { FormEvent } from 'react'
import { decodeFP16, formatFP16Bits, fp16BitsToHex } from '../../lib/numerics'
import { calculateFP16 } from '../../lib/numerics/fp16Arithmetic'
import type { FP16Operation } from '../../lib/numerics/fp16Arithmetic'
import { formatExactFP16 } from '../../lib/explorer/presentation'
import { ARITHMETIC_EXAMPLES } from '../../lib/arithmetic/examples'
import {
  formatExactDyadic,
  parseArithmeticOperand,
} from '../../lib/arithmetic/presentation'

type OperandDraft = { text: string; mode: 'decimal' | 'hex' }

function Encoding({ bits, label }: { bits: number; label: string }) {
  const binary = formatFP16Bits(bits)
  return (
    <div className="arithmetic-encoding" role="group" aria-label={label}>
      {[
        ['Sign', binary.slice(0, 1), 'sign'],
        ['Exponent', binary.slice(1, 6), 'exponent'],
        ['Fraction', binary.slice(6), 'fraction'],
      ].map(([field, digits, color]) => (
        <span className={`arithmetic-field field-${color}`} key={field}>
          <small>{field}</small>
          <code>{digits}</code>
        </span>
      ))}
      <span className="sr-only">{binary}</span>
    </div>
  )
}

export function ArithmeticExplorer() {
  const [drafts, setDrafts] = useState<OperandDraft[]>([
    { text: '1', mode: 'decimal' },
    { text: '0.5', mode: 'decimal' },
  ])
  const [operation, setOperation] = useState<FP16Operation>('add')
  const [active, setActive] = useState({
    a: 0x3c00,
    b: 0x3800,
    operation: 'add' as FP16Operation,
    sources: ['Entered 1; binary64 1', 'Entered 0.5; binary64 0.5'],
  })
  const [errors, setErrors] = useState<(string | null)[]>([null, null])
  const [example, setExample] = useState<number | null>(0)
  const [step, setStep] = useState(0)
  const result = calculateFP16(active.a, active.b, active.operation)

  function apply(event: FormEvent) {
    event.preventDefault()
    const a = parseArithmeticOperand(drafts[0].text, drafts[0].mode)
    const b = parseArithmeticOperand(drafts[1].text, drafts[1].mode)
    setErrors([a.ok ? null : a.error, b.ok ? null : b.error])
    if (!a.ok || !b.ok) return
    setActive({
      a: a.bits,
      b: b.bits,
      operation,
      sources: [a.source, b.source],
    })
    setStep(0)
    setExample(null)
  }

  return (
    <section
      id="arithmetic"
      aria-labelledby="arithmetic-heading"
      className="explorer arithmetic-explorer"
    >
      <div className="explorer-header">
        <div>
          <p className="eyebrow">05 / FOLLOW THE COMPUTATION</p>
          <h2 id="arithmetic-heading">FP16 Arithmetic Explorer</h2>
          <p className="muted">
            Two operands. One exact sum. One rounding decision.
          </p>
        </div>
        <span className="arithmetic-mode">ADD / SUB · NEAREST EVEN</span>
      </div>
      <div className="explorer-content arithmetic-content">
        <p className="muted text-small">
          These are conceptual stages, not clock cycles or a specific hardware
          design. Full alignment tails are retained with exact integer
          arithmetic before rounding once to binary16.
        </p>
        <form
          onSubmit={apply}
          className="arithmetic-form"
          aria-label="Arithmetic operands"
        >
          {drafts.map((draft, index) => {
            const name = index === 0 ? 'A' : 'B'
            return (
              <div className="arithmetic-operand-input" key={name}>
                <label htmlFor={`operand-${name}`}>Operand {name}</label>
                <select
                  aria-label={`Operand ${name} format`}
                  value={draft.mode}
                  onChange={(event) => {
                    const mode = event.target.value as OperandDraft['mode']
                    setDrafts(
                      drafts.map((entry, i) =>
                        i === index ? { ...entry, mode } : entry,
                      ),
                    )
                  }}
                >
                  <option value="decimal">Decimal / special value</option>
                  <option value="hex">Raw hexadecimal</option>
                </select>
                <input
                  id={`operand-${name}`}
                  value={draft.text}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={!!errors[index]}
                  aria-describedby={`arithmetic-input-help${errors[index] ? ` operand-${name}-error` : ''}`}
                  onChange={(event) => {
                    setDrafts(
                      drafts.map((entry, i) =>
                        i === index
                          ? { ...entry, text: event.target.value }
                          : entry,
                      ),
                    )
                  }}
                />
                {errors[index] && (
                  <p
                    id={`operand-${name}-error`}
                    role="alert"
                    className="input-error"
                  >
                    {name}: {errors[index]}
                  </p>
                )}
              </div>
            )
          })}
          <div className="arithmetic-operation">
            <label htmlFor="arithmetic-operation">Operation</label>
            <select
              id="arithmetic-operation"
              value={operation}
              onChange={(event) =>
                setOperation(event.target.value as FP16Operation)
              }
            >
              <option value="add">A + B</option>
              <option value="subtract">A − B</option>
            </select>
            <button className="primary-button" type="submit">
              Trace operation
            </button>
          </div>
        </form>
        <p id="arithmetic-input-help" className="muted text-small">
          Decimal/scientific text is parsed to binary64, then quantized to FP16
          before arithmetic. Use -0, Infinity, -Infinity, or NaN; raw mode
          requires four hex digits such as 0x7c01 to retain a signaling NaN
          payload. Draft edits apply only on submission.
        </p>
        <div className="arithmetic-operands">
          {[active.a, active.b].map((bits, index) => {
            const name = index === 0 ? 'A' : 'B'
            const decoded = decodeFP16(bits)
            return (
              <div className="panel" key={name}>
                <p className="eyebrow">APPLIED OPERAND {name}</p>
                <p
                  className="arithmetic-value"
                  aria-label={`Operand ${name} quantized`}
                >
                  {formatExactFP16(decoded.value)}
                </p>
                <p
                  className="muted text-small"
                  aria-label={`Operand ${name} source`}
                >
                  {active.sources[index]}
                </p>
                <p
                  className="font-mono"
                  aria-label={`Operand ${name} encoding`}
                >
                  {fp16BitsToHex(bits)} · {decoded.classification}
                  {decoded.classification === 'nan'
                    ? ` · ${decoded.isQuietNaN ? 'quiet' : 'signaling'} · payload ${decoded.nanPayload}`
                    : ''}
                </p>
                <Encoding bits={bits} label={`Operand ${name} bits`} />
              </div>
            )
          })}
        </div>
        <div className="arithmetic-result panel">
          <div>
            <p className="eyebrow">
              APPLIED {active.operation === 'add' ? 'A + B' : 'A − B'} / FP16
              RESULT
            </p>
            <p
              className="arithmetic-value"
              aria-label="Arithmetic result decimal"
            >
              {formatExactFP16(result.decoded.value)}
            </p>
            <p className="font-mono" aria-label="Arithmetic result hex">
              {fp16BitsToHex(result.bits)} · {result.decoded.classification}
            </p>
            <Encoding bits={result.bits} label="Arithmetic result binary" />
          </div>
          <div className="arithmetic-comparison">
            <p className="eyebrow">EXACT BEFORE ROUNDING</p>
            <p className="font-mono" aria-label="Arithmetic exact result">
              {result.exact
                ? formatExactDyadic(result.exact)
                : 'Not a finite operation'}
            </p>
            <p className="muted text-small">
              {result.exact
                ? 'Exact mathematical result of the applied FP16 operands, before the final nearest-even rounding. This is distinct from arithmetic on the original decimal text.'
                : 'Special values short-circuit the finite arithmetic pipeline.'}
            </p>
          </div>
        </div>
        <ul
          className="arithmetic-flags"
          aria-label="Arithmetic exception indicators"
        >
          {Object.entries(result.flags).map(([flag, raised]) => (
            <li key={flag} data-raised={raised}>
              <span>{flag}</span>
              <strong aria-label={`Arithmetic ${flag}`}>
                {raised ? 'Raised' : 'Clear'}
              </strong>
            </li>
          ))}
        </ul>
        <p className="muted text-small">
          Flags are per operation. Tininess is detected after rounding;
          underflow requires inexactness as well. FP16 addition/subtraction
          cannot produce an inexact tiny result: finite operands share the 2⁻²⁴
          grid, so subnormal sums are exact. Decimal input conversion flags are
          not included.
        </p>
        <ArithmeticTrace trace={result.trace} step={step} setStep={setStep} />
        <section aria-labelledby="arithmetic-examples-heading">
          <h3 id="arithmetic-examples-heading">Arithmetic experiments</h3>
          <div className="presets arithmetic-examples">
            {ARITHMETIC_EXAMPLES.map((entry, index) => (
              <button
                className="preset-button"
                key={entry.label}
                type="button"
                aria-pressed={example === index}
                onClick={() => {
                  setActive({
                    a: entry.a,
                    b: entry.b,
                    operation: entry.operation,
                    sources: [
                      `Raw ${fp16BitsToHex(entry.a)}`,
                      `Raw ${fp16BitsToHex(entry.b)}`,
                    ],
                  })
                  setDrafts([
                    { text: fp16BitsToHex(entry.a), mode: 'hex' },
                    { text: fp16BitsToHex(entry.b), mode: 'hex' },
                  ])
                  setOperation(entry.operation)
                  setStep(0)
                  setErrors([null, null])
                  setExample(index)
                }}
              >
                {entry.label}
                <small className="font-mono">
                  → {fp16BitsToHex(entry.expected)}
                </small>
              </button>
            ))}
          </div>
          <p className="muted" aria-label="Arithmetic experiment explanation">
            {example === null
              ? 'Custom operands. Inspect the trace to see exactly which bits survive rounding.'
              : ARITHMETIC_EXAMPLES[example].explanation}
          </p>
        </section>
        <p className="muted text-small">
          NaN policy: first signaling NaN, otherwise first quiet NaN in A/B
          order; quiet and preserve its original sign and nine payload bits.
          Invalid infinity combinations return 0x7e00. Payload choice is
          implementation-specific. This educational add/sub model is not a claim
          of full IEEE 754 conformance.
        </p>
      </div>
    </section>
  )
}
