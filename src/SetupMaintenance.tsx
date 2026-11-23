import { useMemo, useState } from 'react'
import { Check, ChevronDown, Info } from 'lucide-react'
import { Modal, Toggle, numVal, useOnce } from './ui'
import { useStore } from './store'
import { LAST_DONE_LABEL, keysCoveredBy, lastServiceFor, planFor, type LastDone, type PlanItem } from './intervals'
import { todayISO } from './logic'
import type { BikeType, DrivingConditions, MaintItem, Transmission, Vehicle } from './types'

const ANSWERS: LastDone[] = ['just-done', 'recent', 'old', 'unknown']

const TRANSMISSIONS: { value: Transmission; label: string; hint: string }[] = [
  { value: 'automatic', label: 'Automatic', hint: 'P-R-N-D shifter' },
  { value: 'manual', label: 'Manual', hint: 'Has a clutch pedal' },
  { value: 'cvt', label: 'CVT', hint: 'Automatic with no fixed gears (common in small cars and hybrids)' },
  { value: 'dct', label: 'Dual-clutch', hint: 'Sporty automatic (DCT / DSG)' },
]

/** What kind of motorcycle. Decides which maintenance schedule is suggested, so the examples help owners find their own bike. */
export const BIKE_TYPES: { value: BikeType; label: string; hint: string; examples: string }[] = [
  { value: 'scooter', label: 'Scooter', hint: 'Twist-and-go, no clutch lever', examples: 'Mio, Click, Beat, NMAX, Aerox, PCX' },
  { value: 'small', label: 'Small motorcycle', hint: 'Has gears, up to about 150cc', examples: 'XRM, Wave, TMX, Raider, Barako' },
  { value: 'mid', label: 'Mid-size bike', hint: 'About 200 to 400cc', examples: 'Rouser 200, Ninja 400, Dominar 400, Rebel 300' },
  { value: 'big', label: 'Big bike', hint: 'Over 400cc', examples: 'Ninja 650, Z900, Rebel 500, Africa Twin' },
]

/** The same four conditions, worded for the kind of vehicle: a pickup tows, a motorcycle carries a rider and cargo. */
export const conditionsFor = (type: Vehicle['type']): { key: keyof DrivingConditions; label: string; hint: string }[] => [
  { key: 'heavyTraffic', label: 'Heavy traffic', hint: 'Stop-and-go in the city, like EDSA' },
  { key: 'shortTrips', label: 'Mostly short trips', hint: 'Under 10 km, so the engine rarely warms up fully' },
  { key: 'dusty', label: 'Dusty or flooded roads', hint: 'Construction, unpaved or flood-prone roads' },
  type === 'motorcycle'
    ? { key: 'towing', label: 'Carrying a passenger or cargo', hint: 'A backrider, delivery box or heavy bag most days' }
    : { key: 'towing', label: 'Carrying heavy loads', hint: 'Towing, full cargo, or a full load of passengers every day' },
]

const intervalText = (i: { intervalKm?: number; intervalMonths?: number }) =>
  [i.intervalKm && `${i.intervalKm.toLocaleString()} km`, i.intervalMonths && `${i.intervalMonths} mo`].filter(Boolean).join(' or ')

interface Row {
  item: PlanItem
  on: boolean
  answer: LastDone | ''
  /** What the owner typed from her booklet; blank means "use the general guidance". */
  bookletKm: string
  bookletMonths: string
  open: boolean
}

/**
 * Set up what to maintain for a vehicle. Step 1 confirms facts that change the schedule; step 2 shows the suggested
 * items with a plain reason each, asks "when was this last done?", and lets her replace any interval with the number
 * from her own casa booklet. Nothing is ever assumed to be freshly serviced: an unanswered or "I don't know" item is
 * saved as due, so the health score cannot say "Excellent" about a vehicle whose history nobody knows.
 */
export function SetupMaintenanceModal({ vehicleId, close }: { vehicleId: string; close: () => void }) {
  const { state, saveVehicle, addMaintItems } = useStore()
  const vehicle = state.vehicles.find((v) => v.id === vehicleId)
  const claim = useOnce()
  const [step, setStep] = useState<1 | 2>(1)
  const [transmission, setTransmission] = useState<Transmission>(vehicle?.transmission ?? (vehicle?.type === 'motorcycle' ? (vehicle.bikeType === 'scooter' ? 'cvt' : 'manual') : 'automatic'))
  const [cc, setCc] = useState(vehicle?.engineCc ? String(vehicle.engineCc) : '')
  // A saved vehicle from before this question existed starts on the type its engine size and gearbox imply.
  const [bikeType, setBikeType] = useState<BikeType | undefined>(
    vehicle?.type === 'motorcycle' ? vehicle.bikeType ?? (vehicle.engineCc || vehicle.transmission ? guessBikeType(vehicle.engineCc, vehicle.transmission) : undefined) : undefined,
  )
  const [driving, setDriving] = useState<DrivingConditions>(vehicle?.driving ?? {})

  const facts = useMemo(
    () => (vehicle ? { ...vehicle, transmission, bikeType, engineCc: numVal(cc) > 0 ? numVal(cc) : undefined, driving } : null),
    [vehicle, transmission, bikeType, cc, driving],
  )
  const plan = useMemo(() => (facts ? planFor(facts) : []), [facts])
  const [rows, setRows] = useState<Row[]>([])

  // Items already tracked for this vehicle (e.g. when updating an existing vehicle): do not add them twice.
  const existingKeys = new Set<string>()
  for (const m of state.maint) if (m.vehicleId === vehicleId) keysCoveredBy(m).forEach((k) => existingKeys.add(k))

  if (!vehicle || !facts) return null

  // A motorcycle can only continue once it is known what kind it is: that answer decides the whole schedule.
  const needsBikeType = vehicle.type === 'motorcycle' && !bikeType
  const goToItems = () => {
    if (needsBikeType) return
    setRows(plan.filter((p) => !existingKeys.has(p.key)).map((item) => ({ item, on: true, answer: '', bookletKm: '', bookletMonths: '', open: false })))
    setStep(2)
  }
  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const chosen = rows.filter((r) => r.on)
  const unanswered = chosen.filter((r) => !r.answer).length
  const today = todayISO()

  const save = () => {
    if (!claim()) return
    // The facts belong to the vehicle, so they are kept for next time and for "update from vehicle details".
    saveVehicle({ ...vehicle, transmission, bikeType, engineCc: facts.engineCc, driving })
    const items: Omit<MaintItem, 'id'>[] = chosen.map((r) => {
      const km = numVal(r.bookletKm) > 0 ? numVal(r.bookletKm) : r.item.intervalKm
      const mo = numVal(r.bookletMonths) > 0 ? numVal(r.bookletMonths) : r.item.intervalMonths
      const fromBooklet = numVal(r.bookletKm) > 0 || numVal(r.bookletMonths) > 0
      // An item left unanswered counts as "I don't know": it is never silently treated as freshly done.
      const last = lastServiceFor(r.answer || 'unknown', today, vehicle.odometer, vehicle.avgDailyKm, { intervalKm: km, intervalMonths: mo })
      return {
        vehicleId, name: r.item.name, intervalKm: km, intervalMonths: mo, ...last,
        source: fromBooklet ? 'booklet' : 'general', guideKey: r.item.key,
      }
    })
    if (items.length) addMaintItems(items)
    close()
  }

  return (
    <Modal title={step === 1 ? 'Set up maintenance' : `What needs servicing · ${vehicle.nickname}`} onClose={close}>
      {step === 1 ? (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Tell us a little about <b>{vehicle.nickname}</b> and we will suggest what to look after and when. You do not need to know any numbers.
          </p>

          {vehicle.type === 'car' ? (
            <fieldset>
              <legend className="label">What kind of gearbox does it have?</legend>
              <div className="grid grid-cols-2 gap-2">
                {TRANSMISSIONS.map((t) => (
                  <button key={t.value} type="button" aria-pressed={transmission === t.value} onClick={() => setTransmission(t.value)}
                    className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm transition ${transmission === t.value ? 'border-orange-500 bg-orange-500/10 font-semibold' : 'border-slate-300'}`}>
                    <span className="block">{t.label}</span>
                    <span className="block text-xs font-normal text-slate-500">{t.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <>
              <fieldset>
                <legend className="label">What kind of motorcycle is it?</legend>
                <div className="grid gap-2" role="radiogroup" aria-label="Kind of motorcycle">
                  {BIKE_TYPES.map((b) => (
                    <button key={b.value} type="button" role="radio" aria-checked={bikeType === b.value}
                      onClick={() => { setBikeType(b.value); setTransmission(b.value === 'scooter' ? 'cvt' : 'manual') }}
                      className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm transition ${bikeType === b.value ? 'border-orange-500 bg-orange-500/10 font-semibold' : 'border-slate-300'}`}>
                      <span className="block">{b.label} <span className="font-normal text-slate-500">· {b.hint}</span></span>
                      <span className="block text-xs font-normal text-slate-500">{b.examples}</span>
                    </button>
                  ))}
                </div>
                {needsBikeType && <p className="mt-1 text-xs text-slate-500" role="status">Pick the one that fits best so we suggest the right service items.</p>}
              </fieldset>
              {bikeType && (
                <label className="block">
                  <span className="label">Engine size in cc (optional)</span>
                  <input type="number" inputMode="numeric" className="field" value={cc} onChange={(e) => setCc(e.target.value)} placeholder={bikeType === 'scooter' ? 'e.g. 110, 125, 155' : bikeType === 'small' ? 'e.g. 110, 125, 150' : bikeType === 'mid' ? 'e.g. 200, 250, 400' : 'e.g. 650, 900, 1000'} />
                  <span className="mt-1 block text-xs text-slate-500">Find it on the OR/CR or in the model name. It only fine-tunes the schedule, so leave it blank if you are not sure.</span>
                </label>
              )}
            </>
          )}

          <fieldset>
            <legend className="label">How do you use it? (Pick all that apply)</legend>
            <div className="space-y-2">
              {conditionsFor(vehicle.type).map((c) => (
                <div key={c.key}>
                  <Toggle checked={!!driving[c.key]} onChange={(on) => setDriving((d) => ({ ...d, [c.key]: on }))} label={c.label} />
                  <p className="mt-0.5 px-1 text-xs text-slate-500">{c.hint}</p>
                </div>
              ))}
            </div>
          </fieldset>

          <button className="btn-primary w-full" onClick={goToItems} disabled={needsBikeType}>Next</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>These are <b>general guidance</b>, not from your {vehicle.type === 'car' ? 'car' : 'motorcycle'}&rsquo;s own manual. If you have the casa service booklet or sticker, tap an item and type its numbers instead. Not sure when something was done? Pick &ldquo;I don&rsquo;t know&rdquo;. We will simply mark it as worth checking.</span>
          </p>

          {rows.length === 0 && <p className="text-sm text-slate-500">Everything suggested for this vehicle is already being tracked.</p>}

          {unanswered > 1 && (
            <button type="button" className="btn-ghost w-full"
              onClick={() => setRows((rs) => rs.map((r) => (r.on && !r.answer ? { ...r, answer: 'unknown' as const } : r)))}>
              I&rsquo;m not sure about the rest ({unanswered})
            </button>
          )}

          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.item.key} className={`rounded-2xl border p-3 transition ${r.on ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60'}`}>
                <div className="flex items-start gap-2">
                  <button type="button" role="checkbox" aria-checked={r.on} aria-label={`Track ${r.item.name}`} onClick={() => patch(i, { on: !r.on })}
                    className="-m-1.5 grid h-11 w-11 shrink-0 place-items-center">
                    <span className={`grid h-6 w-6 place-items-center rounded-md border-2 ${r.on ? 'border-orange-500 on-brand' : 'border-slate-300'}`}>{r.on && <Check size={14} strokeWidth={3} />}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{r.item.name}</p>
                    <p className="text-xs text-slate-500">
                      {numVal(r.bookletKm) > 0 || numVal(r.bookletMonths) > 0
                        ? <>From your booklet: {intervalText({ intervalKm: numVal(r.bookletKm) || undefined, intervalMonths: numVal(r.bookletMonths) || undefined })}</>
                        : <>Every {intervalText(r.item)}{r.item.adjusted ? ` · ${r.item.adjusted}` : ''}</>}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{r.item.why}</p>
                  </div>
                </div>

                {r.on && (
                  <>
                    <p className="mb-1 mt-3 text-xs font-semibold text-slate-500">When was this last done?</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label={`When was ${r.item.name} last done?`}>
                      {ANSWERS.map((a) => (
                        <button key={a} type="button" role="radio" aria-checked={r.answer === a} onClick={() => patch(i, { answer: a })}
                          className={`min-h-11 rounded-lg border px-1.5 text-xs font-semibold transition ${r.answer === a ? 'border-orange-500 on-brand' : 'border-slate-300 text-slate-600'}`}>
                          {LAST_DONE_LABEL[a]}
                        </button>
                      ))}
                    </div>

                    <button type="button" className="mt-2 flex min-h-11 items-center gap-1 text-xs font-semibold text-orange-500" aria-expanded={r.open} onClick={() => patch(i, { open: !r.open })}>
                      <ChevronDown size={14} className={`transition ${r.open ? 'rotate-180' : ''}`} /> I have the number from my booklet
                    </button>
                    {r.open && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block"><span className="label">Every (km)</span>
                          <input type="number" inputMode="numeric" className="field" placeholder={r.item.intervalKm ? String(r.item.intervalKm) : '—'} value={r.bookletKm} onChange={(e) => patch(i, { bookletKm: e.target.value })} /></label>
                        <label className="block"><span className="label">Or every (months)</span>
                          <input type="number" inputMode="numeric" className="field" placeholder={r.item.intervalMonths ? String(r.item.intervalMonths) : '—'} value={r.bookletMonths} onChange={(e) => patch(i, { bookletMonths: e.target.value })} /></label>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>

          {unanswered > 0 && <p className="text-xs text-slate-500" role="status">{unanswered} item{unanswered === 1 ? '' : 's'} not answered yet. They will be saved as &ldquo;I don&rsquo;t know&rdquo; and shown as worth checking.</p>}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary flex-1" onClick={save} disabled={chosen.length === 0 && rows.length > 0}>
              Save {chosen.length} item{chosen.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** Exposed for the vehicle form: an existing vehicle that has no tracked items yet should be offered setup. */
export const needsSetup = (v: Pick<Vehicle, 'id'>, maint: Pick<MaintItem, 'vehicleId'>[]) => !maint.some((m) => m.vehicleId === v.id)

/** For a motorcycle saved before the bike-type question existed: the closest type its engine size and gearbox imply. */
export function guessBikeType(cc: number | undefined, transmission: Transmission | undefined): BikeType {
  if (cc && cc > 400) return 'big'
  if (cc && cc > 160) return 'mid'
  return transmission === 'cvt' || transmission === 'automatic' ? 'scooter' : 'small'
}
