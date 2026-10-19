export function FP16Explorer() {
  return (
    <section
      id="explorer"
      aria-labelledby="explorer-heading"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
        <h2
          id="explorer-heading"
          className="text-xl font-semibold tracking-tight text-slate-950"
        >
          FP16 Explorer
        </h2>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
          Planned · Milestone 2
        </span>
      </div>
      <div className="p-6 sm:p-8">
        <p className="mb-6 max-w-2xl text-sm leading-6 text-slate-600">
          A future workspace for inspecting the 16 bits of an IEEE 754 binary16
          value. The field layout below is a static reference.
        </p>
        <dl className="grid gap-3 sm:grid-cols-[1fr_2fr_3fr]">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <dt className="font-semibold text-rose-950">Sign</dt>
            <dd className="mt-2 font-mono text-sm text-rose-900">1 bit</dd>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <dt className="font-semibold text-indigo-950">Exponent</dt>
            <dd className="mt-2 font-mono text-sm text-indigo-900">5 bits</dd>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
            <dt className="font-semibold text-teal-950">Fraction</dt>
            <dd className="mt-2 font-mono text-sm text-teal-900">10 bits</dd>
          </div>
        </dl>
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-medium text-slate-800">
            The foundation is here. Exploration comes next.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
            Bit editing, decimal encoding, and numerical results are not
            implemented in this milestone.
          </p>
        </div>
      </div>
    </section>
  )
}
