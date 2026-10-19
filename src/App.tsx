import { FP16Explorer } from './components/FP16Explorer'
import { Header } from './components/Header'
import { Roadmap } from './components/Roadmap'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-6 pb-16">
        <div className="py-14 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.18em] text-indigo-700 uppercase">
            An open-source numerical laboratory
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-6xl">
            FloatScope
            <span className="mt-3 block text-slate-600">
              Small bits. Big implications.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Understand IEEE 754 floating-point arithmetic and numerical
            precision in AI accelerators, one bit at a time.
          </p>
          <a
            href="#explorer"
            className="mt-7 inline-flex items-center gap-3 rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            View the explorer workspace <span aria-hidden="true">↓</span>
          </a>
        </div>
        <FP16Explorer />
        <Roadmap />
        <section
          id="about"
          aria-labelledby="about-heading"
          className="mt-16 border-t border-slate-200 pt-10"
        >
          <h2
            id="about-heading"
            className="text-2xl font-semibold tracking-tight text-slate-950"
          >
            Precision should be understandable.
          </h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600">
            FloatScope connects numerical representations to their consequences
            through accessible, testable experiments. We begin with a solid
            foundation, then add carefully verified models and visual
            explanations. All work uses public standards and original,
            open-source implementations.
          </p>
        </section>
      </main>
      <footer className="border-t border-slate-200 px-6 py-6 text-center text-xs text-slate-600">
        FloatScope · Open source under the MIT License · Milestone 1
      </footer>
    </>
  )
}
