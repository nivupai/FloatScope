import { fp16ULPRegions } from '../../lib/numerics/microscope'
import { formatExactFP16 } from '../../lib/explorer/presentation'

const regions = fp16ULPRegions()
export function ULPChart({
  target,
  onSelect,
}: {
  target: number
  onSelect: (value: number) => void
}) {
  const magnitude = Math.abs(target)
  const selected = regions.findIndex(
    (region) => magnitude >= region.lower && magnitude < region.upper,
  )
  const x = (value: number) => 65 + ((Math.log2(value) + 24) / 40) * 870
  const y = (value: number) => 228 - ((Math.log2(value) + 24) / 29) * 182
  return (
    <section
      className="panel ulp-chart-panel"
      aria-labelledby="ulp-chart-heading"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">03 / Global precision</p>
          <h3 id="ulp-chart-heading">Same format. Different spacing.</h3>
        </div>
        <span className="text-small muted">
          Magnitude (x) · absolute ULP (y) · log₂ axes
        </span>
      </div>
      <div className="microscope-chart-shell">
        <svg
          className="ulp-chart"
          viewBox="0 0 1000 285"
          role="img"
          aria-labelledby="ulp-plot-title"
          aria-describedby="ulp-plot-description"
        >
          <title id="ulp-plot-title">Positive FP16 ULP versus magnitude</title>
          <desc id="ulp-plot-description">
            A constant subnormal spacing of two to the minus twenty-four,
            followed by normal binades whose spacing doubles at each boundary
            after two to the minus fourteen. Select a region using the control
            below for keyboard access.
          </desc>
          <line className="plot-axis" x1={65} y1={228} x2={935} y2={228} />
          <line className="plot-axis" x1={65} y1={35} x2={65} y2={228} />
          {[-24, -16, -8, 0, 8, 16].map((e) => (
            <g key={e}>
              <line
                className="plot-grid"
                x1={x(2 ** e)}
                y1={35}
                x2={x(2 ** e)}
                y2={228}
              />
              <text
                className="plot-label"
                x={x(2 ** e)}
                y={251}
                textAnchor="middle"
              >
                2^{e}
              </text>
            </g>
          ))}
          {[-24, -16, -8, 0, 5].map((e) => (
            <g key={e}>
              <line
                className="plot-grid"
                x1={65}
                y1={y(2 ** e)}
                x2={935}
                y2={y(2 ** e)}
              />
              <text
                className="plot-label"
                x={53}
                y={y(2 ** e) + 4}
                textAnchor="end"
              >
                2^{e}
              </text>
            </g>
          ))}
          {regions.map((region, index) => (
            <g
              key={region.bits}
              className={`ulp-region ${selected === index ? 'selected' : ''}`}
              onClick={() => onSelect(region.lower)}
            >
              <title>{`${region.label}: [${formatExactFP16(region.lower)}, ${region.upper}); ULP ${formatExactFP16(region.ulp)}. Click to inspect the lower endpoint.`}</title>
              <rect
                x={x(region.lower)}
                y={35}
                width={x(region.upper) - x(region.lower)}
                height={193}
              />
              <line
                className="ulp-step"
                x1={x(region.lower)}
                y1={y(region.ulp)}
                x2={x(region.upper)}
                y2={y(region.ulp)}
              />
              {index > 0 && (
                <line
                  className="ulp-step"
                  x1={x(region.lower)}
                  y1={y(regions[index - 1].ulp)}
                  x2={x(region.lower)}
                  y2={y(region.ulp)}
                />
              )}
            </g>
          ))}
          {selected >= 0 && (
            <line
              className="magnitude-marker"
              x1={x(magnitude)}
              y1={35}
              x2={x(magnitude)}
              y2={228}
            />
          )}
          <text className="plot-label" x={500} y={278} textAnchor="middle">
            Positive magnitude (zero is excluded from a logarithmic axis)
          </text>
        </svg>
      </div>
      <label className="ulp-region-picker">
        Inspect spacing region
        <select
          aria-label="Inspect spacing region"
          value={selected < 0 ? '' : selected}
          onChange={(e) => {
            if (e.target.value !== '')
              onSelect(regions[Number(e.target.value)].lower)
          }}
        >
          <option value="">Magnitude outside plotted regions</option>
          {regions.map((region, index) => (
            <option key={region.bits} value={index}>
              {region.label} · ULP {formatExactFP16(region.ulp)}
            </option>
          ))}
        </select>
      </label>
      <div className="microscope-explanation-grid">
        <p>
          Each normal <strong>binade</strong> [2ᵉ, 2ᵉ⁺¹) has constant absolute
          spacing 2ᵉ⁻¹⁰. Spacing doubles at the next normal exponent boundary.
          The first normal binade shares subnormal spacing: there is no jump at
          2⁻¹⁴; the first doubling is at 2⁻¹³.
        </p>
        <p>
          Positive subnormals are uniformly spaced by 2⁻²⁴. Absolute precision
          stays fixed there, while relative error grows near zero. For nonzero
          normal inputs that do not overflow, nearest rounding bounds relative
          error by 2⁻¹¹. Negative magnitudes mirror the spacing shown here.
        </p>
      </div>
      <p className="text-small muted">
        Regions describe FP16 spacing, not a continuous set of representable
        values. 65536 is the virtual right binade boundary, not a finite FP16
        value (maximum 65504). Zero, NaN, and infinity are not plotted.
      </p>
    </section>
  )
}
