const stages = [
  {
    number: '01',
    title: 'Project foundation',
    detail:
      'Application shell, tests, documentation, and continuous integration.',
    status: 'Current milestone',
  },
  {
    number: '02',
    title: 'Explore binary16',
    detail:
      'Bit manipulation, decoding, and decimal encoding with ties-to-even rounding.',
    status: 'Planned',
  },
  {
    number: '03',
    title: 'See precision',
    detail: 'Exponent, significand, representable values, and ULP spacing.',
    status: 'Planned',
  },
  {
    number: '04',
    title: 'Trace arithmetic',
    detail: 'Step-by-step FP16 addition, multiplication, and rounding traces.',
    status: 'Planned',
  },
  {
    number: '05',
    title: 'Compare & experiment',
    detail:
      'FP16, BF16, FP32, and transformer attention precision experiments.',
    status: 'Planned',
  },
  {
    number: '06',
    title: 'Connect to hardware',
    detail: 'Optional open RTL implementations and hardware validation.',
    status: 'Future / optional',
  },
]

export function Roadmap() {
  return (
    <section id="roadmap" aria-labelledby="roadmap-heading" className="mt-16">
      <h2
        id="roadmap-heading"
        className="text-2xl font-semibold tracking-tight text-slate-950"
      >
        A path from bits to behavior
      </h2>
      <p className="mt-3 text-slate-600">
        Built incrementally, with numerical correctness at every step.
      </p>
      <ol className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage) => (
          <li
            key={stage.number}
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="flex items-center justify-between gap-3 text-xs">
              <span aria-hidden="true" className="font-mono text-slate-500">
                {stage.number}
              </span>
              <span
                className={
                  stage.number === '01'
                    ? 'font-semibold text-indigo-700'
                    : 'text-slate-500'
                }
              >
                {stage.status}
              </span>
            </div>
            <h3 className="mt-5 font-semibold text-slate-950">{stage.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {stage.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
