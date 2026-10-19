export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
        <a
          href="#main"
          className="flex items-center gap-3 font-bold tracking-tight text-slate-950"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-700 font-mono text-sm text-white"
          >
            ƒ
          </span>
          FloatScope
        </a>
        <nav
          aria-label="Primary"
          className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600"
        >
          <a href="#explorer">FP16 Explorer</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#about">About</a>
        </nav>
      </div>
    </header>
  )
}
