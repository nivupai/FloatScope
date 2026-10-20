import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ArithmeticExplorer } from '../components/arithmetic/ArithmeticExplorer'
import { ARITHMETIC_EXAMPLES } from '../lib/arithmetic/examples'
import { calculateFP16 } from '../lib/numerics/fp16Arithmetic'
import { formatExactFP16 } from '../lib/explorer/presentation'
import { fp16BitsToHex } from '../lib/numerics'

function setup() {
  const user = userEvent.setup()
  render(<ArithmeticExplorer />)
  return {
    user,
    async enter(
      a: string,
      b: string,
      mode: 'decimal' | 'hex' = 'decimal',
      operation = 'add',
    ) {
      for (const [name, text] of [
        ['A', a],
        ['B', b],
      ]) {
        await user.selectOptions(
          screen.getByRole('combobox', { name: `Operand ${name} format` }),
          mode,
        )
        const input = screen.getByRole('textbox', { name: `Operand ${name}` })
        await user.clear(input)
        if (text) await user.type(input, text)
      }
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Operation' }),
        operation,
      )
      await user.click(screen.getByRole('button', { name: 'Trace operation' }))
    },
  }
}

describe('arithmetic integration with the exact numerical engine', () => {
  it('shows the initial result with labeled sign, exponent, fraction, and eight conceptual stages', () => {
    setup()
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '1.5',
    )
    expect(screen.getByLabelText('Arithmetic result hex')).toHaveTextContent(
      '0x3e00',
    )
    const binary = screen.getByRole('group', {
      name: 'Arithmetic result binary',
    })
    expect(within(binary).getByText('Sign')).toBeInTheDocument()
    expect(within(binary).getByText('Exponent')).toBeInTheDocument()
    expect(within(binary).getByText('Fraction')).toBeInTheDocument()
    expect(within(binary).getByText('0011111000000000')).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: 'Arithmetic stages' }).children,
    ).toHaveLength(8)
    expect(
      screen.getByRole('button', { name: 'Previous stage' }),
    ).toBeDisabled()
    expect(screen.getByLabelText('Arithmetic exact result')).toHaveTextContent(
      '1.5',
    )
  })

  it.each(ARITHMETIC_EXAMPLES)(
    'loads the verified $label preset and real trace',
    async (example) => {
      const { user } = setup()
      const button = screen.getByRole('button', {
        name: `${example.label} → ${fp16BitsToHex(example.expected)}`,
      })
      await user.click(button)
      const result = calculateFP16(example.a, example.b, example.operation)
      expect(screen.getByLabelText('Arithmetic result hex')).toHaveTextContent(
        fp16BitsToHex(example.expected),
      )
      expect(
        screen.getByLabelText('Arithmetic result decimal').textContent,
      ).toBe(formatExactFP16(result.decoded.value))
      expect(
        screen.getByLabelText('Arithmetic experiment explanation'),
      ).toHaveTextContent(example.explanation)
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('textbox', { name: 'Operand A' })).toHaveValue(
        fp16BitsToHex(example.a),
      )
      expect(
        screen.getByRole('list', { name: 'Arithmetic stages' }).children,
      ).toHaveLength(result.trace.length)
      for (const [flag, raised] of Object.entries(result.flags))
        expect(screen.getByLabelText(`Arithmetic ${flag}`).textContent).toBe(
          raised ? 'Raised' : 'Clear',
        )
    },
  )

  it('quantizes both decimal operands before arithmetic and distinguishes input, exact sum, and final result', async () => {
    const { enter } = setup()
    await enter('0.1', '0.2')
    expect(screen.getByLabelText('Operand A source')).toHaveTextContent(
      'Entered 0.1; binary64 0.1',
    )
    expect(screen.getByLabelText('Operand A quantized').textContent).toBe(
      '0.0999755859375',
    )
    expect(screen.getByLabelText('Operand B quantized').textContent).toBe(
      '0.199951171875',
    )
    expect(screen.getByLabelText('Arithmetic exact result').textContent).toBe(
      '0.2999267578125',
    )
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '0.2998046875',
    )
    expect(screen.getByLabelText('Arithmetic inexact')).toHaveTextContent(
      'Raised',
    )
  })

  it('preserves negative zero, performs subtraction, and accepts submission with Enter', async () => {
    const { enter, user } = setup()
    await enter('-0', '-0')
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '-0',
    )
    expect(screen.getByLabelText('Arithmetic result hex')).toHaveTextContent(
      '0x8000',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Operation' }),
      'subtract',
    )
    const a = screen.getByRole('textbox', { name: 'Operand A' })
    await user.click(a)
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '0',
    )
  })

  it('shows lossless alignment, sticky contribution, normalization, GRS, and rounding from the trace', async () => {
    const { user } = setup()
    await user.click(
      screen.getByRole('button', { name: /^Large exponent difference/ }),
    )
    await user.click(
      screen.getByRole('button', { name: '3. Lossless significand alignment' }),
    )
    expect(screen.getByLabelText('B right shift')).toHaveTextContent('14')
    expect(screen.getByLabelText('B aligned binary')).toHaveTextContent(
      '00000000000.00000000000001',
    )
    await user.click(
      screen.getByRole('button', { name: '6. Guard, round, sticky' }),
    )
    expect(screen.getByLabelText('Guard').textContent).toBe('0')
    expect(screen.getByLabelText('Round').textContent).toBe('0')
    expect(screen.getByLabelText('Sticky').textContent).toBe('1')
    await user.click(screen.getByRole('button', { name: /^Cancellation/ }))
    await user.click(screen.getByRole('button', { name: '5. Normalization' }))
    expect(screen.getByLabelText('Shift (right + / left −)')).toHaveTextContent(
      '-10',
    )
    await user.click(screen.getByRole('button', { name: /^Tie to even/ }))
    expect(screen.getByLabelText('Arithmetic exact result').textContent).toBe(
      '1.00048828125',
    )
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '1',
    )
    await user.click(
      screen.getByRole('button', { name: '7. Nearest-even rounding decision' }),
    )
    expect(screen.getByLabelText('Exact halfway tie')).toHaveTextContent('true')
    expect(screen.getByLabelText('Increment')).toHaveTextContent('false')
  })

  it('retains signed NaN metadata from raw input and short-circuits without finite stages', async () => {
    const { enter, user } = setup()
    await enter('0xfc11', '0x7e22', 'hex', 'subtract')
    expect(screen.getByLabelText('Operand A encoding')).toHaveTextContent(
      'signaling · payload 17',
    )
    expect(screen.getByLabelText('Arithmetic result hex')).toHaveTextContent(
      '0xfe11',
    )
    expect(screen.getByLabelText('Arithmetic invalid')).toHaveTextContent(
      'Raised',
    )
    expect(screen.getByLabelText('Arithmetic exact result')).toHaveTextContent(
      'Not a finite operation',
    )
    await user.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByLabelText('Selected NaN operand')).toHaveTextContent('A')
    expect(
      screen.queryByRole('button', { name: /Lossless significand alignment/ }),
    ).not.toBeInTheDocument()
  })

  it('displays the finite exact overflow sum alongside infinity and flags', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /^Overflow/ }))
    expect(screen.getByLabelText('Arithmetic exact result').textContent).toBe(
      '65520',
    )
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      'Infinity',
    )
    expect(screen.getByLabelText('Arithmetic overflow')).toHaveTextContent(
      'Raised',
    )
    expect(screen.getByLabelText('Arithmetic inexact')).toHaveTextContent(
      'Raised',
    )
  })

  it.each([
    ['', '1', 'decimal'],
    ['hello', '1', 'decimal'],
    ['1e999', '1', 'decimal'],
    ['0x12345', '0x0001', 'hex'],
    ['0x3c00', '0xZZZZ', 'hex'],
  ] as const)(
    'rejects invalid operands %s / %s without changing the applied operation',
    async (a, b, mode) => {
      const { enter, user } = setup()
      await enter(a, b, mode)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(
        screen.getByRole('textbox', {
          name: b === '0xZZZZ' ? 'Operand B' : 'Operand A',
        }),
      ).toHaveAttribute('aria-invalid', 'true')
      expect(
        screen.getByLabelText('Arithmetic result decimal').textContent,
      ).toBe('1.5')
      await user.click(screen.getByRole('button', { name: /^Exact addition/ }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    },
  )

  it('keeps draft edits separate from the applied result', async () => {
    const { user } = setup()
    const input = screen.getByRole('textbox', { name: 'Operand A' })
    await user.clear(input)
    await user.type(input, '2')
    expect(screen.getByLabelText('Operand A source')).toHaveTextContent(
      'Entered 1; binary64 1',
    )
    expect(screen.getByLabelText('Arithmetic result decimal').textContent).toBe(
      '1.5',
    )
  })

  it('supports keyboard stepping, bounded Home/End shortcuts, and native stage buttons', async () => {
    const { user } = setup()
    const panel = screen.getByRole('group', { name: 'Arithmetic stage detail' })
    panel.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 2 of 8')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 1 of 8')
    await user.keyboard('{End}{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 8 of 8')
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeDisabled()
    await user.keyboard('{Home}')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 1 of 8')
    const stage = screen.getByRole('button', {
      name: '6. Guard, round, sticky',
    })
    stage.focus()
    await user.keyboard(' ')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 6 of 8')
    expect(stage).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: '7. Nearest-even rounding decision' }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Stage 7 of 8')
  })
})
