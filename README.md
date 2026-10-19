# FloatScope

An open-source interactive laboratory for understanding IEEE 754 floating-point arithmetic and numerical precision in AI accelerators.

FloatScope aims to connect bit representations, rounding decisions, and numerical effects through accessible visual explanations and carefully tested models.

## Current scope: Milestone 3

FloatScope now includes an interactive FP16 Explorer powered by the framework-independent IEEE 754 binary16 numerical engine. Vite, React, TypeScript, Tailwind CSS, Vitest, ESLint, Prettier, and GitHub Actions provide the foundation.

**Representation and bit manipulation are interactive.** Arithmetic operations, transformer attention, and hardware simulation remain future work.

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
- Decimal text is first parsed into a JavaScript binary64 Number. Parsing may round, or underflow to signed zero, before FP16 conversion. FloatScope does not parse decimal strings as exact rationals. The original text and parsed Number are shown to make this boundary visible.
- Raw NaN edits preserve sign, quiet/signaling bit, and payload. Submitting `NaN` canonicalizes to positive quiet NaN `0x7e00`; JavaScript Number cannot retain the original FP16 NaN metadata. Signaling-NaN exceptions and IEEE status flags are not simulated.
- ULP uses the engine's sign-independent binade-spacing definition, not necessarily the gap to the next greater value. Infinity returns Infinity and NaN returns NaN; neither has a finite ULP. Outward stepping at infinity saturates. NaN neighbor controls are disabled because NaNs are unordered.
- Browser visual review and screenshots were unavailable for this milestone: browser-connector inventory was empty and computer-use access to Google Chrome was not approved. Layout, theme appearance, focus rendering, and screen-reader announcements have not been verified in a real browser. Automated DOM tests cover the interactions and semantics; manual browser review is still needed.

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

Raw NaN inspection preserves the sign, fraction, quiet/signaling bit, and payload. JavaScript Numbers cannot preserve the original FP16 NaN payload or sign through conversion; encoding any Number NaN produces positive quiet NaN `0x7e00`. Exact representability includes signed zeros and infinities but excludes NaN by policy. Decimal strings, arithmetic operations, exception flags, and other rounding modes are outside this milestone. See the [full API contract, algorithms, validation, and limitations](src/lib/numerics/README.md).

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
  lib/numerics/           Binary16 conversion, introspection, types, and API docs
  tests/                  UI integration, presentation, numerical tests, and oracle
.github/workflows/ci.yml   Lint, formatting, tests, and production build
```

Tests retain all Milestone 2 numerical checks: all 65,536 binary16 patterns, every finite rounding midpoint and its binary64 neighbors on both signs, binary64 exponent extremes, NaN handling, adjacency, and ULP spacing. An independent lattice-search oracle supplements round trips; native FP16 references are compared automatically when available. Explorer integration tests use the actual engine and user-event for bit toggles, keyboard activation, decimal quantization, signed zero, every preset, class transitions, neighbors, invalid input, NaN metadata, and theme selection. Exact decimal display is independently checked against rational integer coordinates for every finite raw pattern. CI runs lint, formatting, tests, type checking, and production builds on Node 22.9.0 and Node 24 for pushes and pull requests.

## Roadmap

1. **Project foundation** — responsive shell, tooling, tests, docs, and CI (completed).
2. **Binary16 numerical engine** — encoding, decoding, rounding, and introspection (completed).
3. **Interactive FP16 Explorer** — bit editing, decimal quantization, explanations, presets, adjacent values, and ULP (this milestone). Richer number-line visualizations remain future work.
4. **Arithmetic traces** — step-by-step FP16 addition, multiplication, and rounding.
5. **Formats and AI experiments** — compare FP16, BF16, and FP32; explore transformer attention numerical precision.
6. **Optional hardware work** — original open RTL implementations and hardware validation.

The foundation, numerical engine, and representation Explorer are implemented. Later stages are planned capabilities, not delivery dates.

## Engineering principles

Numerical correctness comes first. Representation and rounding remain independent of the UI, with explicit tests for signed zeros, subnormals, infinities, NaNs, boundaries, and ties. Approximations and unsupported cases must be disclosed. See [AGENTS.md](AGENTS.md) for project conventions and the IEEE 754 testing policy.

Visualizations must work with keyboard navigation, visible focus, readable text, and alternatives to color-only meaning. Use public standards and original or appropriately licensed open-source implementations; proprietary hardware designs and internal Broadcom information are out of scope.

## License

[MIT](LICENSE) © 2026 FloatScope contributors.
