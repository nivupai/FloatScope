import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ArithmeticExplorer } from '../components/arithmetic/ArithmeticExplorer'
import { MULTIPLY_EXAMPLES } from '../lib/arithmetic/multiplyExamples'
import { fp16BitsToHex } from '../lib/numerics'

function setup() {
  render(<ArithmeticExplorer />)
  const user = userEvent.setup()
  return {
    user,
    async enter(a: string, b: string, c?: string, raw = false) {
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Operation' }),
        c === undefined ? 'multiply' : 'fma',
      )
      for (const [i, text] of (c === undefined
        ? [a, b]
        : [a, b, c]
      ).entries()) {
        const name = 'ABC'[i]
        await user.selectOptions(
          screen.getByRole('combobox', { name: `Operand ${name} format` }),
          raw ? 'hex' : 'decimal',
        )
        const input = screen.getByRole('textbox', { name: `Operand ${name}` })
        await user.clear(input)
        if (text) await user.type(input, text)
      }
      await user.click(screen.getByRole('button', { name: 'Trace operation' }))
    },
  }
}

describe('multiplication and FMA real-engine integration', () => {
  it.each(MULTIPLY_EXAMPLES)(
    'loads independently verified $label',
    async (example) => {
      const { user } = setup()
      const button = screen.getByRole('button', {
        name: `${example.label} → ${fp16BitsToHex(example.expected)}`,
      })
      await user.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByLabelText('Arithmetic result hex')).toHaveTextContent(
        fp16BitsToHex(example.expected),
      )
      expect(
        screen.getByLabelText('Multiplication experiment explanation'),
      ).toHaveTextContent(example.explanation)
      expect(screen.getByLabelText('Operand A encoding')).toHaveTextContent(
        fp16BitsToHex(example.a),
      )
      expect(screen.getByLabelText('Operand B encoding')).toHaveTextContent(
        fp16BitsToHex(example.b),
      )
      if (example.nonfused !== undefined) {
        expect(screen.getByLabelText('Nonfused output hex')).toHaveTextContent(
          fp16BitsToHex(example.nonfused),
        )
        expect(screen.getByRole('textbox', { name: 'Operand C' })).toHaveValue(
          fp16BitsToHex(example.c!),
        )
      }
    },
  )

  it('multiplies quantized decimal inputs and shows exact product bits, XOR sign, and exponents', async () => {
    const { enter, user } = setup()
    await enter('-1.5', '2')
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '-3',
    )
    expect(screen.getByLabelText('Arithmetic exact result').textContent).toBe(
      '-3',
    )
    await user.click(
      screen.getByRole('button', { name: '2. Product sign XOR' }),
    )
    expect(screen.getByLabelText('Product sign')).toHaveTextContent('1')
    await user.click(
      screen.getByRole('button', {
        name: '3. Exact significand multiplication',
      }),
    )
    expect(screen.getByLabelText('Exact product binary').textContent).toBe(
      '0110000000000000000000',
    )
    await user.click(
      screen.getByRole('button', { name: '4. Product exponent calculation' }),
    )
    expect(screen.getByLabelText('Product scale exponent')).toHaveTextContent(
      '-19',
    )
  })

  it('shows one-rounding cancellation beside a rounded product and zero nonfused result', async () => {
    const { enter, user } = setup()
    await enter('0x3c01', '0x3c01', '0xbc02', true)
    expect(screen.getByLabelText('Operand C quantized').textContent).toBe(
      '-1.001953125',
    )
    expect(
      screen.getByLabelText('Exact multiplication product').textContent,
    ).toBe('1.00195407867431640625')
    expect(screen.getByLabelText('Arithmetic exact result').textContent).toBe(
      '0.00000095367431640625',
    )
    expect(screen.getByLabelText('Fused output').textContent).toBe(
      '0.00000095367431640625',
    )
    expect(
      screen.getByLabelText('Rounded intermediate product').textContent,
    ).toBe('1.001953125')
    expect(screen.getByLabelText('Nonfused output').textContent).toBe('0')
    expect(screen.getByLabelText('Fusion output difference').textContent).toBe(
      '0.00000095367431640625',
    )
    expect(screen.getByLabelText('Fused output inexact')).toHaveTextContent(
      'Clear',
    )
    expect(screen.getByLabelText('Nonfused output inexact')).toHaveTextContent(
      'Raised',
    )
    expect(
      screen.getByLabelText('Fusion divergence explanation'),
    ).toHaveTextContent('discards information before C is added')
    expect(
      screen.getByRole('group', { name: 'Fused output binary' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: '3. Exact product and addend alignment',
      }),
    )
    expect(screen.getByLabelText('Product left shift')).toHaveTextContent('0')
    expect(screen.getByLabelText('Addend left shift')).toHaveTextContent('10')
  })

  it('distinguishes a finite fused result from an intermediate infinity and shows separate trace paths', async () => {
    const { user } = setup()
    await user.click(
      screen.getByRole('button', { name: /^FMA avoids intermediate overflow/ }),
    )
    expect(screen.getByLabelText('Fused output').textContent).toBe('65504')
    expect(screen.getByLabelText('Nonfused output').textContent).toBe(
      'Infinity',
    )
    expect(
      screen.getByLabelText('Exact multiplication product').textContent,
    ).toBe('131008')
    expect(screen.getByLabelText('Fused output overflow')).toHaveTextContent(
      'Clear',
    )
    expect(screen.getByLabelText('Nonfused output overflow')).toHaveTextContent(
      'Raised',
    )
    expect(screen.getByLabelText('Fusion output difference')).toHaveTextContent(
      'Undefined',
    )
    const path = screen.getByRole('combobox', { name: 'Trace path' })
    await user.selectOptions(path, 'product')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Stage 1 of 8 · Multiplication operand decoding',
    )
    await user.click(
      screen.getByRole('button', { name: '8. Result encoding and flags' }),
    )
    expect(screen.getByLabelText('Result hex')).toHaveTextContent('0x7c00')
    await user.selectOptions(path, 'addition')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 1 of 3')
    await user.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByLabelText('Short-circuit reason')).toHaveTextContent(
      'infinity',
    )
    await user.selectOptions(path, 'fused')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Stage 1 of 8 · Three-operand decoding',
    )
  })

  it('shows underflow and a nearest-even zero product, including signed zero', async () => {
    const { enter, user } = setup()
    await enter('0x8001', '0x3800', undefined, true)
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '-0',
    )
    expect(screen.getByLabelText('Arithmetic underflow')).toHaveTextContent(
      'Raised',
    )
    await user.click(
      screen.getByRole('button', { name: '6. Guard, round, sticky' }),
    )
    expect(screen.getByLabelText('Guard').textContent).toBe('1')
    expect(screen.getByLabelText('Round').textContent).toBe('0')
    expect(screen.getByLabelText('Sticky').textContent).toBe('0')
  })

  it('handles NaN addends, signaling metadata, invalid zero × infinity, and special short circuits', async () => {
    const { enter, user } = setup()
    await enter('0x0000', '0x7c00', '0xfe11', true)
    expect(screen.getByLabelText('Arithmetic result hex')).toHaveTextContent(
      '0xfe11',
    )
    expect(screen.getByLabelText('Arithmetic invalid')).toHaveTextContent(
      'Raised',
    )
    expect(
      screen.getByLabelText('Fusion divergence explanation'),
    ).toHaveTextContent('unordered')
    await user.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByLabelText('Invalid zero × infinity')).toHaveTextContent(
      'true',
    )
    expect(screen.getByLabelText('Selected NaN operand')).toHaveTextContent('C')
    await enter('1', '2', 'Infinity')
    expect(screen.getByLabelText('Fused output').textContent).toBe('Infinity')
    expect(
      screen.getByLabelText('Exact multiplication product').textContent,
    ).toBe('2')
    await enter('0x3c00', '0x3c00', '0xfc22', true)
    expect(screen.getByLabelText('Operand C encoding')).toHaveTextContent(
      'signaling · payload 34',
    )
    expect(screen.getByLabelText('Fused output hex')).toHaveTextContent(
      '0xfe22',
    )
  })

  it('rejects invalid C atomically and preserves the previous applied calculation', async () => {
    const { enter, user } = setup()
    await enter('1', '2', 'bad')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Operand C' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '1.5',
    )
    expect(
      screen.queryByRole('combobox', { name: 'Trace path' }),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /^Exact multiplication/ }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '3',
    )
  })

  it('supports keyboard FMA submission, bounded stage navigation, and native path selection', async () => {
    const { user, enter } = setup()
    await enter('1.5', '2', '-1')
    const panel = screen.getByRole('group', { name: 'Arithmetic stage detail' })
    panel.focus()
    await user.keyboard('{End}{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 8 of 8')
    await user.keyboard('{Home}{ArrowLeft}{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 2 of 8')
    const input = screen.getByRole('textbox', { name: 'Operand C' })
    await user.clear(input)
    await user.type(input, '-2{Enter}')
    expect(screen.getByLabelText('Fused output').textContent).toBe('1')
    const stages = within(
      screen.getByRole('list', { name: 'Arithmetic stages' }),
    )
    const grs = stages.getByRole('button', { name: '6. Guard, round, sticky' })
    grs.focus()
    await user.keyboard(' ')
    expect(grs).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Stage 6 of 8')
  })
})
