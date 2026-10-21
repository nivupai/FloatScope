# FP16 multiplication and fused multiply-add

Milestone 6 extends FP Play's original binary16 arithmetic model. It uses public floating-point semantics and exact BigInt dyadics, not a proprietary datapath. Only round-to-nearest, ties-to-even is supported. This remains an educational model, not a full IEEE 754 conformance claim.

## Public APIs

Import from `src/lib/numerics/index.ts`:

```ts
const product = multiplyFP16(0x3e00, 0x4000) // 1.5 × 2 = 3 / 0x4200
const fused = fmaFP16(0x3c01, 0x3c01, 0xbc02) // 2^-20 / 0x0010
const separate = nonfusedMultiplyAddFP16(0x3c01, 0x3c01, 0xbc02) // +0
const comparison = compareMultiplyAddFP16(0x7bff, 0x4000, 0xfbff)
// fused: 65504, no flags; nonfused: Infinity, overflow/inexact
```

Every operand is a validated integer raw uint16 pattern. Invalid patterns throw `RangeError`. Existing `addFP16`, `subtractFP16`, and `calculateFP16(..., 'add' | 'subtract')` retain their signatures and behavior; all prior 275 tests remain unchanged.

`FP16MultiplyResult` returns `operation`, original `aBits`, `bBits`, `cBits` (`null` for multiply), packed `bits`, existing `decoded` metadata, `exact`, `exactProduct`, `flags`, `roundingMode`, `tininessDetection`, and a typed `trace`. Exact dyadics contain signed BigInt `coefficient` times `2^exponent`. They are `null` when the chosen special-value path bypasses finite arithmetic; finite overflow retains its finite exact dyadic. `exactProduct` is unrounded and unbounded even if it exceeds FP16 range.

**Use coefficient/exponent for exact work.** The compatibility `exact.value` Number is only a display projection: it is exact for two-operand sums and products, but a widely aligned FMA can require more than 53 bits and round this projection. The core never uses that Number for any arithmetic or decision. `formatExactDyadic` displays the BigInt rational's exact terminating decimal expansion (up to 48 fractional places here). BigInt result fields require explicit JSON serialization.

`NonfusedMultiplyAddResult` contains the complete `product` result, complete `addition` result, final `bits`/`decoded`, and the boolean union of their flags. Those flags describe two operations, rather than a fused exception. `compareMultiplyAddFP16` returns `fused`, `nonfused`, and `difference` (fused minus nonfused). Difference is `null` if either output is nonfinite; differences of two finite FP16 values are exact in binary64. Different signed zeros have zero numerical difference but retain different raw encodings; NaNs are unordered.

## Exact multiplication and FMA

Decode each finite operand as signed integer significand `M` times `2^q`, where `q = E - 10`, `E` is the effective unbiased exponent (−14 for zeros/subnormals), and `M` includes the implicit 1024 only for normals.

Multiplication computes sign XOR, exact `Ma * Mb` (at most 22 bits), and scale exponent `qa + qb`. Normalize and round the dyadic directly once to binary16. No Number multiplication, encoder conversion, or intermediate binary32 rounding is used.

FMA computes this same exact product without rounding it or applying FP16 exponent limits. Let `q = min(productExponent, qc)`. Align product and C with lossless left shifts to q, apply signs, add exactly, normalize the exact sum, and round **once** to FP16. Alignment can require about 80 integer bits; a Number intermediate could lose a low-order term. `1 × 2^-48`-scale products and cancellation are preserved in BigInts.

All four arithmetic operations share `roundDyadicFP16.ts`. It chooses the normal eleven-bit or subnormal `2^-24` result quantum, records all discarded bits, derives GRS, applies `G && (R || S || retainedOdd)`, handles carry, checks range, packs the result, and sets flags. Extracting this helper preserved all existing add/sub tests.

Nonfused multiplication/addition deliberately executes `multiplyFP16(a,b)` followed by `addFP16(product.bits,c)`. Product rounding, underflow, overflow, and NaN quieting are observable before addition. A tiny product can vanish before a later addition, or a large finite product can overflow before cancellation. FMA applies neither intermediate restriction.

This is **binary16-result FMA**, not FP32 accumulation. FP16 operands accumulated in FP32 use a different result precision/range; long dot products and hardware accumulation policies are outside this milestone.

## NaNs, infinities, zeros, and flags

- Select the first signaling NaN, otherwise first quiet NaN in original A/B/C order. Quiet it and preserve original sign plus low nine payload bits. This deterministic payload rule is implementation-specific.
- Any signaling operand raises invalid. `0 × Infinity` raises invalid even with a quiet NaN C; propagate a selected input NaN, otherwise return canonical quiet `0x7e00`.
- A genuine infinite product plus opposite-signed infinity C is invalid and returns `0x7e00`. Other infinity cases return the appropriate infinity without finite stages. A finite but very large product in FMA is **not** infinity until final rounding.
- Multiply sign is XOR, including zero. FMA exact cancellation is +0 under nearest-even; two effective negative zero terms retain −0. A negative tiny result can round to −0.
- Overflow is determined only after final rounding, returns signed infinity, and always raises inexact. Exact subnormals do not raise underflow. Nonzero discarded remainders raise inexact.
- Flags are per operation. Nonfused comparison unions multiply/add indicators. Input conversion flags, sticky processor state, traps, and division-by-zero are not modeled.

### Tininess after rounding: precision versus stored encoding

IEEE after-rounding tininess is defined at **eleven-bit precision with an unbounded exponent range**, separately from final subnormal encoding. Under nearest-even, its threshold immediately below the smallest normal is `2^-14 - 2^-26 = 4095 × 2^-26`; that exact midpoint rounds up to normal magnitude, so tininess uses a strict comparison below it. Underflow requires this tininess predicate **and** final inexactness. The trace exposes `tinyAfterPrecisionRounding`.

A stored normal `0x0400` can consequently raise underflow. For example, `0x03ff × 0x3bff + 0x0001` is exactly `1023.50048828125 × 2^-24`: it rounds to `0x0400`, but precision-only rounding remains below the normal threshold, so underflow and inexact are set. At `0x03fd × 0x3a00 + 0x0102 = 1023.75 × 2^-24`, the precision-only tie rounds up and underflow is clear. These are explicit regression cases. See the authoritative [SoftFloat FAQ on normal outputs with underflow](https://www.jhauser.us/arithmetic/SoftFloat-3/doc/SoftFloat-FAQ.html).

This detail was found during differential validation and corrected in the shared rounder. It does not change prior add/sub outcomes: their tiny results are exact multiples of `2^-24`, so add/sub still cannot raise underflow. Checking only the final encoded exponent for tininess would be wrong for multiplication and FMA.

## Computation-derived traces

`MultiplyStage` extends the existing stage structure with explicit discriminants:

| Multiplication stage | Information                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| `decode-multiply`    | Original raw operands and classifications                                         |
| `product-sign`       | Both sign bits and XOR result                                                     |
| `multiply`           | Eleven-bit significands, exact up-to-22-bit product, sign, operand/product scales |
| `product-exponent`   | Sum of scale exponents, distinct from biased encoding fields                      |
| `normalize`          | Leading bit, shifts, retained significand, result quantum                         |
| `grs`                | Guard/round/sticky, complete discarded-bit string and remainder                   |
| `round`              | Tie/parity/increment/carry, final working exponent, precision-only tininess       |
| `encode`             | Packed result, decoding, and per-operation flags                                  |

Finite FMA stages are `decode-fma → multiply → align-product → arithmetic → normalize → grs → round → encode`. Alignment records both original scales, shifts, aligned integers, and common scale. Signed arithmetic records both signed terms and exact sum. Special operations return only decode → `multiply-special` → encode, with reason, selected NaN operand, signaling presence, and invalid zero-product condition. They do not invent finite stages.

These are conceptual stages, **not clock cycles, RTL, pipeline latency, or a model of a specific accelerator**. React displays records from the actual computation. The FMA comparison offers a single navigation panel selecting fused, nonfused product, or nonfused addition traces; these paths can have different lengths and are not presented as synchronized hardware cycles.

## Interactive use and examples

In Arithmetic Explorer, select **A × B** or **FMA(A, B, C) / nonfused comparison**, choose decimal or raw hex modes, and submit. C appears for FMA. Draft edits do not change applied values; invalid C retains the complete previous operation. Decimal text is binary64-first, then independently quantized to FP16; raw hex retains NaN metadata.

Inspect all raw operand diagrams, exact product, exact mathematical sum, final decimal/binary/hex encodings, three comparison cards, numerical difference, per-path flags, and divergence explanations. Native stage buttons and bounded Left/Right/Home/End shortcuts remain available. Switching trace paths resets to the first actual stage. Existing light/dark variables, color-independent labels, scrolling bit rows, and narrow-screen reflow are reused.

Ten explicit-bit presets in `multiplyExamples.ts` cover exact multiplication, sign/exponent arithmetic, exact subnormals, underflow, overflow, invalid zero/infinity, midpoint rounding, fused cancellation, lost product bits, and avoided intermediate overflow. Each expected result is independently checked.

## Verification and reproducible counterexamples

The test-only oracle independently enumerates FP16 lattice coordinates and rounds by binary-searching midpoint thresholds in integer `2^-48` units. It shares no production normalization, GRS, encoding, or decoding. Tests cover every raw pattern multiplied by ±1 and fused with both zero signs, all combinations of a directed special-value set, 30,000 fixed-seed random pairs/triples, nonfused indicators, explicit tininess thresholds, and trace/decimal reconstruction. CPU-heavy loops have per-test 30-second budgets; the global timeout and all prior tests are unchanged.

The optional SoftFloat harness retains the earlier add/sub corpus and adds multiplication and FMA. With upstream revision `a0c6494cdc11865811dec815d5c0049fba9d82a8`, nearest-even, tininess after rounding, and `8086-SSE` specialization, **536,888 operations matched**:

| Operation | Comparisons |
| --------- | ----------: |
| Add       |     115,936 |
| Subtract  |     115,936 |
| Multiply  |     181,476 |
| FMA       |     123,540 |

All non-NaN bits and all four flags match exactly. For 28,618 NaN outputs, classification must be quiet and every flag must match; payload/sign differ by specialization and are tested separately against FP Play's policy. No flag mismatches are ignored. There is no vendored upstream source/binary or new application dependency. Compile the updated original driver using the [existing SoftFloat setup](README.md#optional-berkeley-softfloat-differential-validation), then run:

```sh
node scripts/validate-softfloat.mjs /tmp/fp-play-softfloat-driver
node scripts/search-fma.mjs /tmp/fp-play-softfloat-driver
# Without a compiled reference, search still requires the independent lattice oracle:
node scripts/search-fma.mjs
```

The driver protocol is now `hexA hexB operation hexC` per line, operations 0:add, 1:subtract, 2:multiply, 3:FMA. Recompile it; an older driver is incompatible. The search seed is `0x6f70656e`, includes two directed examples and searches randomly for five more, finishing in 34 attempts. Every discovered triple is checked against the independent lattice. With a driver path, its fused, intermediate multiplication, and final addition bits and flags are also checked against SoftFloat (21 extra comparisons). Full exact decimal inputs/results and explanations are recorded in [the reproducible experiment output](../../../docs/experiments/fma-counterexamples.json).

Two independently verified examples:

| A, B, C                      | Exact A×B+C | Rounded product | Fused    | Nonfused |
| ---------------------------- | ----------- | --------------- | -------- | -------- |
| `0x3c01`, `0x3c01`, `0xbc02` | `2^-20`     | `0x3c02`        | `0x0010` | `0x0000` |
| `0x7bff`, `0x4000`, `0xfbff` | `65504`     | `0x7c00`        | `0x7bff` | `0x7c00` |

MACs are central to dot products and neural-network computation. Avoiding an intermediate rounding can preserve a residual after cancellation and avoid a transient overflow. It does not guarantee every fused answer is closer to a desired decimal calculation or model a complete accelerator workload.

## Limits and browser status

No alternate modes, FP32 accumulation simulator, division, reductions, transformer attention, RTL, throughput model, or full standards conformance validation is included. Differential testing covers a deterministic corpus, not all `2^32` pairs or `2^48` triples; TestFloat was not run. Decimal parsing and Number projections have the limitations above.

Browser inventory had no connected browsers for Milestone 6. DOM integration checks real calculations and keyboard controls; real rendering, theme/focus appearance, native dropdowns, touch scrolling, and assistive-technology announcements remain unverified. No screenshot or successful visual review is claimed.
