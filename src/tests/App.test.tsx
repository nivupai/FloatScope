import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('Milestone 1 application shell', () => {
  it('provides a main landmark, a descriptive heading, and a skip link', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'FloatScope',
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

  it('discloses the explorer placeholder and provides no active numerical controls', () => {
    render(<App />)
    const explorer = screen.getByRole('region', { name: 'FP16 Explorer' })
    expect(
      within(explorer).getByText('Planned · Milestone 2'),
    ).toBeInTheDocument()
    expect(
      within(explorer).getByText(/numerical results are not implemented/),
    ).toBeInTheDocument()
    expect(within(explorer).queryByRole('button')).not.toBeInTheDocument()
    expect(within(explorer).queryByRole('textbox')).not.toBeInTheDocument()
  })
})
