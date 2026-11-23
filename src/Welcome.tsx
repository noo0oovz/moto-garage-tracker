import { CarFront, CheckCircle2, Motorbike, Plus, Upload } from 'lucide-react'
import type { Page } from './types'

/**
 * Shown instead of any vehicle page while the garage is empty. A first-time user starts with nothing, so the first thing
 * they see is a clear way to add their own vehicle, not an error or someone else's sample data.
 */
export function Welcome({ onAdd, go, page }: { onAdd: () => void; go: (p: Page) => void; page: Page }) {
  const first = page === 'garage' || page === 'more'
  return (
    <div className="page mx-auto max-w-xl py-4 text-center">
      <div className="card p-6 sm:p-8">
        <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-2xl bg-orange-500/15 p-3 text-orange-500" aria-hidden>
          <CarFront size={28} /><Motorbike size={28} />
        </div>
        <h2 className="text-[22px] font-bold tracking-tight">{first ? 'Welcome to MotoGarage PH' : 'Add a vehicle first'}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {first
            ? 'Keep track of what your car or motorcycle needs, when it is due, and what you spend, even when you service it outside the casa.'
            : 'This page shows information for your vehicle. Add your car or motorcycle to get started.'}
        </p>

        <button className="btn-primary mt-5 w-full sm:w-auto sm:px-8" onClick={onAdd}>
          <Plus size={18} /> Add your first vehicle
        </button>

        {first && (
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-slate-600">
            {['Know when oil, filters and fluids are due, with a plain reason for each', 'Log fuel and expenses, and see your cost per km', 'Compare pump prices near you'].map((t) => (
              <li key={t} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />{t}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col items-center gap-1 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>Already have a backup file?</p>
          <button className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-500 underline" onClick={() => go('settings')}>
            <Upload size={14} /> Import it in Settings
          </button>
        </div>
      </div>
    </div>
  )
}
