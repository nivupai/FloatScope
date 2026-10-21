# FP Play project conventions

## Scope and architecture

- Use **FP Play** as the public project name and `fp-play` as the npm package name and project-specific tool prefix. Preserve the original MIT copyright notice in `LICENSE`.
- Build incrementally. Milestone 6 adds exact binary16 multiplication, true FMA, and nonfused comparison. Preserve all existing representation, microscope, and add/subtract behavior. Division, transformer attention, and hardware simulation remain future work.
- Use React, strict TypeScript, Vite, Tailwind CSS, Vitest, ESLint, and Prettier. Prefer native platform APIs and keep dependencies minimal.
- Put reusable UI in `src/components/`, pure numerical code in `src/lib/numerics/`, and tests in `src/tests/`. Keep numerical models independent of React, the DOM, and display formatting.
- Favor small components, explicit types, deterministic pure functions, and documented module boundaries. Do not introduce routing or state libraries without a concrete need.

## Numerical correctness

- Test IEEE 754 behavior carefully. Never silently approximate edge cases. Disclose any approximation, unsupported case, or deviation in the API documentation and visible UI where relevant.
- For binary16 code, cover positive and negative zero, subnormals, normal boundaries, infinities, NaNs, underflow, overflow, and round-to-nearest, ties-to-even (including exact halfway cases and carry propagation). Test cancellation, GRS, carry, exact mathematical results, and per-operation exception indicators for arithmetic.
- Use independently derived expected bit patterns and public authoritative references. Exhaustively verify all 65,536 binary16 bit patterns where practical; do not validate an encoder only against its paired decoder.
- JavaScript `number` uses binary64. Do not assume it reproduces binary16 rounding or arithmetic. Preserve signed zero and explicitly specify NaN payload/canonicalization policy.
- Keep exact representation, rounding policy, and educational display formatting separate. The arithmetic model in `src/lib/numerics/fp16Arithmetic.ts` uses exact signed BigInt dyadics, lossless alignment, and one nearest-even rounding. Multiplication/FMA live in `fp16Multiply.ts`; all operations share `roundDyadicFP16.ts`. FMA must retain the exact product, without FP16 intermediate rounding, overflow, underflow, or flags. Nonfused comparison executes two real FP16 operations and unions their indicators. Its discriminated trace must come from the same computation as the result; never animate an independent approximate algorithm.
- All raw-pattern APIs validate uint16 inputs rather than silently masking. Preserve raw NaN metadata in `decodeFP16`; encoding a Number NaN canonicalizes to positive quiet NaN `0x7e00`.
- Adjacent-value APIs accept and return raw patterns. ULP means sign-independent binade spacing; see `src/lib/numerics/README.md` for zero, boundary, infinity, and NaN semantics.
- Arithmetic NaN policy: first signaling NaN, otherwise first quiet NaN in A/B order (A/B/C for FMA); quiet while retaining original sign and low nine payload bits. Subtraction must not flip a propagated NaN's raw sign. Opposing effective infinities and zero × infinity return `0x7e00` with invalid unless an input NaN is propagated. Zero × infinity raises invalid even with a quiet NaN C. Payload selection is implementation-specific, not a universal IEEE requirement.
- Tininess is detected after rounding to eleven-bit precision with unbounded exponent range; underflow requires both this tininess and final inexactness. Do not infer tininess only from the stored exponent: a result encoded `0x0400` can still raise underflow. See `src/lib/arithmetic/MULTIPLY_FMA.md` and keep explicit boundary regressions. Binary16 add/sub tiny results are exact on the `2**-24` grid, so do not invent underflow flags for exact subnormals. Overflow always sets inexact. Conversion flags and global sticky status are not modeled.
- Maintain independent lattice and directed references, exhaustive raw identities/cancellation and attainable midpoint checks, randomized differential tests, and trace reconstruction. Preserve all 275 Milestone 5 tests unchanged. Use the independent `2^-48` integer-lattice oracle for products/FMA, including precision-only tininess thresholds. Keep randomized tests and counterexample searches deterministic. CPU-heavy tests use per-test timeouts, not a global increase. Optional SoftFloat tools live in `scripts/`; do not vendor its source/binaries. State payload-policy differences and corpus limits. Do not claim full IEEE 754 conformance.

## Accessibility and interface

- Use semantic landmarks, ordered headings, accessible labels, keyboard navigation, visible focus states, and responsive layouts.
- Do not communicate a numerical field or state through color alone. Pair visualizations with text explanations and accessible alternatives.
- Clearly distinguish planned features from working functionality. Avoid controls that imply an unimplemented calculation works.
- Keep the raw uint16 pattern as the Explorer's source of truth. React components must consume the numerical library rather than duplicate decoding, rounding, adjacency, or ULP logic.
- Keep decimal text and the last converted binary64 input separate from the selected raw pattern. Raw edits/presets/neighbor selections clear conversion comparisons; invalid submissions retain the current pattern. Document Number parsing and special-value conventions.
- Display finite FP16 values with exact terminating decimal expansions, preserve visible `-0`, and retain NaN metadata during raw edits. Presentation helpers belong in `src/lib/explorer/`, separate from the numerical engine.
- Use native buttons with named bit positions and `aria-pressed`, labeled input validation, a single polite selection announcement, and color-independent field labels. Verify interactions with the actual engine; never substitute mock IEEE 754 decoding.
- Maintain light, dark, and system themes with readable contrast, responsive field layouts, focus indicators, and reduced-motion support. Theme choice is session-local.
- Keep microscope math in `src/lib/numerics/microscope.ts`, presentation/examples in `src/lib/microscope/`, and SVG components in `src/components/microscope/`. Use the existing conversion/adjacency/ULP engine as the source of truth.
- Generate viewport points by binary search over finite numerical ranks. Never render the complete FP16 lattice; cap rendered points, report omitted-point sampling, and keep sampled positions on actual representable values. A single geometric zero must not erase signed-zero input metadata.
- Rounding cells must handle exponent-boundary asymmetry, even/odd endpoint ownership, signed-zero half-cells, and the virtual ±65536 overflow neighbor. Do not label zero's sign seam as a halfway tie.
- Distinguish FP16 points, target, quantized output, and cell boundaries by shape/text as well as color. Supply keyboard/text alternatives to pointer interactions and exact tabular data. Disclose plot limits, rounded axis labels, binary64 decimal parsing, and error-computation precision.
- Arithmetic presentation/examples/docs belong in `src/lib/arithmetic/`; React controls and trace views belong in `src/components/arithmetic/`. Consume typed engine stages without duplicating arithmetic or GRS logic in React.
- Keep draft operand text separate from applied raw operands/results. Apply both operands and the operation atomically; invalid input retains the previous result. Decimal text is binary64-first then quantized to FP16. Preserve signaling NaNs through raw hex input; distinguish operand conversion from arithmetic rounding.
- The compatibility `exact.value` Number projection can round for wide FMA sums; coefficient/exponent is authoritative and must drive exact displays. Show exact dyadic results with terminating decimal formatting, rounded FP16 results, per-operation flags, and special-value short circuits. Stages are conceptual, not physical clock cycles or a particular hardware design. Keep fused, rounded product, and nonfused output encodings/flags distinct. FMA means FP16 output with one final rounding, not FP32 accumulation. Provide native stage buttons and bounded Left/Right/Home/End controls, with horizontally scrollable long bit strings on mobile.

## Validation and workflow

- Use the Node version in `.nvmrc` and `npm ci` with the committed lockfile. Check package engine and peer requirements before upgrades.
- Run `npm run check` before committing: ESLint, Prettier, Vitest, TypeScript, and a production build must pass.
- Add meaningful regression tests for numerical behavior and interactive UI when introduced. Use independent reference cases rather than mirroring implementation logic.
- Keep README setup, scope, and roadmap current. Document limitations honestly.
- Use descriptive commits. Do not push, publish, deploy, or create a remote repository unless explicitly requested.
- Use only public standards and original or appropriately licensed open-source material. Never include proprietary hardware designs or internal Broadcom information.
