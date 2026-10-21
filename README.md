# FP Play

**Make precision visible.** FP Play is an open-source interactive laboratory for IEEE 754 binary16 arithmetic and numerical precision in AI hardware. Flip bits, zoom into representable values, follow an exact calculation, and compare fused with separately rounded operations.

Version **0.1.0** is prepared for its first public release. This branch does not publish a release or deploy a site.

## Four experiences

| Experience               | What you can explore                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bit Explorer**         | Sixteen independent bit switches, exact decoded values, decimal quantization, signed zeros, subnormals, infinities, NaN metadata, and numerical neighbors. |
| **Precision Microscope** | Zoom/pan through actual FP16 points, inspect rounding cells and midpoint ownership, and compare ULP spacing with magnitude.                                |
| **Arithmetic Pipeline**  | Trace addition, subtraction, and multiplication through exact intermediates, normalization, GRS bits, nearest-even rounding, and exception indicators.     |
| **FMA Comparison**       | See the exact product and sum beside fused, rounded-product, and nonfused outputs. Discover lost residuals and avoided intermediate overflow.              |

The landing page links directly to each workspace. `#fma` opens a verified example, including on a page reload. Keyboard controls and text alternatives accompany charts and bit diagrams. Light, dark, and system themes share labeled field colors; mathematical meaning never depends on color alone.

FP16 has one sign bit, five exponent bits, ten stored fraction bits, and exponent bias 15. Its eleven-bit normal precision helps explain why alignment, cancellation, accumulation precision, and rounding matter to numerical computing and accelerator workloads. These are educational models, not a particular chip's implementation or timing.

## Run locally

Use Node **22.9.0** with npm **10.8.3**, or Node **24**, matching the CI matrix. Keep the committed dependency lockfile; consult `package.json` for supported engines.

```sh
git clone https://github.com/nivupai/fp-play.git
cd fp-play
npm ci
npm run dev
```

Open **http://localhost:5173/fp-play/** (or the URL Vite prints if the port is occupied). The repository base path applies to development and production.

```sh
npm run check          # Lint, formatting, contrast tokens, full tests, typecheck, build
npm run check:release  # Verify generated /fp-play/ assets; run after the build
npm run preview       # Preview the build at http://localhost:4173/fp-play/
```

Other commands: `npm test`, `npm run test:watch`, `npm run lint`, `npm run typecheck`, `npm run format`, `npm run format:check`, and `npm run check:contrast`. Preview is for local verification, not a production server.

## Try it

- Enter `0.1` in Bit Explorer to compare its parsed binary64 input with exact FP16 `0.0999755859375`. Use Tab, Space, and Enter to flip individual bits.
- Analyze `1.0001` in the microscope: it rounds to 1. Use pan/zoom buttons or focus the chart for arrow and +/− controls. A point selector and exact table complement pointer interaction.
- Trace `1 + 2^-11` with **Tie to even**. Inspect alignment, guard/round/sticky, and the retained significand's parity.
- Open **FMA Comparison**: `(1 + 2^-10)^2 − (1 + 2^-9)` gives `2^-20` fused and zero after intermediate FP16 product rounding. Select each computation path to inspect the difference.

Decimal/scientific input is binary64-first. Use `-0`, `Infinity`, `-Infinity`, and `NaN`; arithmetic raw mode accepts four-digit hex such as `0xfc11`. Invalid input preserves the last applied calculation. See the [usage guide](docs/USER_GUIDE.md) for full controls, conventions, examples, and visualization limits.

## Architecture and technical documentation

React and strict TypeScript provide presentation; pure numerical functions provide every decoded value, neighbor, rounding cell, result, and trace. Vite, Tailwind CSS, Vitest, ESLint, and Prettier provide the tooling. There is no plotting, routing, or numerical runtime dependency.

```text
src/lib/numerics/        Conversion, introspection, microscope, exact arithmetic, shared rounding
src/lib/explorer/        Input/display formatting and explicit bit presets
src/lib/microscope/      Precision presentation and examples
src/lib/arithmetic/      Typed trace presentation, examples, and model documentation
src/components/          Landing, bit explorer, microscope, arithmetic, and shell
src/tests/               Numerical, independent-reference, and real-engine DOM tests
scripts/                 Build/contrast checks and optional independent verification tools
.github/workflows/       Read-only CI and a separate manual Pages deployment
```

- [Binary16 representation and conversion API](src/lib/numerics/README.md)
- [Microscope mathematics, sampling, and error definitions](src/lib/microscope/README.md)
- [Addition/subtraction model and trace contract](src/lib/arithmetic/README.md)
- [Multiplication, FMA, exceptions, and independent verification](src/lib/arithmetic/MULTIPLY_FMA.md)
- [Reproducible FMA counterexamples](docs/experiments/fma-counterexamples.json)
- [Contributor guide](CONTRIBUTING.md) and [project conventions](AGENTS.md)

## Numerical verification

All **338 Milestone 6 tests are preserved unchanged**. Six release integration tests bring the suite to **344**. Coverage includes all 65,536 raw binary16 encodings, representable midpoint boundaries, signed zeros, subnormals, infinity/NaN behavior, exhaustive identities/cancellation, deterministic differential cases, exact trace reconstruction, and actual-engine UI/keyboard interaction. CI runs the complete suite on Node 22.9.0 and 24; no numerical coverage or timeout budgets were reduced.

The Milestone 6 Berkeley SoftFloat reference run compared **536,888 operations with zero mismatches**: 115,936 additions, 115,936 subtractions, 181,476 multiplications, and 123,540 FMAs. Non-NaN bits and all four flags match; 28,618 NaN outputs match quiet classification and flags, with implementation-specific payload/sign selection tested separately. Seven counterexamples have independent lattice checks and another 21 SoftFloat checks. The [verification instructions](src/lib/arithmetic/MULTIPLY_FMA.md#verification-and-reproducible-counterexamples) pin the upstream revision and describe corpus limits. SoftFloat is optional development tooling, not a bundled dependency.

## Accessibility and visual-review status

The release adds a responsive landing page, larger controls, stronger control borders, visible trace stages, keyboard-focusable long-value/plot regions, and direct FMA entry. Static checks cover **74 theme-token pairs**: text contrast is at least **5.46:1**, and the tested control/focus pairs are at least **3.39:1**. DOM tests cover semantic labels, keyboard behavior, links, input states, and real numerical outputs.

**No connected browser was available for Milestone 7.** Actual rendering, mobile/touch behavior, theme/focus appearance, and screen-reader announcements remain unverified. No screenshot or full accessibility-conformance claim is made. The [release verification record](docs/RELEASE_VERIFICATION.md) distinguishes automated evidence from the remaining manual review.

## GitHub Pages readiness

The production base is **`/fp-play/`**. Hash links support static-host navigation without server rewrites. A production build checks JavaScript, CSS, and favicon paths before deployment.

[Deploy GitHub Pages (manual)](.github/workflows/pages.yml) has **only `workflow_dispatch`**, runs only from `main`, and deploys only after the full checks and build pass. Build has read-only content/Pages permissions; only the separate deploy job has `pages: write` and `id-token: write`. Actions are pinned to official release commits. The workflow does not enable Pages or change repository settings automatically.

A maintainer must explicitly enable **Settings → Pages → Source: GitHub Actions**, then run the workflow on `main` when publication is authorized. Nothing deploys on pushes, pull requests, tags, or releases. See [manual deployment and release instructions](docs/RELEASING.md). No live deployment or GitHub release is claimed here.

## Limits

Only binary16 conversion and add/subtract/multiply/FMA with nearest-even rounding are implemented. FMA produces an FP16 result; it is not FP32 accumulation. IEEE-style indicators are per operation; input conversion flags, traps, global sticky state, alternate modes, other formats, division, reductions, transformer attention, and RTL are outside scope. This project **does not claim full IEEE 754 conformance**.

NaN payload selection is a documented FP Play policy. Tininess after rounding uses eleven-bit precision with unbounded exponents, so a stored normal can still raise underflow. Exact dyadic coefficient/exponent fields are authoritative; FMA's compatibility Number projection can round. Decimal parsing, error divisions, screen coordinates, axis labels, viewport sampling, and logarithmic plots have their documented limits. TestFloat and exhaustive testing of every operand pair/triple have not been performed.

## Roadmap and contributing

Milestones 1–6 provide the foundation, numerical engine, representation explorer, precision microscope, arithmetic traces, multiplication, and FMA comparison. **Milestone 7 prepares v0.1.0 for public release**. Future work may compare BF16/FP32, explore attention precision, or add original open RTL validation; these are planned capabilities, not release promises.

Contributions improving clarity, accessibility, independent verification, documentation, or carefully scoped experiments are welcome. Follow [CONTRIBUTING.md](CONTRIBUTING.md), preserve numerical tests, and disclose unsupported behavior. [CHANGELOG.md](CHANGELOG.md) records the prepared release.

## License

[MIT](LICENSE). The original copyright attribution is preserved. All code uses public standards and original or appropriately licensed open-source material; proprietary hardware designs and internal Broadcom information are excluded.
