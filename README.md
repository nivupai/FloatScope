# FloatScope

An open-source interactive laboratory for understanding IEEE 754 floating-point arithmetic and numerical precision in AI accelerators.

FloatScope aims to connect bit representations, rounding decisions, and numerical effects through accessible visual explanations and carefully tested models.

## Current scope: Milestone 2

The project includes a framework-independent IEEE 754 binary16 numerical engine, built on the Vite, React, TypeScript, Tailwind CSS, Vitest, ESLint, Prettier, and GitHub Actions foundation. The existing application shell is unchanged: its FP16 Explorer remains a clearly labeled UI placeholder.

**Encoding, decoding, and numerical introspection are implemented as a library.** Interactive numerical controls, visualizations, and arithmetic operations remain future work.

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
  components/             Header, FP16 placeholder, and roadmap
  lib/numerics/           Binary16 conversion, introspection, types, and API docs
  tests/                  Shell tests, numerical tests, and independent oracle
.github/workflows/ci.yml   Lint, formatting, tests, and production build
```

Tests verify the shell plus all 65,536 binary16 patterns, every finite rounding midpoint and its binary64 neighbors on both signs, binary64 exponent extremes, NaN handling, adjacency, and ULP spacing. An independent lattice-search oracle supplements round trips; native FP16 references are compared automatically when available. CI runs lint, formatting, tests, type checking, and production builds on Node 22.9.0 and Node 24 for pushes and pull requests.

## Roadmap

1. **Project foundation** — responsive shell, tooling, tests, docs, and CI (completed).
2. **Binary16 numerical engine** — encoding, decoding, rounding, and introspection (this milestone). The interactive FP16 Explorer is still planned separately.
3. **Precision visualizations** — exponent, significand, representable values, and ULP spacing.
4. **Arithmetic traces** — step-by-step FP16 addition, multiplication, and rounding.
5. **Formats and AI experiments** — compare FP16, BF16, and FP32; explore transformer attention numerical precision.
6. **Optional hardware work** — original open RTL implementations and hardware validation.

Only the foundation and numerical engine are implemented. The remaining stages and interactive Explorer are planned capabilities, not delivery dates.

## Engineering principles

Numerical correctness comes first. Representation and rounding remain independent of the UI, with explicit tests for signed zeros, subnormals, infinities, NaNs, boundaries, and ties. Approximations and unsupported cases must be disclosed. See [AGENTS.md](AGENTS.md) for project conventions and the IEEE 754 testing policy.

Visualizations must work with keyboard navigation, visible focus, readable text, and alternatives to color-only meaning. Use public standards and original or appropriately licensed open-source implementations; proprietary hardware designs and internal Broadcom information are out of scope.

## License

[MIT](LICENSE) © 2026 FloatScope contributors.
