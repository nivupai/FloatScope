# Numerical utilities

Reserved for pure, framework-independent numerical models. Milestone 1 deliberately contains no floating-point encoding, decoding, or arithmetic implementation.

Future modules must expose explicit types, state their rounding and special-value behavior, and have tests in `src/tests/` before being connected to the UI. Keep presentation and formatting separate from numerical correctness. See the repository's `AGENTS.md` for the required IEEE 754 edge-case policy.
