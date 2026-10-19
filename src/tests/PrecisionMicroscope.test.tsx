import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PrecisionMicroscope } from '../components/microscope/PrecisionMicroscope'
import { NumberLine } from '../components/microscope/NumberLine'
import { roundingIntervalFP16 } from '../lib/numerics/microscope'

function setup() {
  const user = userEvent.setup()
  render(<PrecisionMicroscope />)
  const input = screen.getByRole('textbox', {
    name: 'Microscope target (decimal / binary64)',
  })
  return {
    user,
    input,
    submit: async (text: string) => {
      await user.clear(input)
      if (text) await user.type(input, text)
      await user.keyboard('{Enter}')
    },
  }
}
function viewportWidth() {
  const [min, max] = screen
    .getByLabelText('Microscope viewport')
    .textContent!.split(' to ')
    .map(Number)
  return max - min
}

describe('Precision Microscope integration', () => {
  it('separates original binary64 from its FP16 result and shows encoding and error', () => {
    setup()
    expect(
      screen.getByLabelText('Microscope original binary64').textContent,
    ).toBe('1.0001')
    expect(screen.getByLabelText('Microscope quantized FP16').textContent).toBe(
      '1',
    )
    expect(screen.getByLabelText('Microscope selected hex').textContent).toBe(
      '0x3c00',
    )
    expect(
      screen.getByLabelText('Microscope selected binary').textContent,
    ).toBe('0011110000000000')
    expect(screen.getByLabelText('Microscope previous FP16').textContent).toBe(
      '0.99951171875',
    )
    expect(screen.getByLabelText('Microscope next FP16').textContent).toBe(
      '1.0009765625',
    )
    expect(screen.getByLabelText('Microscope absolute error').textContent).toBe(
      String(1.0001 - 1),
    )
    expect(
      screen.getByLabelText('Microscope rounding direction'),
    ).toHaveTextContent('Toward -Infinity')
    expect(
      screen.getByLabelText('Microscope example explanation'),
    ).toHaveTextContent('below the halfway boundary')
  })

  it('pans and zooms with both text buttons and chart keyboard shortcuts', async () => {
    const { user } = setup()
    const initial = viewportWidth()
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(viewportWidth()).toBe(initial / 2)
    const chart = screen.getByRole('group', {
      name: 'Interactive FP16 number line',
    })
    chart.focus()
    const beforePan = screen.getByLabelText('Microscope viewport').textContent
    await user.keyboard('{ArrowRight}')
    expect(screen.getByLabelText('Microscope viewport').textContent).not.toBe(
      beforePan,
    )
    await user.keyboard('+')
    expect(viewportWidth()).toBe(initial / 4)
    const beforeTarget = screen.getByLabelText(
      'Microscope original binary64',
    ).textContent
    await user.keyboard('{ArrowUp}')
    expect(
      screen.getByLabelText('Microscope original binary64').textContent,
    ).not.toBe(beforeTarget)
    expect(chart).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Fit target' }))
    expect(
      screen.getByRole('group', { name: 'Interactive FP16 number line' }),
    ).toBeInTheDocument()
  })

  it('discloses sampling and bounds the number of rendered points in an overview', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Overview' }))
    expect(
      screen.getByRole('status', { name: 'Viewport sampling' }),
    ).toHaveTextContent('showing 121 of 63487')
    expect(document.querySelectorAll('.lattice-point')).toHaveLength(121)
    expect(
      screen.getByText(/Omitted points are still representable/),
    ).toBeInTheDocument()
    expect(screen.getByText(/share one geometric point/)).toBeInTheDocument()
  })

  it('selects exact visible points through the keyboard-accessible native control', async () => {
    const { user } = setup()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Inspect a visible FP16 point' }),
      String(0x3c00),
    )
    expect(
      screen.getByLabelText('Microscope original binary64').textContent,
    ).toBe('1')
    expect(
      screen.getByLabelText('Microscope rounding direction'),
    ).toHaveTextContent('Exact (no rounding)')
  })

  it('moves the binary64 target through the range control without snapping to FP16', () => {
    setup()
    fireEvent.change(
      screen.getByRole('slider', { name: 'Move target within viewport' }),
      { target: { value: '507' } },
    )
    expect(
      screen.getByLabelText('Microscope original binary64').textContent,
    ).not.toBe('1.0001')
    expect(screen.getByLabelText('Microscope quantized FP16').textContent).toBe(
      '1',
    )
  })

  it('supports exact midpoint input and explicitly explains ties-to-even', async () => {
    const { submit } = setup()
    await submit('1.00048828125')
    expect(screen.getByLabelText('Microscope quantized FP16').textContent).toBe(
      '1',
    )
    expect(
      screen.getByRole('status', { name: 'Halfway tie' }),
    ).toHaveTextContent('even retained significand wins: 0x3c00')
    expect(
      screen.getByLabelText('Microscope rounding interval'),
    ).toHaveTextContent('[0.999755859375, 1.00048828125]')
    expect(screen.getByLabelText('Microscope relative error').textContent).toBe(
      String(1 / 2049),
    )
  })

  it('handles negative targets, signed zero, and undefined zero-relative error', async () => {
    const { submit } = setup()
    await submit('-1.0001')
    expect(screen.getByLabelText('Microscope quantized FP16').textContent).toBe(
      '-1',
    )
    expect(
      screen.getByLabelText('Microscope rounding direction'),
    ).toHaveTextContent('Toward +Infinity')
    await submit('-0')
    expect(
      screen.getByLabelText('Microscope original binary64').textContent,
    ).toBe('-0')
    expect(screen.getByLabelText('Microscope selected hex').textContent).toBe(
      '0x8000',
    )
    expect(
      screen.getByLabelText('Microscope relative error'),
    ).toHaveTextContent('Undefined (zero denominator)')
    expect(
      screen.queryByRole('status', { name: 'Halfway tie' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['Why 1.0001 becomes 1', '1', '0x3c00'],
    ['Spacing near 1', '1', '0x3c00'],
    ['Spacing near 1000', '1000', '0x63d0'],
    ['Subnormal precision', '0.000000178813934326171875', '0x0003'],
    ['Gradual underflow', '0', '0x0000'],
    ['Exponent boundary', '2', '0x4000'],
    ['Maximum finite and overflow', 'Infinity', '0x7c00'],
  ])('runs the %s educational preset', async (name, value, hex) => {
    const { user } = setup()
    const button = screen.getByRole('button', { name })
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Microscope quantized FP16').textContent).toBe(
      value,
    )
    expect(screen.getByLabelText('Microscope selected hex').textContent).toBe(
      hex,
    )
    expect(
      screen.getByLabelText('Microscope example explanation').textContent!
        .length,
    ).toBeGreaterThan(30)
  })

  it('explains overflow ties and infinite error without putting infinity on a finite axis', async () => {
    const { submit } = setup()
    await submit('65520')
    expect(
      screen.getByRole('status', { name: 'Halfway tie' }),
    ).toHaveTextContent('virtual magnitude 65536')
    expect(screen.getByLabelText('Microscope absolute error').textContent).toBe(
      'Infinity',
    )
    expect(screen.getByLabelText('Microscope relative error').textContent).toBe(
      'Infinity',
    )
    expect(screen.getByLabelText('Microscope previous FP16').textContent).toBe(
      '65504',
    )
    expect(
      screen.getByText(/FP16 Infinity · off finite axis/),
    ).toBeInTheDocument()
  })

  it.each(['NaN', 'Infinity', '-Infinity'])(
    'handles %s as an explicit nonfinite input',
    async (value) => {
      const { submit } = setup()
      await submit(value)
      expect(
        screen.getByLabelText('Microscope original binary64').textContent,
      ).toBe(value)
      expect(
        screen.getByLabelText('Microscope absolute error'),
      ).toHaveTextContent('Undefined (nonfinite input)')
      expect(
        screen.getByText(/target is not on this finite viewport/),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('status', { name: 'Halfway tie' }),
      ).not.toBeInTheDocument()
    },
  )

  it.each(['', 'invalid', '0x3c00', '1e999'])(
    'rejects %s without mutating the applied target',
    async (value) => {
      const { submit, input } = setup()
      await submit(value)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(
        screen.getByLabelText('Microscope original binary64').textContent,
      ).toBe('1.0001')
    },
  )

  it('keeps the entered text distinct from the parsed binary64 value', async () => {
    const { submit } = setup()
    await submit('1.00000000000000000000001')
    expect(screen.getByLabelText('Microscope entered text').textContent).toBe(
      '1.00000000000000000000001',
    )
    expect(
      screen.getByLabelText('Microscope original binary64').textContent,
    ).toBe('1')
    expect(screen.getByLabelText('Microscope absolute error').textContent).toBe(
      '0',
    )
    expect(
      screen.getByText(/not an exact decimal-rational input/),
    ).toBeInTheDocument()
  })

  it('selects global ULP regions and refocuses the local number line', async () => {
    const { user } = setup()
    const regions = screen.getByRole('combobox', {
      name: 'Inspect spacing region',
    })
    await user.selectOptions(regions, '24')
    expect(
      screen.getByLabelText('Microscope original binary64').textContent,
    ).toBe('512')
    expect(screen.getByLabelText('Microscope ULP').textContent).toBe('0.5')
    await user.selectOptions(regions, '0')
    expect(screen.getByLabelText('Microscope selected hex').textContent).toBe(
      '0x0001',
    )
    expect(screen.getByLabelText('Microscope ULP').textContent).toBe(
      '0.000000059604644775390625',
    )
    expect(
      screen.getByRole('img', { name: 'Positive FP16 ULP versus magnitude' }),
    ).toBeInTheDocument()
  })

  it('maps pointer target movement and pan drags through viewport geometry', async () => {
    const user = userEvent.setup()
    let view = { min: 0, max: 2 }
    let target = 0
    render(
      <NumberLine
        viewport={view}
        target={0}
        bits={0}
        interval={roundingIntervalFP16(0)}
        onViewport={(next) => {
          view = next
        }}
        onTarget={(value) => {
          target = value
        }}
        onFit={() => {}}
      />,
    )
    const chart = screen.getByRole('group', {
      name: 'Interactive FP16 number line',
    })
    // jsdom has no layout; supply the SVG's real viewBox-sized bounding rectangle.
    chart.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 1000,
      height: 235,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 235,
      toJSON: () => ({}),
    })
    await user.pointer([
      { keys: '[MouseLeft>]', target: chart, coords: { clientX: 500 } },
      { keys: '[/MouseLeft]', target: chart },
    ])
    expect(target).toBe(1)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Number line drag mode' }),
      'pan',
    )
    await user.pointer([
      { keys: '[MouseLeft>]', target: chart, coords: { clientX: 500 } },
      { target: chart, coords: { clientX: 720 } },
      { keys: '[/MouseLeft]', target: chart },
    ])
    expect(view).toEqual({ min: -0.5, max: 1.5 })
  })
})
