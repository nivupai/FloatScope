# FloatScope

An open-source interactive laboratory for understanding IEEE 754 floating-point arithmetic and numerical precision in AI accelerators.

FloatScope aims to connect bit representations, rounding decisions, and numerical effects through accessible visual explanations and carefully tested models.

## Current scope: Milestone 1

This milestone provides the project foundation: Vite, React, strict TypeScript, Tailwind CSS, Vitest, ESLint, Prettier, and GitHub Actions. The responsive application includes a project overview, section navigation, a roadmap, and a clearly labeled FP16 Explorer placeholder with a static binary16 field layout.

**No floating-point encoding, decoding, or arithmetic is implemented yet.** The explorer has no interactive numerical controls or computed results.

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
  lib/numerics/           Reserved for future pure numerical utilities
  tests/                  Test setup and application shell tests
.github/workflows/ci.yml   Lint, formatting, tests, and production build
```

Tests currently verify semantic shell structure, navigation targets, and explicit placeholder disclosure. They do not claim numerical coverage: numerical code will arrive with later milestones. CI runs the same checks on Node 22.9.0 and Node 24 for pushes and pull requests once a remote repository exists.

## Roadmap

1. **Project foundation** — responsive shell, tooling, tests, docs, and CI (this milestone).
2. **FP16 Explorer** — interactive IEEE 754 binary16 bit manipulation and decoding; decimal encoding with round-to-nearest, ties-to-even.
3. **Precision visualizations** — exponent, significand, representable values, and ULP spacing.
4. **Arithmetic traces** — step-by-step FP16 addition, multiplication, and rounding.
5. **Formats and AI experiments** — compare FP16, BF16, and FP32; explore transformer attention numerical precision.
6. **Optional hardware work** — original open RTL implementations and hardware validation.

These are planned stages, not implemented capabilities or delivery dates.

## Engineering principles

Numerical correctness comes first. Future models will keep representation and rounding independent of the UI and will explicitly test signed zeros, subnormals, infinities, NaNs, boundaries, and ties. Approximations and unsupported cases must be disclosed. See [AGENTS.md](AGENTS.md) for project conventions and the IEEE 754 testing policy.

Visualizations must work with keyboard navigation, visible focus, readable text, and alternatives to color-only meaning. Use public standards and original or appropriately licensed open-source implementations; proprietary hardware designs and internal Broadcom information are out of scope.

## License

[MIT](LICENSE) © 2026 FloatScope contributors.
