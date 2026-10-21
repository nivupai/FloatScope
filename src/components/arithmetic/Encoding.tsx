import { formatFP16Bits } from '../../lib/numerics'

export function Encoding({ bits, label }: { bits: number; label: string }) {
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
