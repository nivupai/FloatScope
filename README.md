# FP Play

An open-source interactive laboratory for understanding IEEE 754 floating-point arithmetic and numerical precision in AI accelerators.

FP Play aims to connect bit representations, rounding decisions, and numerical effects through accessible visual explanations and carefully tested models.

## Current scope: Milestone 5

FP Play includes an interactive FP16 Explorer, a **Floating-Point Precision Microscope**, and an **Arithmetic Pipeline Explorer**, powered by the validated binary16 numerical models. The microscope connects discrete representable values, rounding cells, quantization error, and ULP spacing across the number line. Vite, React, TypeScript, Tailwind CSS, Vitest, ESLint, Prettier, and GitHub Actions provide the foundation.

**Representation, precision exploration, and FP16 addition/subtraction traces are interactive.** The new Arithmetic Explorer uses exact dyadic arithmetic, one nearest-even rounding, and computation-derived stages. Multiplication, FMA, division, transformer attention, and hardware simulation remain future work. No application dependencies were added.

## Using the Arithmetic Explorer

Open **Arithmetic** in the header, or scroll below the microscope.

1. Choose **Decimal / special value** or **Raw hexadecimal** for each operand. Enter decimal/scientific text, `-0`, `Infinity`, `-Infinity`, or `NaN`; raw mode accepts exactly `0x` and four hex digits, such as `0xfc11`. Choose **A + B** or **A − B**, then **Trace operation** (or Enter in an input). Draft edits do not change applied results; invalid input retains the previous operation.
2. Inspect the two applied **quantized FP16 operands**, with original input text and parsed binary64 value separately identified. Decimal parsing and operand quantization happen **before** arithmetic. Raw hex retains NaN sign/payload/signaling metadata; decimal `NaN` is canonical quiet `0x7e00`.
3. Compare the **exact mathematical result of the FP16 operands** with the final FP16 decimal, binary, and hex result. All finite decimal readouts are exact terminating expansions, including an overflow's finite pre-rounding sum; signed zero remains visible.
4. Use **Previous stage / Next stage**, or select any stage directly. Focus the detail panel for **Left/Right** and **Home/End** shortcuts. Native stage buttons support Tab, Space, and Enter. Inspect the lossless alignment tail, signed integer sum, normalization shifts, guard/round/sticky bits, tie parity, carry, result encoding, and per-operation flags. Long binary rows scroll within their panels on small screens.
5. Try all ten explained presets: exact addition, large exponent difference, nearest-even tie, cancellation, subnormal arithmetic, transition to normal, overflow, infinity arithmetic, invalid infinities, and signaling NaN. Each preset displays its expected raw result.

### Arithmetic semantics

`addFP16(aBits, bBits)`, `subtractFP16(aBits, bBits)`, and `calculateFP16(aBits, bBits, 'add' | 'subtract')` accept validated raw uint16 patterns. They return result `bits`, `decoded`, an exact dyadic `{ coefficient: bigint, exponent, value }` for finite operands, a discriminated stage `trace`, and `flags`. `value` is an exact binary64 display projection; the core uses BigInts, not Number addition. Finite dyadics are aligned without discarding any tail, summed with signs, normalized, and rounded **once, nearest, ties to even**. The GRS increment rule is `guard && (round || sticky || retainedOdd)`.

```ts
import { addFP16, subtractFP16 } from './src/lib/numerics'

addFP16(0x3c00, 0x1000).bits // 0x3c00: 1 + 2^-11, tie to even
addFP16(0x3c01, 0x1000).bits // 0x3c02: odd tie increments
subtractFP16(0x3c01, 0x3c00).bits // 0x1400: cancellation gives 2^-10
addFP16(0x7bff, 0x4c00).flags // overflow + inexact: 65520 rounds to Infinity
addFP16(0xfc11, 0x3c00).bits // 0xfe11: quiet signaling NaN, preserve sign/payload
```

- **NaNs:** select the first signaling NaN in A/B order, otherwise the first quiet NaN. Set the quiet bit and preserve the selected operand's original sign and low nine payload bits, including for subtraction. Any signaling NaN raises invalid; quiet NaNs alone do not. Opposite effective infinities (including Infinity − Infinity) return canonical quiet NaN `0x7e00` with invalid. NaN classification/invalid behavior is distinct from this **implementation-specific payload policy**.
- **Zeros:** exact cancellation is +0 under nearest-even; two effective negative zero operands sum to −0. Subtraction first reverses B's arithmetic sign. Subnormal results are retained rather than flushed to zero.
- **Flags:** `invalid`, `overflow`, `underflow`, and `inexact` describe this operation only; there is no sticky global status. Overflow returns signed infinity and sets inexact, even when no significand bits were discarded. Underflow means **tiny after rounding AND inexact**. All finite FP16 operands are multiples of `2**-24`; any tiny sum/difference is consequently exactly representable, so add/sub cannot raise underflow. Input conversion flags are outside this arithmetic result. Division-by-zero is irrelevant to add/sub and is not exposed.
- **Trace:** finite operations have eight conceptual stages; specials have decode → special-value short circuit → encode. These are explanatory algorithm stages, **not clock cycles, latency, RTL, or a proprietary hardware pipeline**. Returned BigInt fields require explicit conversion before JSON serialization.

FP16's eleven-bit normal significand makes accelerator storage and arithmetic economical, but alignment can move a small contribution entirely below retained precision. Repeated rounded additions can lose contributions or amplify cancellation effects; accumulation format and operation ordering therefore matter. This milestone demonstrates single add/sub operations, not accelerator performance, reductions, or a specific device's handling of denormals.

See [the arithmetic model, trace contract, and reproducible validation](src/lib/arithmetic/README.md). This limited educational model does **not claim full IEEE 754 conformance**: only binary16 add/sub and nearest-even are supported. No multiplication, FMA, division, alternate rounding modes, hardware timing, or global exception state is implemented.

### Milestone 5 verification

**275 tests pass on Node 22.9.0 and Node 24**, including all 191 existing tests unchanged, 61 new arithmetic tests, and 23 new UI integration tests. Lint, formatting, TypeScript, and the production build pass. New tests include independent lattice-based differential arithmetic, every raw operand's zero identities, exhaustive finite cancellation, all attainable outward rounding midpoints on both signs, directed boundaries, deterministic random pairs, trace reconstruction, and real-engine DOM/keyboard integration.

Optional external validation against Berkeley SoftFloat revision `a0c6494cdc11865811dec815d5c0049fba9d82a8` checked **231,872 add/sub operations with zero mismatches** for non-NaN result bits and all four flags. For 10,572 NaN results, quiet classification and flags match; payload/sign policy is checked by directed internal tests because SoftFloat's specialization selects payloads differently. SoftFloat's BSD-licensed source and compiled library stay outside this repository. The corpus is not exhaustive over all operand pairs; TestFloat and full standards conformance testing were not run.

Browser inventory had no connected browsers during Milestone 5. DOM interaction and keyboard tests pass; actual browser layout, theme contrast, focus rendering, touch scrolling, and screen-reader announcements remain unverified. No screenshot is claimed.

## Using the Precision Microscope

Open **Microscope** in the header, or scroll below the existing Explorer.

1. Enter a decimal/scientific binary64 target and press **Analyze target** or Enter. Input conventions match the Explorer, including `-0`, infinities, and NaN. The last applied text, parsed binary64 Number, quantized FP16 value, neighbors, rounding direction, absolute error, relative error, and selected binary/hex encoding are reported separately.
2. Use **Zoom in/out**, **Pan left/right**, **Fit target**, and **Overview**. Round markers are actual FP16 values; the cross marks the binary64 target and the diamond its quantized value. Shading shows the selected rounding cell; square endpoints and dashed boundaries distinguish it from discrete points. Tooltips explain exact point values and their ULP spacing.
3. Choose **Move target** or **Pan viewport** drag mode. The target slider moves between representable values; clicking a point or using **Inspect a visible FP16 point** selects an exact FP16 value. The expandable point table gives exact values, binary, hex, and ULP.
4. Keyboard users can focus the number line: **Left/Right** pan, **+/−** zoom, and **Up/Down** move the binary64 target by 1% of the current view. Native buttons, the slider, and point/region dropdowns provide text controls for the same exploration.
5. Try all seven explained experiments: why **1.0001 becomes 1**, spacing near **1** and **1000**, subnormal precision, gradual underflow, exponent boundaries, and maximum finite/overflow behavior.
6. Inspect the positive **ULP-versus-magnitude** chart. Both axes are logarithmic (base 2). Click a region or use **Inspect spacing region** to focus the local number line on that binade. Negative magnitudes mirror positive spacing.

### Mathematical definitions and examples

- A normal binade `[2**e, 2**(e+1))` has constant absolute spacing `2**(e-10)`. Normal exponent transitions double spacing; subnormals and the first normal binade both have spacing `2**-24`. There is **no spacing jump at the smallest normal**, `2**-14`.
- A nearest-even rounding cell is bounded by exact midpoints to adjacent FP16 values. Even retained significands own their halfway endpoints; odd ones do not. The cell of 1 is **[0.999755859375, 1.00048828125]**: 1.0001 rounds to 1, and the upper endpoint also rounds to 1 by ties-to-even. Cells at powers of two can be asymmetric.
- Signed zeros share a geometric point but have sign-dependent half-cells ending at ±`2**-25`. Zero itself is a sign seam, not a halfway tie. Maximum finite FP16 is 65504; the exact overflow tie is 65520, halfway to virtual 65536, which overflows after significand carry. Negative overflow is symmetric.
- Absolute error is `abs(FP16 - binary64 input)`. Relative error divides that by `abs(input)` and is undefined at zero. Errors for nonfinite original inputs are undefined; finite inputs that overflow FP16 have infinite error. Relative division uses binary64 arithmetic and may round.
- Constant absolute spacing is different from relative precision: spacing near 1000 is 0.5, versus `2**-10` immediately above 1. Subnormal spacing stays fixed as relative precision deteriorates toward zero. For input magnitudes at least `2**-14` with finite quantization, nearest-rounding relative error is bounded by `2**-11`.

### Microscope limits and validation

The plot domain is ±131072, with viewport widths from `2**-30` to 262144. Analysis still accepts arbitrary binary64 values; extreme or nonfinite targets are explicitly marked off-axis. The finite numerical lattice has **63,487 positions**, combining both zero encodings geometrically. Visible values are located by binary search, and the renderer caps points at **121**. Wide views explicitly disclose sampling: omitted points are still representable. Zoom in to resolve individual gaps. Tooltips report engine ULP, never a misleading gap between sampled markers.

Decimal parsing is binary64-first, not exact decimal-rational conversion. Binary64/error readouts use shortest round-trip strings; FP16 readouts and finite rounding boundaries use exact decimal expansions. Axis labels are rounded to six significant digits, and SVG coordinates are approximate screen projections. The target slider has 1,001 normalized positions; text input remains independent of slider resolution. Charts and tables scroll horizontally on narrow screens while controls/readouts reflow.

Tests retain all 133 earlier checks and add independent-lattice viewport comparisons, exhaustive finite-cell endpoint ownership, ULP region validation, and real-engine DOM integration for every example, errors, ties, special values, keyboard controls, sampling, native selectors, and pointer target/pan mapping. Browser connection inventory was empty during Milestone 4: real-browser layout, pointer capture/touch, native tooltips, focus/theme appearance, and screen-reader behavior remain unverified. No screenshot or successful browser review is claimed.

See the [microscope model, API, mathematics, and validation notes](src/lib/microscope/README.md) for complete definitions and limitations.

## Using the FP16 Explorer

1. Start the app with the setup commands below. The initial pattern is **1.5 / 0x3e00**.
2. Toggle any of the sixteen bits by clicking its button, or use **Tab** to focus it and **Space/Enter** to toggle. Sign, exponent, and fraction have distinct colors, visible labels, bit positions, and accessible pressed states.
3. Enter a decimal or scientific-notation value and select **Convert to FP16** (or press Enter). The comparison shows the entered text, parsed binary64 Number, and the rounded FP16 value separately. Conversion uses nearest, ties-to-even. Incomplete or invalid submissions show an error and preserve the selected pattern.
4. Read the exact decoded decimal value, classification, raw fields, exponent bias, unbiased exponent, implicit leading bit, hexadecimal encoding, and class-specific mathematical explanation.
5. Select a reference preset, or step to a previous/next numerical neighbor. The precision panel explains binade ULP, signed zeros, infinities, and unordered NaNs. Neighbor buttons follow numerical order, not unsigned encoding order; both zeros skip the other zero encoding when stepping.
6. Choose **System**, **Light**, or **Dark** theme in the header. System follows the OS color preference; manual selections last for the current page session. Layouts adapt to mobile widths, and reduced-motion preferences disable transitions.

Accepted input examples: `0.1`, `-0.125`, `.5`, `1.5e0`, `-0`, `Infinity`, `+Infinity`, `-Infinity`, and `NaN`. Special tokens are case-insensitive and surrounding whitespace is ignored. Use ASCII `-` for negative input. Hexadecimal strings, digit separators, malformed numbers, empty input, and decimals outside the finite binary64 range are rejected. Explicit infinity tokens are accepted.

Presets use explicit validated bit patterns for +0, -0, 1.0, 1.5, the smallest/largest positive subnormals, the smallest positive normal, maximum finite positive, positive infinity, and quiet NaN with payload 1 (`0x7e01`). Editing bits, selecting a preset, or stepping to a neighbor clears the last conversion comparison and synchronizes the decimal field with the decoded value. Editing the decimal text alone does not change the selected bits; comparison results are labeled **Last converted input** until another conversion.

### Display and input limitations

- Finite FP16 output uses its exact terminating decimal expansion (up to 24 fractional places), with no display rounding; negative zero is shown as `-0`.
- Decimal text is first parsed into a JavaScript binary64 Number. Parsing may round, or underflow to signed zero, before FP16 conversion. FP Play does not parse decimal strings as exact rationals. The original text and parsed Number are shown to make this boundary visible.
- Raw NaN edits preserve sign, quiet/signaling bit, and payload. Submitting `NaN` canonicalizes to positive quiet NaN `0x7e00`; JavaScript Number cannot retain the original FP16 NaN metadata. The representation Explorer does not execute signaling NaNs or report conversion exception flags; the Arithmetic Explorer separately models add/sub indicators.
- ULP uses the engine's sign-independent binade-spacing definition, not necessarily the gap to the next greater value. Infinity returns Infinity and NaN returns NaN; neither has a finite ULP. Outward stepping at infinity saturates. NaN neighbor controls are disabled because NaNs are unordered.
- Real-browser visual verification is unavailable in the current environment. Automated DOM tests cover interactions and semantics; manual review of layout, themes, focus rendering, and screen-reader announcements is still needed.

## IEEE 754 binary16 (FP16)

Binary16 uses **1 sign bit**, **5 exponent bits**, and **10 stored fraction bits**, with an **exponent bias of 15**. Normal values have an implicit leading 1, giving eleven bits of significand precision. Exponent zero encodes signed zero or subnormals; exponent 31 encodes infinities or NaNs.

For a normal value, `value = (-1)**sign * (1 + fraction/1024) * 2**(exponent-15)`. Subnormals use `value = (-1)**sign * fraction * 2**-24`. The smallest positive subnormal is `2**-24`, the smallest positive normal is `2**-14`, and the maximum finite value is **65504**.

```ts
import {
  decodeFP16,
  floatToFP16Bits,
  formatFP16Bits,
  fp16BitsToFloat,
  fp16BitsToHex,
  isExactlyRepresentableFP16,
  nextUpFP16,
  ulpFP16,
} from './src/lib/numerics'

const bits = floatToFP16Bits(1.5) // 0x3e00
fp16BitsToHex(bits) // '0x3e00'
formatFP16Bits(bits) // '0011111000000000'
decodeFP16(bits) // normal; sign 0, exponent 15, fraction 512, value 1.5
fp16BitsToFloat(nextUpFP16(bits)) // 1.5009765625
ulpFP16(bits) // 0.0009765625 (2**-10)
isExactlyRepresentableFP16(0.1) // false
Object.is(fp16BitsToFloat(0x8000), -0) // true
floatToFP16Bits(1 + 2 ** -11) // 0x3c00: exact halfway tie rounds to even
```

Encoding rounds directly from the input binary64 Number to binary16 using round-to-nearest, ties-to-even, including gradual underflow and overflow. Raw-bit APIs accept integers from 0 to 65535 and throw `RangeError` for invalid patterns. Adjacent-value APIs accept and return **raw bit patterns**. ULP means sign-independent binade spacing: `2**-24` at zero/subnormals, 32 at maximum finite magnitude, Infinity at infinities, and NaN at NaNs.

Raw NaN inspection preserves the sign, fraction, quiet/signaling bit, and payload. JavaScript Numbers cannot preserve the original FP16 NaN payload or sign through conversion; encoding any Number NaN produces positive quiet NaN `0x7e00`. Exact representability includes signed zeros and infinities but excludes NaN by policy. The conversion/introspection APIs do not expose exception flags or alternative rounding modes. Arithmetic is provided by the separate add/sub model described above. See the [full API contract, algorithms, validation, and limitations](src/lib/numerics/README.md).

## Setup

Use Node.js **22.9.0** (the inspected development environment) and npm **10.8.3**, or a compatible newer Node release as specified in `package.json`.

```sh
# Optional, if nvm is installed:
nvm use

npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

The package lock pins exact dependency resolutions. Vite 6.4, the React plugin 4, Vitest 4, and ESLint 9 are selected to support the installed Node 22.9 environment. Newer tool majors require a newer Node runtime. typescript-eslint 8.55 and TypeScript 5.9 are paired because newer lint releases transitively require Node 22.13 or later. jsdom 26 is retained because jsdom 27's dependencies fail with `ERR_REQUIRE_ESM` on Node 22.9. Engine checks are enforced through `.npmrc`. Check engine, peer, and runtime requirements together before upgrading.

## Commands

| Command                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the local development server                     |
| `npm test`             | Run the Vitest suite once                              |
| `npm run test:watch`   | Watch tests during development                         |
| `npm run lint`         | Run ESLint with no warnings allowed                    |
| `npm run typecheck`    | Type-check application, tests, and tool configuration  |
| `npm run format`       | Format source and documentation with Prettier          |
| `npm run format:check` | Check formatting without writing                       |
| `npm run build`        | Type-check the app and config, then build into `dist/` |
| `npm run preview`      | Serve the production build locally                     |
| `npm run check`        | Run all lint, formatting, test, and build checks       |

Run `npm run build` before `npm run preview`. The preview server is intended for local verification. This milestone does not configure deployment.

## Source layout

```text
src/
  App.tsx                 Application composition and overview
  main.tsx                React entry point
  styles.css              Tailwind import and shared accessible styles
  components/             Explorer, bit fields, breakdown, precision, and shell
  lib/explorer/           Decimal input, exact display formatting, and presets
  lib/microscope/         Precision examples, boundary formatting, and model docs
  lib/numerics/           Binary16 conversion, introspection, types, and API docs
    fp16Arithmetic.ts     Exact add/sub and typed computation trace
    microscope.ts         Pure lattice, viewport, rounding-cell, error, ULP models
  lib/arithmetic/         Arithmetic presentation, examples, and model docs
  components/arithmetic/  Operand/result UI and stage viewer
  components/microscope/  Number line, ULP chart, and microscope composition
  tests/                  UI integration, presentation, numerical tests, and oracle
.github/workflows/ci.yml   Lint, formatting, tests, and production build
```

Tests retain all Milestone 2 numerical checks: all 65,536 binary16 patterns, every finite rounding midpoint and its binary64 neighbors on both signs, binary64 exponent extremes, NaN handling, adjacency, and ULP spacing. An independent lattice-search oracle supplements round trips; native FP16 references are compared automatically when available. Explorer integration tests use the actual engine and user-event for bit toggles, keyboard activation, decimal quantization, signed zero, every preset, class transitions, neighbors, invalid input, NaN metadata, and theme selection. Exact decimal display is independently checked against rational integer coordinates for every finite raw pattern. CI runs lint, formatting, tests, type checking, and production builds on Node 22.9.0 and Node 24 for pushes and pull requests.

## Roadmap

1. **Project foundation** — responsive shell, tooling, tests, docs, and CI (completed).
2. **Binary16 numerical engine** — encoding, decoding, rounding, and introspection (completed).
3. **Interactive FP16 Explorer** — bit editing, decimal quantization, explanations, presets, adjacent values, and ULP (completed).
4. **Precision Microscope** — interactive number line, rounding cells, error analysis, and ULP/binade exploration (completed).
5. **Arithmetic traces** — exact FP16 addition/subtraction and computation-derived rounding traces (this milestone); multiplication is future work.
6. **Formats and AI experiments** — future FP16, BF16, FP32, and transformer attention precision experiments.
7. **Optional hardware work** — original open RTL implementations and hardware validation.

The foundation, numerical engine, representation Explorer, precision microscope, and addition/subtraction explorer are implemented. Later stages are planned capabilities, not delivery dates.

## Engineering principles

Numerical correctness comes first. Representation and rounding remain independent of the UI, with explicit tests for signed zeros, subnormals, infinities, NaNs, boundaries, and ties. Approximations and unsupported cases must be disclosed. See [AGENTS.md](AGENTS.md) for project conventions and the IEEE 754 testing policy.

Visualizations must work with keyboard navigation, visible focus, readable text, and alternatives to color-only meaning. Use public standards and original or appropriately licensed open-source implementations; proprietary hardware designs and internal Broadcom information are out of scope.

## License

[MIT](LICENSE) © 2026 contributors. See the license for original attribution.
