# v0.1.0 verification record

This record distinguishes source/DOM/static-build evidence from real-browser verification. It is not a full IEEE 754 or WCAG conformance certification.

## Automated evidence

- Latest `main` included Milestone 6 before `feature/public-release` was created. All 338 earlier tests and all numerical modules are unchanged.
- 344 Vitest tests pass on Node 22.9.0 and Node 24: the earlier 338 plus six release entry-point, FMA hash-navigation, and keyboard-access cases. The FMA link loads an existing independently verified example rather than a new arithmetic path.
- Lint, Prettier, TypeScript, and production build pass. The generated index references JavaScript, CSS, and favicon beneath `/fp-play/`; `npm run check:release` verifies those files exist and package/lockfile versions agree.
- `npm run check:contrast` checks 74 actual light/dark token pairs, including pressed bits, colored panels, labels, control borders, and focus colors. Minimum tested text contrast: 5.46:1; minimum tested control/focus contrast: 3.39:1. System-dark tokens match the manual dark palette. Opacity, compositing, rendered geometry, and every possible state require browser review.
- A loopback-only production preview served the index and all four hash URLs as HTML; JavaScript, CSS, and favicon returned HTTP 200 with expected MIME types. This checks static serving, not client execution or visual behavior.
- CI and manual Pages workflows pass actionlint 1.7.12 validation. The manual workflow is main-only, has no automatic triggers, and scopes write permissions to the deployment job. Workflow execution on GitHub and actual deployment remain unperformed.
- Milestone 6 previously checked 536,888 operations against pinned Berkeley SoftFloat with zero mismatches under the documented NaN comparison policy, plus 21 checks for the seven counterexamples. Numerical code and reference corpora are untouched in this milestone; those historical counts are not new release-only checks.

## Browser availability and screenshots

Browser inventory was empty during Milestone 7. No real browser was connected. No screenshots were captured, and no successful rendered-browser or screen-reader review is claimed. Native focus rendering, touch capture/scrolling, responsive geometry, OS font rendering, contrast compositing, and assistive-technology announcements remain unverified.

## Manual review before publication

Use a real desktop browser and at least one mobile browser, recording browser/OS versions, viewport, input method, and results. Include widths around 360, 390, 768, and 1440 pixels, landscape orientation, and 200% zoom.

1. **Landing/navigation:** four experience cards reach named sections; source and technical documentation links work. Reload `/fp-play/#fma` and confirm three operands, fused `0x0010`, nonfused `0x0000`. Reopen the FMA link after editing another operation. Browser back/forward must retain ordinary static hash navigation.
2. **Keyboard/focus:** use the skip link, native controls, Tab/Shift+Tab, Space/Enter, and theme selector. Confirm focus remains visible and is not clipped. Verify all bit switches' positions and pressed states are announced. There must be no keyboard trap.
3. **Bit Explorer:** toggle sign/fraction/exponent, enter `0.1`, `-0`, `Infinity`, and `NaN`, and submit invalid text. Ensure original/quantized values stay distinct and invalid input preserves the applied pattern. Check subnormal/normal and signed-zero neighbors.
4. **Microscope:** exercise all zoom/pan/fit/overview buttons and chart arrow/+/- shortcuts. Inspect exact point selection, target slider, sampling notices, rounding cells, tooltips, and the expanded exact table. Verify native plot/table scrolling, touch target movement and pan mode, pointer capture, and vertical page scrolling. Text controls must remain usable without dragging.
5. **Arithmetic:** inspect finite and special traces, previous/next bounds, Home/End/Left/Right, and long binary rows. Focus a long row and scroll it; its keys must not change the stage. Check all operations and invalid A/B/C fields. Read complete values without page-wide overflow.
6. **Fusion:** compare lost-residual, cancellation, and intermediate-overflow presets. Verify exact sum, rounded product, final encodings, flags, and numerical difference/undefined explanations. Switch trace paths and verify their actual stage counts. Keep fused and nonfused labels distinct on mobile.
7. **Themes/motion:** test manual light/dark and OS-driven system themes, high zoom, reduced motion, and visible focus on colored panels. Check contrast in disabled, selected, error, and pressed states in the rendered page.
8. **Screen reader:** review landmarks/headings, form labels/descriptions, errors, exact numerical strings, selection announcements, and plot alternatives with VoiceOver or NVDA. Static token checks and jsdom cannot establish this behavior.
9. **Production:** verify asset HTTP responses and MIME types at the deployed subpath, reload all hash entry points, and check browser console/network failures. An unrelated path such as `/fp-play/arithmetic` is not supported navigation.

Record any failures and limitations in the release notes; do not mark unperformed items as passed. Screenshots should be added only after they are captured from and reviewed against a real browser.
