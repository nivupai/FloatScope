import type { ArithmeticStage } from '../numerics/fp16Arithmetic'
import type { MultiplyStage } from '../numerics/fp16Multiply'
import { formatFP16Bits, fp16BitsToHex } from '../numerics/fp16'
import { describeStage, STAGE_TITLES } from './presentation'

export const MULTIPLY_STAGE_TITLES: Record<MultiplyStage['kind'], string> = {
  ...STAGE_TITLES,
  'decode-multiply': 'Multiplication operand decoding',
  'decode-fma': 'Three-operand decoding',
  'product-sign': 'Product sign XOR',
  multiply: 'Exact significand multiplication',
  'product-exponent': 'Product exponent calculation',
  'align-product': 'Exact product and addend alignment',
  'multiply-special': 'Multiply/FMA special-value short circuit',
}

export function describeMultiplyStage(
  stage: ArithmeticStage | MultiplyStage,
): ReturnType<typeof describeStage> {
  switch (stage.kind) {
    case 'decode-multiply':
    case 'decode-fma':
      return {
        explanation:
          'Decode original FP16 patterns before arithmetic. NaN sign, signaling bit, and payload remain in raw storage. FMA does not round or restrict the finite product to binary16 before adding C.',
        rows: (stage.kind === 'decode-fma'
          ? [stage.a, stage.b, stage.c]
          : [stage.a, stage.b]
        ).flatMap((x, i): [string, string][] => [
          [
            `${'ABC'[i]} raw / class`,
            `${fp16BitsToHex(x.bits)} / ${x.classification}`,
          ],
          [`${'ABC'[i]} binary`, formatFP16Bits(x.bits)],
        ]),
      }
    case 'product-sign':
      return {
        explanation:
          'The product sign is A sign XOR B sign, including exact zero and infinity products.',
        rows: [
          ['A sign', String(stage.signA)],
          ['B sign', String(stage.signB)],
          ['Product sign', String(stage.sign)],
        ],
      }
    case 'multiply':
      return {
        explanation:
          'Multiply the integer significands exactly. Two eleven-bit significands need up to 22 product bits. The displayed integer multiplies the power-of-two scale; no product bits are discarded.',
        rows: [
          [
            'A integer significand binary',
            stage.significandA.toString(2).padStart(11, '0'),
          ],
          [
            'B integer significand binary',
            stage.significandB.toString(2).padStart(11, '0'),
          ],
          ['Exact product binary', stage.product.toString(2).padStart(22, '0')],
          ['Exact product integer', String(stage.product)],
          ['Product sign', String(stage.sign)],
          [
            'Product scale',
            `2^(${stage.exponentA} + ${stage.exponentB}) = 2^${stage.exponent}`,
          ],
        ],
      }
    case 'product-exponent':
      return {
        explanation:
          'Each integer significand has scale 2^(effective exponent − 10). Multiply scales by adding their exponents. These are scale exponents, not biased FP16 fields.',
        rows: [
          ['A scale exponent', String(stage.exponentA)],
          ['B scale exponent', String(stage.exponentB)],
          ['Product scale exponent', String(stage.exponent)],
        ],
      }
    case 'align-product':
      return {
        explanation:
          'Choose the smaller power-of-two scale and shift integers left to match it. Retain all exact product and addend bits, including product bits below FP16 precision and above its finite range. Alignment does not round.',
        rows: [
          ['Product original scale', `2^${stage.productExponent}`],
          ['Addend original scale', `2^${stage.addendExponent}`],
          ['Product left shift', String(stage.shiftProduct)],
          ['Addend left shift', String(stage.shiftAddend)],
          ['Aligned product binary', stage.alignedProduct.toString(2)],
          ['Aligned addend binary', stage.alignedAddend.toString(2)],
          ['Aligned integer scale', `2^${stage.exponent}`],
        ],
      }
    case 'multiply-special':
      return {
        explanation:
          stage.reason === 'nan'
            ? 'Select the first signaling NaN, otherwise the first quiet NaN, in A/B/C order. Quiet it and retain original sign/payload. Signaling operands and zero × infinity raise invalid, even with a quiet NaN addend.'
            : stage.reason === 'zero-times-infinity'
              ? 'Zero × infinity is invalid. Return canonical quiet NaN 0x7e00; finite product stages are bypassed.'
              : stage.reason === 'opposing-infinities'
                ? 'An infinite product plus the opposite infinity is invalid. Return canonical quiet NaN 0x7e00.'
                : 'An infinite operand produces this special result without a finite pipeline. FMA finite products have no intermediate FP16 range restriction.',
        rows: [
          ['Short-circuit reason', stage.reason],
          [
            'Selected NaN operand',
            stage.selectedNaNOperand ?? 'Not applicable',
          ],
          ['Signaling NaN present', String(stage.signaling)],
          ['Invalid zero × infinity', String(stage.invalidProduct)],
        ],
      }
    default:
      return describeStage(stage)
  }
}
