import { useRef, useState } from 'react'
import { decodeFP16, formatFP16Bits, fp16BitsToHex } from '../../lib/numerics'
import {
  fitViewport,
  generateFP16Viewport,
  MICROSCOPE_DOMAIN,
  MIN_VIEW_SPAN,
} from '../../lib/numerics/microscope'
import type { Viewport, RoundingInterval } from '../../lib/numerics/microscope'
import { formatExactFP16, formatNumber } from '../../lib/explorer/presentation'
import { formatBoundary } from '../../lib/microscope/presentation'

export function NumberLine({
  viewport,
  target,
  bits,
  interval,
  onViewport,
  onTarget,
  onFit,
}: {
  viewport: Viewport
  target: number
  bits: number
  interval: RoundingInterval | null
  onViewport: (view: Viewport) => void
  onTarget: (value: number) => void
  onFit: () => void
}) {
  const [mode, setMode] = useState('target')
  const drag = useRef<{ x: number; view: Viewport; mode: string } | null>(null)
  const { points, total, sampled } = generateFP16Viewport(
    viewport.min,
    viewport.max,
  )
  const span = viewport.max - viewport.min
  const center = (viewport.min + viewport.max) / 2
  const x = (value: number) => 60 + ((value - viewport.min) / span) * 880
  const visible = (value: number) =>
    Number.isFinite(value) && value >= viewport.min && value <= viewport.max
  const quantized = decodeFP16(bits).value
  const pan = (direction: number) =>
    onViewport(fitViewport(center + (direction * span) / 4, span))
  const zoom = (factor: number) =>
    onViewport(fitViewport(center, span * factor))
  const moveFromPointer = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0) return
    const fraction = Math.max(
      0,
      Math.min(1, (((clientX - rect.left) / rect.width) * 1000 - 60) / 880),
    )
    onTarget(viewport.min + fraction * span)
  }
  return (
    <section
      className="panel microscope-line"
      aria-labelledby="number-line-heading"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">01 / Local precision</p>
          <h3 id="number-line-heading">The representable number line</h3>
        </div>
        <span className="text-small muted">Linear axis · finite values</span>
      </div>
      <div className="microscope-toolbar" aria-label="Number line controls">
        <button
          type="button"
          onClick={() => pan(-1)}
          disabled={viewport.min <= -MICROSCOPE_DOMAIN}
        >
          Pan left
        </button>
        <button
          type="button"
          onClick={() => pan(1)}
          disabled={viewport.max >= MICROSCOPE_DOMAIN}
        >
          Pan right
        </button>
        <button
          type="button"
          onClick={() => zoom(0.5)}
          disabled={span <= MIN_VIEW_SPAN}
        >
          Zoom in
        </button>
        <button
          type="button"
          onClick={() => zoom(2)}
          disabled={span >= 2 * MICROSCOPE_DOMAIN}
        >
          Zoom out
        </button>
        <button type="button" onClick={onFit}>
          Fit target
        </button>
        <button
          type="button"
          onClick={() => onViewport(fitViewport(0, 2 * MICROSCOPE_DOMAIN))}
        >
          Overview
        </button>
        <label>
          Drag mode{' '}
          <select
            aria-label="Number line drag mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="target">Move target</option>
            <option value="pan">Pan viewport</option>
          </select>
        </label>
      </div>
      <p id="line-keyboard-help" className="text-small muted">
        Focus the chart: Left/Right pan, +/− zoom, Up/Down move the binary64
        target by 1% of the view. Or use the buttons, target slider, and point
        selector. Drag in the chosen mode.
      </p>
      <div className="microscope-chart-shell">
        <svg
          className="number-line-chart"
          viewBox="0 0 1000 235"
          role="group"
          tabIndex={0}
          aria-label="Interactive FP16 number line"
          aria-describedby="line-keyboard-help"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') pan(-1)
            else if (e.key === 'ArrowRight') pan(1)
            else if (e.key === '+' || e.key === '=') zoom(0.5)
            else if (e.key === '-') zoom(2)
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
              onTarget(
                (visible(target) ? target : center) +
                  ((e.key === 'ArrowUp' ? 1 : -1) * span) / 100,
              )
            else return
            e.preventDefault()
          }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, view: viewport, mode }
            e.currentTarget.setPointerCapture?.(e.pointerId)
            if (mode === 'target') moveFromPointer(e.clientX, e.currentTarget)
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            if (drag.current.mode === 'target')
              moveFromPointer(e.clientX, e.currentTarget)
            else {
              const rect = e.currentTarget.getBoundingClientRect()
              if (rect.width === 0) return
              const v = drag.current.view
              onViewport(
                fitViewport(
                  (v.min + v.max) / 2 -
                    ((e.clientX - drag.current.x) / (rect.width * 0.88)) *
                      (v.max - v.min),
                  v.max - v.min,
                ),
              )
            }
          }}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onLostPointerCapture={() => {
            drag.current = null
          }}
        >
          <title>
            Discrete FP16 points, binary64 target, quantized position, and
            rounding cell
          </title>
          {interval &&
            interval.upper >= viewport.min &&
            interval.lower <= viewport.max && (
              <rect
                className="rounding-cell"
                x={x(Math.max(viewport.min, interval.lower))}
                y={125}
                width={Math.max(
                  0,
                  x(Math.min(viewport.max, interval.upper)) -
                    x(Math.max(viewport.min, interval.lower)),
                )}
                height={52}
              >
                <title>
                  Inputs inside the shaded rounding cell round to the selected
                  FP16 pattern
                </title>
              </rect>
            )}
          <line className="plot-axis" x1={60} y1={156} x2={940} y2={156} />
          {Array.from({ length: 5 }, (_, i) => {
            const value = viewport.min + (span * i) / 4
            return (
              <g key={i}>
                <line
                  className="plot-tick"
                  x1={x(value)}
                  y1={151}
                  x2={x(value)}
                  y2={166}
                />
                <text
                  className="plot-label"
                  x={x(value)}
                  y={194}
                  textAnchor="middle"
                >
                  {Number(value.toPrecision(6)).toString()}
                </text>
              </g>
            )
          })}
          {points.map((point) => (
            <g
              key={point.bits}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onTarget(point.value)}
              className="lattice-point"
            >
              <title>{`${formatExactFP16(point.value)}; ${fp16BitsToHex(point.bits)}; ULP ${formatExactFP16(point.ulp)}. Click to select this exact FP16 value.`}</title>
              <circle cx={x(point.value)} cy={156} r={5} />
            </g>
          ))}
          {interval &&
            (
              [
                ['lower', interval.lower, interval.lowerIncluded],
                ['upper', interval.upper, interval.upperIncluded],
              ] as const
            ).map(
              ([name, value, included]) =>
                visible(value) && (
                  <g key={name}>
                    <title>
                      {value === 0
                        ? 'Signed-zero seam: not a halfway tie'
                        : `${name} halfway boundary ${formatBoundary(value)}; ${included ? 'included: the tie rounds to this encoding' : 'excluded: even neighbor wins'}`}
                    </title>
                    <line
                      className="halfway-line"
                      x1={x(value)}
                      y1={118}
                      x2={x(value)}
                      y2={177}
                    />
                    <rect
                      className={`cell-endpoint ${included ? 'included' : ''}`}
                      x={x(value) - 4}
                      y={152}
                      width={8}
                      height={8}
                    />
                  </g>
                ),
            )}
          {visible(target) && (
            <g className="target-marker">
              <line x1={x(target)} y1={78} x2={x(target)} y2={156} />
              <path d={`M${x(target) - 6},70 l12,12 m0,-12 l-12,12`} />
              <text
                x={Math.max(90, Math.min(910, x(target)))}
                y={55}
                textAnchor="middle"
              >
                Binary64 target
              </text>
            </g>
          )}
          {visible(quantized) ? (
            <g className="quantized-marker">
              <path d={`M${x(quantized)},108 l7,9 l-7,9 l-7,-9 Z`} />
              <line x1={x(quantized)} y1={126} x2={x(quantized)} y2={156} />
              <text
                x={Math.max(90, Math.min(910, x(quantized)))}
                y={102}
                textAnchor="middle"
              >
                FP16
              </text>
            </g>
          ) : (
            <text className="plot-label" x={940} y={102} textAnchor="end">
              FP16 {formatNumber(quantized)} · off finite axis
            </text>
          )}
        </svg>
      </div>
      <p className="plot-legend">
        <span>● FP16 representable points</span>
        <span>× Binary64 target (may be between points)</span>
        <span>◆ Quantized FP16</span>
        <span>
          Shaded: rounding cell · squares/dashes: cell boundaries (0 is a sign
          seam, not a tie)
        </span>
      </p>
      <p className="text-small muted">
        Viewport{' '}
        <output aria-live="off" aria-label="Microscope viewport">
          {formatNumber(viewport.min)} to {formatNumber(viewport.max)}
        </output>
        . Axis tick labels are rounded for readability; point data below is
        exact.
      </p>
      <p className="text-small" role="status" aria-label="Viewport sampling">
        {sampled
          ? `Sampled view: showing ${points.length} of ${total} finite values. Omitted points are still representable; zoom in to resolve individual gaps.`
          : `All ${total} finite values in this viewport are shown.`}
      </p>
      {!visible(target) && (
        <p className="precision-note">
          The target is not on this finite viewport. Fit target returns to a
          useful local region; NaN and infinities have no finite coordinate.
          Inputs beyond the ±131072 plot domain are analyzed but not plotted.
        </p>
      )}
      {viewport.min <= 0 && viewport.max >= 0 && (
        <p className="text-small muted">
          +0 and −0 share one geometric point; the plot uses +0 there. The input
          and selected encoding preserve signed zero, with separate
          sign-dependent rounding half-cells.
        </p>
      )}
      <div className="microscope-target-controls">
        <label>
          Move target within viewport
          <input
            type="range"
            aria-label="Move target within viewport"
            min={0}
            max={1000}
            step={1}
            value={
              Number.isFinite(target)
                ? Math.max(
                    0,
                    Math.min(1000, ((target - viewport.min) / span) * 1000),
                  )
                : 500
            }
            aria-valuetext={formatNumber(target)}
            onChange={(e) =>
              onTarget(viewport.min + (Number(e.target.value) / 1000) * span)
            }
          />
        </label>
        <label>
          Inspect a visible FP16 point
          <select
            aria-label="Inspect a visible FP16 point"
            value=""
            onChange={(e) => {
              if (e.target.value !== '')
                onTarget(decodeFP16(Number(e.target.value)).value)
            }}
          >
            <option value="">Choose an exact value…</option>
            {points.map((point) => (
              <option key={point.bits} value={point.bits}>
                {formatExactFP16(point.value)} · {fp16BitsToHex(point.bits)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="microscope-data">
        <summary>
          Visible point data ({points.length}
          {sampled ? ' sampled' : ''})
        </summary>
        <div className="table-scroll">
          <table>
            <caption>
              Exact FP16 values actually rendered in the viewport; one encoding
              for geometric zero.
            </caption>
            <thead>
              <tr>
                <th>Exact value</th>
                <th>Hex</th>
                <th>Binary</th>
                <th>ULP</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.bits}>
                  <td>{formatExactFP16(point.value)}</td>
                  <td>{fp16BitsToHex(point.bits)}</td>
                  <td>{formatFP16Bits(point.bits)}</td>
                  <td>{formatExactFP16(point.ulp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
