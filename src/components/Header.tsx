export type ColorTheme = 'system' | 'light' | 'dark'

export function Header({
  theme,
  onThemeChange,
}: {
  theme: ColorTheme
  onThemeChange: (theme: ColorTheme) => void
}) {
  return (
    <header className="site-header">
      <div className="page-width header-inner">
        <a href="#main" className="brand">
          <span aria-hidden="true" className="brand-mark">
            ƒ
          </span>
          <span>
            FP Play<small>THE NUMERICAL LAB</small>
          </span>
        </a>
        <nav aria-label="Primary" className="primary-nav">
          <a href="#explorer">Bit Explorer</a>
          <a href="#microscope">Microscope</a>
          <a href="#arithmetic">Arithmetic</a>
        </nav>
        <label className="theme-picker">
          <span className="sr-only">Color theme</span>
          <select
            value={theme}
            onChange={(event) =>
              onThemeChange(event.target.value as ColorTheme)
            }
          >
            <option value="system">System theme</option>
            <option value="light">Light theme</option>
            <option value="dark">Dark theme</option>
          </select>
        </label>
      </div>
    </header>
  )
}
