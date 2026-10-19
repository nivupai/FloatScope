import { formatNumber } from '../explorer/presentation'
import type { RoundingInterval } from '../numerics/microscope'

/** FP16 rounding-cell boundaries are dyadic rationals with at most 25 decimals. */
export function formatBoundary(value: number): string {
  if (!Number.isFinite(value) || value === 0) return formatNumber(value)
  return value.toFixed(25).replace(/\.?0+$/, '')
}
export function formatInterval(interval: RoundingInterval | null): string {
  if (!interval) return 'Undefined for NaN'
  return `${interval.lowerIncluded ? '[' : '('}${formatBoundary(interval.lower)}, ${formatBoundary(interval.upper)}${interval.upperIncluded ? ']' : ')'}`
}
