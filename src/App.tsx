import { useState } from 'react'
import { ArithmeticExplorer } from './components/arithmetic/ArithmeticExplorer'
import { PrecisionMicroscope } from './components/microscope/PrecisionMicroscope'
import { FP16Explorer } from './components/FP16Explorer'
import { Header } from './components/Header'
import type { ColorTheme } from './components/Header'
import { Roadmap } from './components/Roadmap'

export default function App() {
  const [theme, setTheme] = useState<ColorTheme>('system')
  return (
    <div className="app-shell" data-theme={theme}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header theme={theme} onThemeChange={setTheme} />
      <main id="main" tabIndex={-1} className="page-width main-content">
        <div className="hero">
          <div>
            <p className="eyebrow">IEEE 754 / BINARY16 / INTERACTIVE LAB</p>
            <h1>
              FP Play<span className="hero-dot">.</span>
            </h1>
            <p className="hero-description">
              Small bits. Big implications. Explore how sixteen bits represent a
              number.
            </p>
          </div>
          <div className="hero-meta">
            <span className="lab-indicator" aria-hidden="true" />
            Milestone 5 <span className="muted">/ Arithmetic explorer</span>
          </div>
        </div>
        <FP16Explorer />
        <PrecisionMicroscope />
        <ArithmeticExplorer />
        <Roadmap />
        <section
          id="about"
          aria-labelledby="about-heading"
          className="about-section"
        >
          <h2 id="about-heading">Precision should be understandable.</h2>
          <p className="muted">
            FP Play connects numerical representations to their consequences
            through accessible, testable experiments. Explore IEEE 754
            representation, precision, and exact addition/subtraction traces. AI
            accelerator precision experiments are planned future work. All work
            uses public standards and original, open-source implementations.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        FP Play · Open source under the MIT License · Milestone 5
      </footer>
    </div>
  )
}
