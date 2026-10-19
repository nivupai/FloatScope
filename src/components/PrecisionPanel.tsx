import {
  decodeFP16,
  fp16BitsToHex,
  nextDownFP16,
  nextUpFP16,
  ulpFP16,
} from '../lib/numerics'
import { formatExactFP16 } from '../lib/explorer/presentation'

export function PrecisionPanel({
  bits,
  onSelect,
}: {
  bits: number
  onSelect: (bits: number) => void
}) {
  const decoded = decodeFP16(bits)
  const isNaN = decoded.classification === 'nan'
  const neighbors = [
    { label: 'Previous', bits: nextDownFP16(bits) },
    { label: 'Current', bits },
    { label: 'Next', bits: nextUpFP16(bits) },
  ]
  return (
    <section className="panel precision" aria-labelledby="precision-heading">
      <p className="eyebrow">03 / Precision</p>
      <h3 id="precision-heading">One step on the number line</h3>
      <p className="muted text-small">
        Numerical neighbors, not consecutive unsigned bit patterns.
      </p>
      <div className="neighbors">
        {neighbors.map((neighbor) => (
          <div
            className={`neighbor ${neighbor.label === 'Current' ? 'current' : ''}`}
            key={neighbor.label}
          >
            <span className="neighbor-label">{neighbor.label}</span>
            <output
              aria-live="off"
              aria-label={`${neighbor.label} representable value`}
            >
              {isNaN && neighbor.label !== 'Current'
                ? 'Not ordered'
                : formatExactFP16(decodeFP16(neighbor.bits).value)}
            </output>
            <code>{fp16BitsToHex(neighbor.bits)}</code>
            {neighbor.label !== 'Current' && (
              <button
                type="button"
                className="text-button"
                disabled={isNaN || neighbor.bits === bits}
                onClick={() => onSelect(neighbor.bits)}
              >
                Select {neighbor.label.toLowerCase()}{' '}
                <span aria-hidden="true">
                  {neighbor.label === 'Previous' ? '←' : '→'}
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
      <dl className="ulp">
        <dt>
          ULP <span className="muted">/ binade spacing</span>
        </dt>
        <dd>
          <output aria-live="off" aria-label="ULP value">
            {formatExactFP16(ulpFP16(bits))}
          </output>
        </dd>
      </dl>
      <p className="muted text-small">
        ULP ignores sign and uses spacing on the larger-magnitude side of a
        power of two. It is not always the gap to the next greater value. At
        maximum finite magnitude it stays 32.
      </p>
      {decoded.classification === 'zero' && (
        <p className="precision-note">
          Both +0 (0x0000) and −0 (0x8000) have the same numerical neighbors: −2
          <sup>−24</sup> and +2<sup>−24</sup>. Numerical stepping skips the
          other zero encoding.
        </p>
      )}
      {decoded.classification === 'infinity' && (
        <p className="precision-note">
          Infinity has no finite ULP; the API returns Infinity. The inward step
          reaches the maximum finite magnitude. The outward step saturates at
          infinity.
        </p>
      )}
      {isNaN && (
        <p className="precision-note">
          NaN is unordered: numerical neighbors and ULP are undefined. The API
          preserves the raw NaN pattern when stepping and returns NaN for ULP.
        </p>
      )}
    </section>
  )
}
