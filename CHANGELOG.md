# Changelog

## 0.1.0 — prepared, not yet published

First public-release preparation for FP Play. No Git tag, GitHub release, or deployment has been published by this work.

- Interactive IEEE 754 binary16 Bit Explorer, decimal quantization, exact decoding, signed zeros, subnormals, infinities, NaNs, and neighbors.
- Precision Microscope with viewport-generated FP16 points, zoom/pan, rounding cells, quantization error, and ULP/binade exploration.
- Exact BigInt addition, subtraction, multiplication, single-rounding FMA, nonfused comparison, typed computation traces, and per-operation indicators.
- Ten multiplication/FMA presets, deterministic counterexamples, exhaustive numerical checks, and independent lattice/SoftFloat validation.
- Four-experience landing page, direct FMA hash entry, responsive typography, larger controls, stronger borders, visible stages, keyboard-scrollable data, metadata/favicon, and a no-JavaScript explanation.
- Manual-only, main-only GitHub Pages workflow, `/fp-play/` assets, immutable action pins, complete validation before deployment, and narrowly scoped permissions.
- Contributor, usage, deployment, and verification guides. Numerical coverage is preserved; the suite contains 344 tests.

Known limits: binary16 nearest-even only; no full IEEE conformance claim, other formats, division, FP32 accumulation simulator, transformer attention, or RTL. Real-browser, mobile/touch, and screen-reader review remain unperformed because no browser was connected. See [the verification record](docs/RELEASE_VERIFICATION.md) and [model contracts](src/lib/arithmetic/MULTIPLY_FMA.md).
