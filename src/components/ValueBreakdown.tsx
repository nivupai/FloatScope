import { formatFP16Bits, fp16BitsToHex } from '../lib/numerics'
import type { DecodedFP16 } from '../lib/numerics'
import { formatExactFP16 } from '../lib/explorer/presentation'

function ValueExplanation({ decoded: d }: { decoded: DecodedFP16 }) {
  if (d.classification === 'normal')
    return (
      <>
        <p className="equation">
          (−1)<sup>{d.sign}</sup> × (1 + {d.fraction}/1024) × 2
          <sup>{d.unbiasedExponent}</sup>
        </p>
        <p>
          The leading 1 is implicit. The exponent field {d.exponent} minus bias
          15 gives {d.unbiasedExponent}.
        </p>
      </>
    )
  if (d.classification === 'subnormal')
    return (
      <>
        <p className="equation">
          (−1)<sup>{d.sign}</sup> × (0 + {d.fraction}/1024) × 2<sup>−14</sup>
        </p>
        <p>
          No implicit leading 1. Subnormals use exponent −14 and a fixed spacing
          of 2<sup>−24</sup>, allowing gradual underflow toward zero.
        </p>
      </>
    )
  if (d.classification === 'zero')
    return (
      <>
        <p className="equation">{d.sign === 1 ? '−0' : '+0'}</p>
        <p>
          Exponent and fraction are both zero. The sign bit preserves{' '}
          {d.sign === 1 ? 'negative' : 'positive'} zero; both zeros compare
          numerically equal.
        </p>
      </>
    )
  if (d.classification === 'infinity')
    return (
      <>
        <p className="equation">{d.sign === 1 ? '−∞' : '+∞'}</p>
        <p>
          An all-ones exponent with a zero fraction encodes{' '}
          {d.sign === 1 ? 'negative' : 'positive'} infinity. No finite
          significand formula applies.
        </p>
      </>
    )
  return (
    <>
      <p className="equation">
        {d.isQuietNaN ? 'Quiet' : 'Signaling'} NaN · payload {d.nanPayload}
      </p>
      <p>
        An all-ones exponent with a nonzero fraction encodes NaN. The quiet bit
        is {d.isQuietNaN ? 1 : 0}; the low nine payload bits hold {d.nanPayload}
        . Raw sign {d.sign} and payload stay in the encoding. Number conversion
        cannot retain them and re-encoding canonicalizes to 0x7e00. No NaN
        exception flags are simulated.
      </p>
    </>
  )
}

export function ValueBreakdown({ decoded }: { decoded: DecodedFP16 }) {
  const binary = formatFP16Bits(decoded.bits)
  const rows = [
    ['Classification', decoded.classification],
    ['Sign bit', `${decoded.sign} (${decoded.sign ? 'negative' : 'positive'})`],
    ['Raw exponent', `${binary.slice(1, 6)}₂ = ${decoded.exponent}`],
    ['Exponent bias', '15'],
    [
      'Unbiased exponent',
      decoded.unbiasedExponent === null
        ? 'Not applicable'
        : String(decoded.unbiasedExponent),
    ],
    ['Fraction', `${binary.slice(6)}₂ = ${decoded.fraction}`],
    [
      'Implicit leading bit',
      decoded.hasImplicitLeadingBit
        ? '1 (present)'
        : decoded.classification === 'subnormal'
          ? '0 (no implicit 1)'
          : 'Not applicable',
    ],
    ['Hexadecimal', fp16BitsToHex(decoded.bits)],
  ]
  return (
    <section className="panel breakdown" aria-labelledby="breakdown-heading">
      <p className="eyebrow">02 / Decoding</p>
      <h3 id="breakdown-heading">Anatomy of this value</h3>
      <div className="exact-value">
        <span className="muted text-small">Exact decoded decimal value</span>
        <output
          aria-live="off"
          aria-label="Exact decoded value"
          className="value-number"
        >
          {formatExactFP16(decoded.value)}
        </output>
      </div>
      <dl className="breakdown-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <output aria-live="off" aria-label={label}>
                {value}
              </output>
            </dd>
          </div>
        ))}
      </dl>
      <div className="explanation" aria-label="Value explanation">
        <ValueExplanation decoded={decoded} />
      </div>
    </section>
  )
}
