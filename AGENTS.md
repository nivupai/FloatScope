# FloatScope project conventions

## Scope and architecture

- Build incrementally. Milestone 1 is infrastructure and a clearly labeled placeholder only; do not implement arithmetic until a later milestone requests it.
- Use React, strict TypeScript, Vite, Tailwind CSS, Vitest, ESLint, and Prettier. Prefer native platform APIs and keep dependencies minimal.
- Put reusable UI in `src/components/`, pure numerical code in `src/lib/numerics/`, and tests in `src/tests/`. Keep numerical models independent of React, the DOM, and display formatting.
- Favor small components, explicit types, deterministic pure functions, and documented module boundaries. Do not introduce routing or state libraries without a concrete need.

## Numerical correctness

- Test IEEE 754 behavior carefully. Never silently approximate edge cases. Disclose any approximation, unsupported case, or deviation in the API documentation and visible UI where relevant.
- For future binary16 implementations, cover positive and negative zero, subnormals, normal boundaries, infinities, NaNs, underflow, overflow, cancellation, and round-to-nearest, ties-to-even (including exact halfway cases and carry propagation).
- Use independently derived expected bit patterns and public authoritative references. Exhaustively verify all 65,536 binary16 bit patterns where practical; do not validate an encoder only against its paired decoder.
- JavaScript `number` uses binary64. Do not assume it reproduces binary16 rounding or arithmetic. Preserve signed zero and explicitly specify NaN payload/canonicalization policy.
- Keep exact representation, rounding policy, and educational display formatting separate. No arithmetic functionality is implemented in Milestone 1.

## Accessibility and interface

- Use semantic landmarks, ordered headings, accessible labels, keyboard navigation, visible focus states, and responsive layouts.
- Do not communicate a numerical field or state through color alone. Pair visualizations with text explanations and accessible alternatives.
- Clearly distinguish planned features from working functionality. Avoid controls that imply an unimplemented calculation works.

## Validation and workflow

- Use the Node version in `.nvmrc` and `npm ci` with the committed lockfile. Check package engine and peer requirements before upgrades.
- Run `npm run check` before committing: ESLint, Prettier, Vitest, TypeScript, and a production build must pass.
- Add meaningful regression tests for numerical behavior and interactive UI when introduced. Use independent reference cases rather than mirroring implementation logic.
- Keep README setup, scope, and roadmap current. Document limitations honestly.
- Use descriptive commits. Do not push, publish, deploy, or create a remote repository unless explicitly requested.
- Use only public standards and original or appropriately licensed open-source material. Never include proprietary hardware designs or internal Broadcom information.
