# Precision microscope model and interface

Milestone 4 adds scientific exploration of representation and rounding; it does not simulate FP16 arithmetic operations. The original FP16 encoder, decoder, adjacency helpers, ULP definition, and all earlier tests remain unchanged. No plotting or other runtime dependency was added.

## Numerical API

Import the following pure functions from `src/lib/numerics/microscope.ts`:

- `generateFP16Viewport(min, max, limit = 121)` returns `{ points, total, sampled }` for an inclusive finite viewport. Each point has raw `bits`, exact binary64 `value`, and `ulp` from the existing engine. Bounds must be finite and strictly increasing with finite width. The integer rendering limit must be 2–512. Invalid arguments throw `RangeError`.
- `roundingIntervalFP16(bits)` returns `{ lower, upper, lowerIncluded, upperIncluded }`, or null for NaN. Raw bits are validated by the engine. The interval describes finite real inputs; exact signed-zero ownership additionally depends on input sign. Unbounded ends use infinities and are open. Explicit infinity inputs are handled separately by the encoder.
- `analyzeFP16Rounding(input)` returns the original binary64 value, selected raw bits and decoded structure, the selected pattern's previous/next numerical neighbors, cell, tie flag, rounding direction, absolute error, and relative error. Neighbors are of the quantized FP16 value, not an assertion that both bracket an arbitrary target. Native engine semantics for saturation at infinity and unordered NaNs remain in force.
- `fp16ULPRegions()` returns one positive subnormal region and thirty normal binades, with representative bits, bounds, exponent, and ULP from the engine. Region upper endpoints are excluded. Subnormals begin at the minimum positive representable value because zero has no logarithm. The final region ends at virtual 65536; its last actual point is 65504.
- `fitViewport(center, span)` bounds plot geometry; `viewportForTarget(value)` chooses a useful local window. These do not restrict the values accepted for numerical analysis.

## Efficient finite lattice

There are 63,487 distinct finite numerical positions: 31,743 negative nonzero values, one geometric zero, and 31,743 positive nonzero values. Both zero encodings coincide geometrically; the lattice uses +0 there. Raw input and quantized encodings still preserve -0.

Finite numerical ranks map monotonically to raw encodings. Two binary searches locate the inclusive visible range in O(log N). Only the requested rendering budget is decoded into point records. Small views show every value; large views select at most 121 actual points spread by rank, including the first and last visible points. Sampled spacing is not presented as FP16 spacing: the UI explicitly warns that omitted points remain representable. Tooltips and the data table report ULP from the engine, never the distance between sampled markers.

## Rounding cells and ties

For finite nonzero value `v`, cell endpoints are exact midpoints `(previous + v)/2` and `(v + next)/2`. Adjacent FP16 values and their midpoints are exactly representable in binary64. Both endpoints belong to the cell iff the retained significand is even (the raw encoding's low bit is zero); odd significands have open endpoints.

For example, the cell of 1 is **[0.999755859375, 1.00048828125]**. Its asymmetry reflects the smaller binade immediately below 1. The value 1.0001 rounds to 1, and the upper exact halfway boundary also rounds to 1 by ties-to-even. The smallest normal, however, shares the subnormal spacing on both sides: there is no spacing jump at `2**-14`.

Positive zero has the half-cell `[0, 2**-25]`; negative zero has `[-2**-25, -0]`, with exact zeros distinguished by sign. The nonzero endpoints are ties won by zero's even significand. Zero itself is a sign seam, not a rounding tie. Square cell-boundary markers are distinct from round representable-point markers.

At maximum finite magnitude, the virtual next unbounded-binade value is ±65536. The last finite positive pattern 65504 therefore has cell **(65488, 65520)**, and positive infinity owns finite inputs **[65520, Infinity)**. The negative counterpart is **(-Infinity, -65520]**. Overflow ties carry the even significand beyond FP16's finite exponent range. Infinity is never placed at a fake finite coordinate.

Cells shade the selected encoding's preimage, clipped to the viewport; they are not additional representable values. The exact halfway test uses equality against dyadic boundaries, with no epsilon or approximate tie detection. Near-tie binary64 inputs are not treated as ties.

## Errors and decimal semantics

For a finite binary64 input `x` and its quantized value `q`:

- Absolute error is `abs(q - x)`.
- Relative error is `abs(q - x) / abs(x)` for nonzero `x`; it is undefined at either signed zero.
- Nonfinite original inputs have undefined absolute and relative errors, rather than reporting `Infinity - Infinity` as zero.
- A finite input that quantizes to infinity has infinite absolute and relative error.

Errors are computed using JavaScript binary64 arithmetic; relative division is rounded to binary64. Binary64 readouts use shortest round-trip decimal strings. They are not claims about exact input-decimal semantics. Submitted input text is retained separately because decimal parsing may already round or underflow before analysis. FP16 values use the existing exact 24-place formatter; finite cell boundaries require up to 25 decimal places and use their own exact dyadic formatter. Axis tick labels use six significant digits for readability and are explicitly labeled as rounded.

## Positive ULP chart

The chart uses log₂ magnitude and log₂ absolute ULP axes. In a normal binade `[2**e, 2**(e+1))`, spacing is `2**(e-10)`. It is constant inside each binade and doubles at normal exponent transitions. The first normal binade and all subnormals both use `2**-24`; the first doubling is at `2**-13`.

For input magnitudes at least `2**-14` that quantize to a finite value, round-to-nearest bounds relative error by `2**-11`. Subnormal absolute spacing is fixed while relative precision worsens near zero; at underflow to zero the relative error of a nonzero input is 1. Negative magnitudes mirror the positive spacing. Zero, infinity, and NaN are excluded from logarithmic geometry. Region rectangles are interactive binade selectors, not a claim that every real point in the rectangle is representable.

## Interaction and scope limits

- The Explorer and microscope have independent selections. Text target input, finite-point dropdown, point clicks, and the target slider all use the actual numerical engine. Only target movement is continuous binary64 positioning; point selection chooses an exact FP16 value.
- Drag mode chooses target movement or viewport panning. Left/Right on the focused number line pan a quarter-view; +/− zoom about its center; Up/Down move the target by 1% of the view (starting from the center when it is off-axis). Buttons provide equivalent viewport navigation.
- The slider has 1,001 normalized positions; text input supports arbitrary parsed binary64 values independently of that resolution. Point dropdowns and the table describe only the currently rendered samples.
- Plot coordinates are constrained to ±131072, with viewport width between `2**-30` and 262144. These are intentional visualization limits, not FP16 or binary64 limits. Inputs outside the plot are still analyzed, with an off-axis notice. Fit target centers extreme inputs near the relevant overflow boundary; NaN uses a finite default window.
- SVG geometry is approximate screen projection; mathematical selection, ties, and cell membership are not inferred from rounded axis labels or pixel distances. Narrow screens scroll charts and data tables horizontally; textual analysis and controls reflow.
- Charts inherit the app's light/dark/system theme and reduced-motion behavior. Native SVG titles provide pointer tooltips; keyboard users have point/region selectors, data tables, and labeled readouts.
- No FP16 arithmetic operations, other formats, transformer experiments, hardware simulation, alternate rounding modes, or exception flags are implemented.

## Validation and browser status

Tests compare generated viewports against the earlier, independent integer-lattice oracle. Every finite nonzero cell is checked against independently enumerated adjacent values and both endpoint owners. Dedicated cases cover both signs, signed zeros, normal/subnormal transitions, exact ties and nearby inputs, overflow, error definitions, and all positive ULP regions.

DOM integration tests use the real engine and exercise every example, original-versus-quantized display, keyboard pan/zoom/target movement, native point/region selectors, slider changes, invalid/nonfinite input, sampling notices, and pointer target/pan mapping. jsdom lacks layout, so the pointer test supplies a bounding rectangle; it does not mock numerical decoding.

Browser connection inventory was empty during Milestone 4. Real-browser layout, pointer capture, native tooltips, touch behavior, focus appearance, theme appearance, and screen-reader announcements remain unverified. No screenshot or successful real-browser verification is claimed.
