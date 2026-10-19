/**
 * Test-only oracle, independent of production code and binary64 bit extraction.
 * Enumerate the positive finite lattice in integer units of 2**-24, then search
 * its exact midpoint thresholds. Every table entry and midpoint is exact in Number.
 */
export const positiveFP16Values: readonly number[] = (() => {
  const units = Array.from({ length: 1024 }, (_, i) => i)
  for (let spacing = 1; spacing <= 2 ** 29; spacing *= 2) {
    for (let significand = 1024; significand < 2048; significand += 1) {
      units.push(significand * spacing)
    }
  }
  return units.map((value) => value * 2 ** -24)
})()

export function referenceEncodeFP16(value: number): number {
  if (Number.isNaN(value)) return 0x7e00
  const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0
  const magnitude = Math.abs(value)
  // 65520 is halfway from 65504 to the next unbounded-binade value 65536.
  // Ties choose that even significand and overflow to infinity.
  if (magnitude >= 65520) return sign + 0x7c00
  if (magnitude >= 65504) return sign + 0x7bff
  if (magnitude === 0) return sign

  let lower = 0
  let upper = positiveFP16Values.length - 1
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2)
    if (positiveFP16Values[middle] < magnitude) lower = middle
    else upper = middle
  }
  const midpoint = (positiveFP16Values[lower] + positiveFP16Values[upper]) / 2
  if (magnitude < midpoint) return sign + lower
  if (magnitude > midpoint) return sign + upper
  return sign + (lower % 2 === 0 ? lower : upper)
}

/** Adjacent binary64 Number around a positive finite value, for boundary probes. */
export function adjacentPositiveFloat64(
  value: number,
  direction: -1 | 1,
): number {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction))
  return view.getFloat64(0)
}
