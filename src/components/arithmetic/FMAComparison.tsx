import type { compareMultiplyAddFP16 } from '../../lib/numerics/fp16Multiply'
import { fp16BitsToHex } from '../../lib/numerics'
import { formatExactFP16 } from '../../lib/explorer/presentation'
import { formatExactDyadic } from '../../lib/arithmetic/presentation'
import { Encoding } from './Encoding'

export function FMAComparison({
  comparison,
}: {
  comparison: ReturnType<typeof compareMultiplyAddFP16>
}) {
  const { fused, nonfused, difference } = comparison
  const same = fused.bits === nonfused.bits
  const product = fused.exactProduct ?? nonfused.product.exactProduct
  return (
    <section
      aria-labelledby="fusion-comparison-heading"
      className="fusion-comparison"
    >
      <h3 id="fusion-comparison-heading">One rounding versus two</h3>
      <p className="muted">
        FMA computes exact A × B + C, then rounds once to FP16. Nonfused
        arithmetic rounds A × B to FP16 before the FP16 addition. This is not
        FP32 accumulation.
      </p>
      <div className="fusion-results">
        {[
          { title: 'Fused output', result: fused },
          { title: 'Rounded intermediate product', result: nonfused.product },
          { title: 'Nonfused output', result: nonfused },
        ].map(({ title, result }) => {
          return (
            <div className="panel" key={title}>
              <h4>{title}</h4>
              <p className="arithmetic-value" aria-label={title}>
                {formatExactFP16(result.decoded.value)}
              </p>
              <p className="font-mono" aria-label={`${title} hex`}>
                {fp16BitsToHex(result.bits)}
              </p>
              <Encoding bits={result.bits} label={`${title} binary`} />
              <dl className="fusion-flags">
                {Object.entries(result.flags).map(([flag, raised]) => (
                  <div key={flag}>
                    <dt>{flag}</dt>
                    <dd aria-label={`${title} ${flag}`}>
                      {raised ? 'Raised' : 'Clear'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
      <p>
        Exact unrounded product:{' '}
        <span className="font-mono" aria-label="Exact multiplication product">
          {product ? formatExactDyadic(product) : 'Not a finite product'}
        </span>
      </p>
      <p>
        Fused − nonfused:{' '}
        <span className="font-mono" aria-label="Fusion output difference">
          {difference === null
            ? 'Undefined for nonfinite outputs'
            : formatExactFP16(difference)}
        </span>
      </p>
      <p className="muted" aria-label="Fusion divergence explanation">
        {fused.decoded.classification === 'nan' ||
        nonfused.decoded.classification === 'nan'
          ? 'A NaN output is unordered. Compare special-value reasons, raw payloads, and flags; numerical equality is undefined.'
          : same
            ? 'Both encodings agree for these inputs. Intermediate rounding can still raise nonfused flags that a single fused operation does not.'
            : difference === null
              ? nonfused.product.flags.overflow &&
                Number.isFinite(fused.decoded.value)
                ? 'The nonfused path overflows its intermediate product before cancellation by C. FMA retains the finite exact product until after the sum, avoiding that intermediate range restriction.'
                : 'At least one path has a nonfinite output. Inspect the separate rounding and range decisions; a numerical difference is undefined.'
              : difference === 0
                ? 'The numerical values agree, but their signed-zero encodings differ.'
                : 'Rounding the intermediate product discards information before C is added. FMA retains that information through addition and makes a single final rounding decision.'}
      </p>
      <p className="muted text-small">
        Nonfused flags are the union of separate multiply and add flags. Fused
        flags describe only the final single operation. Trace paths share stage
        navigation; each shows its own actual stages, not synchronized chip
        cycles.
      </p>
    </section>
  )
}
