import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('application shell', () => {
  it('provides a main landmark, a descriptive heading, and a skip link', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'FP Play',
    )
    const main = screen.getByRole('main')
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', `#${main.id}`)
    expect(main).toHaveAttribute('tabindex', '-1')
  })

  it('connects each primary navigation link to a named section', () => {
    render(<App />)
    const navigation = screen.getByRole('navigation', { name: 'Primary' })
    const links = within(navigation).getAllByRole('link')
    expect(links).toHaveLength(3)
    for (const link of links) {
      const target = document.querySelector(link.getAttribute('href')!)
      expect(target).toBeInTheDocument()
      expect(target).toHaveAccessibleName()
    }
  })

  it('exposes the interactive explorer and changes the color theme', async () => {
    const user = userEvent.setup()
    render(<App />)
    const explorer = screen.getByRole('region', { name: 'FP16 Explorer' })
    expect(
      within(explorer).getByRole('textbox', {
        name: 'Decimal / special value',
      }),
    ).toBeInTheDocument()
    const theme = screen.getByRole('combobox', { name: 'Color theme' })
    expect(theme).toHaveValue('system')
    await user.selectOptions(theme, 'dark')
    expect(document.querySelector('.app-shell')).toHaveAttribute(
      'data-theme',
      'dark',
    )
    await user.selectOptions(theme, 'light')
    expect(document.querySelector('.app-shell')).toHaveAttribute(
      'data-theme',
      'light',
    )
  })
})
