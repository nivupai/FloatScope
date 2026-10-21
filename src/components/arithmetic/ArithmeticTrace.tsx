import type { ArithmeticStage } from '../../lib/numerics/fp16Arithmetic'
import { STAGE_TITLES } from '../../lib/arithmetic/presentation'
import type { MultiplyStage } from '../../lib/numerics/fp16Multiply'
import {
  describeMultiplyStage,
  MULTIPLY_STAGE_TITLES,
} from '../../lib/arithmetic/multiplyPresentation'

/** Renders the engine's actual stages; it never recomputes numerical intermediates. */
export function ArithmeticTrace({
  trace,
  step,
  setStep,
}: {
  trace: (ArithmeticStage | MultiplyStage)[]
  step: number
  setStep: (step: number) => void
}) {
  const stage = trace[step]
  const titles = { ...STAGE_TITLES, ...MULTIPLY_STAGE_TITLES }
  const details = describeMultiplyStage(stage)
  return (
    <section
      className="arithmetic-trace"
      aria-labelledby="arithmetic-trace-heading"
    >
      <div className="arithmetic-trace-header">
        <h3 id="arithmetic-trace-heading">Inside the operation</h3>
        <div className="arithmetic-step-controls">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Previous stage
          </button>
          <button
            type="button"
            disabled={step === trace.length - 1}
            onClick={() => setStep(step + 1)}
          >
            Next stage
          </button>
        </div>
      </div>
      <ol className="arithmetic-stages" aria-label="Arithmetic stages">
        {trace.map((entry, index) => (
          <li key={entry.kind}>
            <button
              type="button"
              aria-current={step === index ? 'step' : undefined}
              onClick={() => setStep(index)}
            >
              {index + 1}. {titles[entry.kind]}
            </button>
          </li>
        ))}
      </ol>
      <div
        className="panel arithmetic-stage-detail"
        role="group"
        aria-label="Arithmetic stage detail"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          const next =
            event.key === 'ArrowRight'
              ? Math.min(step + 1, trace.length - 1)
              : event.key === 'ArrowLeft'
                ? Math.max(0, step - 1)
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? trace.length - 1
                    : null
          if (next !== null) {
            event.preventDefault()
            setStep(next)
          }
        }}
      >
        <p
          className="eyebrow"
          role="status"
          aria-label="Arithmetic trace position"
        >
          Stage {step + 1} of {trace.length} · {titles[stage.kind]}
        </p>
        <h4>{titles[stage.kind]}</h4>
        <p className="muted">{details.explanation}</p>
        {stage.kind === 'grs' && (
          <div className="arithmetic-grs" aria-label="Rounding bits">
            {[
              ['Guard', stage.guard],
              ['Round', stage.round],
              ['Sticky', stage.sticky],
            ].map(([name, bit]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{bit}</strong>
              </div>
            ))}
          </div>
        )}
        <dl className="arithmetic-stage-data">
          {details.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd aria-label={label}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="muted text-small">
          Focus this panel and use Left/Right to step, Home/End to jump. Every
          stage is also a native button above.
        </p>
      </div>
    </section>
  )
}
