import { useState } from 'react'
import { Modal, Field, Toggle, numVal, useOnce } from './ui'
import { useStore } from './store'
import { CODING_DAYS, FUEL_TYPES, PART_TYPES } from './data'
import { EXPENSE_CATEGORIES, PART_CONDITIONS, type CodingDay, type Expense, type ExpenseCategory, type FuelLog, type FuelType, type MaintItem, type PartCondition, type PartRecord, type ServiceRecord, type Vehicle, type VehicleType } from './types'
import { peso, todayISO, uid } from './logic'
import { MONTH_NAMES, codingDayFor, codingIsAuto, nextRenewal } from './plate'
import { useFuelData } from './useFuelData'
import { SetupMaintenanceModal } from './SetupMaintenance'
import { ItemDetailModal } from './ItemDetail'
import { brandsFor, isProduct, productsFor, type FwProduct } from './pricing'

export type ModalState =
  | { kind: 'log'; tab: 'fuel' | 'expense'; editFuel?: FuelLog; editExpense?: Expense }
  | { kind: 'service'; item: MaintItem }
  | { kind: 'item'; item: MaintItem }
  | { kind: 'maint'; item?: MaintItem }
  | { kind: 'vehicle'; item?: Vehicle }
  | { kind: 'setup'; vehicleId: string }
  | { kind: 'part'; item?: PartRecord }
  | { kind: 'editService'; item: ServiceRecord }
  | null

export function Modals({ modal, close, openModal }: { modal: ModalState; close: () => void; openModal: (m: ModalState) => void }) {
  if (!modal) return null
  if (modal.kind === 'item') return <ItemDetailModal itemId={modal.item.id} close={close} openModal={openModal} />
  if (modal.kind === 'setup') return <SetupMaintenanceModal vehicleId={modal.vehicleId} close={close} />
  if (modal.kind === 'part') return <PartModal item={modal.item} close={close} />
  if (modal.kind === 'editService') return <EditServiceModal item={modal.item} close={close} />
  if (modal.kind === 'log') return <LogModal initial={modal.tab} editFuel={modal.editFuel} editExpense={modal.editExpense} close={close} />
  if (modal.kind === 'service') return <ServiceModal item={modal.item} close={close} />
  if (modal.kind === 'maint') return <MaintModal item={modal.item} close={close} />
  return <VehicleModal item={modal.item} close={close} openModal={openModal} />
}

function LogModal({ initial, editFuel, editExpense, close }: { initial: 'fuel' | 'expense'; editFuel?: FuelLog; editExpense?: Expense; close: () => void }) {
  const { vehicle, addFuel, addExpense, updateFuel, updateExpense } = useStore()
  const editing = !!(editFuel || editExpense)
  const [tab, setTab] = useState<'fuel' | 'expense'>(editFuel ? 'fuel' : editExpense ? 'expense' : initial)
  const [date, setDate] = useState(editFuel?.date ?? editExpense?.date ?? todayISO())
  const [odo, setOdo] = useState(String(editFuel?.odometer ?? editExpense?.odometer ?? vehicle?.odometer ?? ''))
  // fuel
  const [liters, setLiters] = useState(editFuel ? String(editFuel.liters) : '')
  const [ppl, setPpl] = useState(editFuel ? String(editFuel.pricePerLiter) : '')
  const [total, setTotal] = useState(editFuel ? String(editFuel.totalCost) : '')
  const [station, setStation] = useState(editFuel?.station ?? '')
  const [full, setFull] = useState(editFuel?.fullTank ?? true)
  // expense
  const [cat, setCat] = useState<ExpenseCategory>(editExpense?.category ?? 'PMS & Fluids')
  const [cost, setCost] = useState(editExpense ? String(editExpense.cost) : '')
  const [shop, setShop] = useState(editExpense?.shopName ?? '')
  const [notes, setNotes] = useState(editExpense?.notes ?? '')

  if (!vehicle) return null
  const recalc = (l: string, p: string) => {
    const t = numVal(l) * numVal(p)
    setTotal(t > 0 ? t.toFixed(2) : '')
  }
  const odoLow = !editing && numVal(odo) > 0 && numVal(odo) < (vehicle?.odometer ?? 0) && date >= todayISO()
  const valid = (tab === 'fuel' ? numVal(liters) > 0 && numVal(total) > 0 && numVal(odo) > 0 : numVal(cost) > 0) && !odoLow

  const claim = useOnce()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || !claim()) return
    const odometer = numVal(odo) || undefined
    if (tab === 'fuel') {
      const f = {
        date, liters: numVal(liters), pricePerLiter: numVal(ppl) || numVal(total) / numVal(liters),
        totalCost: numVal(total), odometer: numVal(odo), station, fullTank: full,
      }
      if (editFuel) updateFuel(editFuel.id, f)
      else addFuel({ vehicleId: vehicle.id, ...f })
    } else {
      const x = { date, category: cat, cost: numVal(cost), shopName: shop, notes, odometer }
      if (editExpense) updateExpense(editExpense.id, x)
      else addExpense({ vehicleId: vehicle.id, ...x })
    }
    close()
  }

  return (
    <Modal title={editing ? `Edit ${tab === 'fuel' ? 'Fuel Log' : 'Expense'}` : `Quick Log · ${vehicle.nickname}`} onClose={close}>
      <div className={`mb-4 grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 ${editing ? 'hidden' : 'grid'}`}>
        {(['fuel', 'expense'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`min-h-11 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'on-brand shadow' : 'text-slate-500'}`}>
            {t}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Odometer (km)"><input type="number" inputMode="numeric" className="field" value={odo} onChange={(e) => setOdo(e.target.value)} /></Field>
        {tab === 'fuel' ? (
          <>
            <Field label="Liters"><input type="number" inputMode="decimal" step="0.01" className="field" value={liters}
              onChange={(e) => { setLiters(e.target.value); recalc(e.target.value, ppl) }} /></Field>
            <Field label="Price / Liter (₱)"><input type="number" inputMode="decimal" step="0.01" className="field" value={ppl}
              onChange={(e) => { setPpl(e.target.value); recalc(liters, e.target.value) }} /></Field>
            <Field label="Total Cost (₱)" className="col-span-2"><input type="number" inputMode="decimal" step="0.01" className="field" value={total}
              onChange={(e) => { setTotal(e.target.value); if (numVal(liters) > 0) setPpl((numVal(e.target.value) / numVal(liters)).toFixed(2)) }} /></Field>
            <Field label="Station" className="col-span-2"><input className="field" value={station} onChange={(e) => setStation(e.target.value)} placeholder="Petron, Shell…" /></Field>
            <div className="col-span-2"><Toggle checked={full} onChange={setFull} label="Full tank (used for km/L)" /></div>
          </>
        ) : (
          <>
            <Field label="Category" className="col-span-2">
              <select className="field" value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory)}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Cost (₱)"><input type="number" inputMode="decimal" step="0.01" className="field" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="Shop Name"><input className="field" value={shop} onChange={(e) => setShop(e.target.value)} /></Field>
            <Field label="Notes" className="col-span-2"><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </>
        )}
        {odoLow && <p role="alert" className="col-span-2 text-xs text-red-500">Odometer can't be lower than the current {vehicle.odometer.toLocaleString()} km for a log dated today. Back-date the entry if it's older.</p>}
        <button type="submit" disabled={!valid} className="btn-primary col-span-2 mt-1">
          {editing ? 'Save changes' : `Save ${tab === 'fuel' ? `fuel ${numVal(total) ? peso(numVal(total), 2) : ''}` : 'expense'}`}
        </button>
      </form>
    </Modal>
  )
}

function PartModal({ item, close }: { item?: PartRecord; close: () => void }) {
  const { vehicle, addPart, updatePart } = useStore()
  const [partType, setPartType] = useState(item?.partType ?? PART_TYPES[0])
  const [condition, setCondition] = useState<PartCondition>(item?.condition ?? 'Brand New Original')
  const [description, setDescription] = useState(item?.description ?? '')
  const [brand, setBrand] = useState(item?.brand ?? '')
  const [partNumber, setPartNumber] = useState(item?.partNumber ?? '')
  const [shop, setShop] = useState(item?.shop ?? '')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [km, setKm] = useState(String(item?.installedKm ?? vehicle?.odometer ?? ''))
  const [date, setDate] = useState(item?.date ?? todayISO())
  const [warranty, setWarranty] = useState(item?.warrantyMonths ? String(item.warrantyMonths) : '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  if (!vehicle) return null
  const claim = useOnce()
  return (
    <Modal title={item ? 'Edit Part Replacement' : 'Add Part Replacement'} onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!claim()) return
          const rec = {
            partType, condition, description, brand, partNumber, shop, amount: numVal(amount),
            installedKm: numVal(km), date, warrantyMonths: numVal(warranty) > 0 ? numVal(warranty) : undefined, notes,
          }
          if (item) updatePart(item.id, rec)
          else addPart({ vehicleId: vehicle.id, ...rec })
          close()
        }}
      >
        <Field label="Part Type *" className="col-span-2">
          <select className="field" value={partType} onChange={(e) => setPartType(e.target.value)}>{PART_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Part Condition *" className="col-span-2">
          <select className="field" value={condition} onChange={(e) => setCondition(e.target.value as PartCondition)}>{PART_CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Description" className="col-span-2"><input className="field" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Brand"><input className="field" value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
        <Field label="Part Number"><input className="field" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} /></Field>
        <Field label="Amount (₱) *"><input type="number" inputMode="decimal" step="0.01" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label="Shop"><input className="field" value={shop} onChange={(e) => setShop(e.target.value)} /></Field>
        <Field label="Installed Mileage (km) *"><input type="number" inputMode="numeric" className="field" value={km} onChange={(e) => setKm(e.target.value)} required /></Field>
        <Field label="Replacement Date *"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Warranty (months)" className="col-span-2"><input type="number" inputMode="numeric" className="field" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Notes" className="col-span-2"><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <button className="btn-primary col-span-2" type="submit">Save Record</button>
      </form>
    </Modal>
  )
}

function EditServiceModal({ item, close }: { item: ServiceRecord; close: () => void }) {
  const { updateService } = useStore()
  const [date, setDate] = useState(item.date)
  const [odo, setOdo] = useState(String(item.odometer))
  const [cost, setCost] = useState(item.cost ? String(item.cost) : '')
  const [shop, setShop] = useState(item.shopName ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const claim = useOnce()
  return (
    <Modal title="Edit Service Record" onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!claim()) return
          updateService(item.id, { date, odometer: numVal(odo), cost: numVal(cost) > 0 ? numVal(cost) : undefined, shopName: shop, notes })
          close()
        }}
      >
        <p className="col-span-2 text-sm font-semibold">{item.name}</p>
        <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Odometer (km)"><input type="number" inputMode="numeric" className="field" value={odo} onChange={(e) => setOdo(e.target.value)} required /></Field>
        <Field label="Cost (₱)"><input type="number" inputMode="decimal" step="0.01" className="field" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Shop"><input className="field" value={shop} onChange={(e) => setShop(e.target.value)} /></Field>
        <Field label="Notes" className="col-span-2"><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <button className="btn-primary col-span-2" type="submit">Save changes</button>
      </form>
    </Modal>
  )
}

function ServiceModal({ item, close }: { item: MaintItem; close: () => void }) {
  const { vehicle, markServiced } = useStore()
  const [date, setDate] = useState(todayISO())
  const [odo, setOdo] = useState(String(vehicle?.odometer ?? item.lastServiceKm))
  const [record, setRecord] = useState(true)
  const [cost, setCost] = useState('')
  const [shop, setShop] = useState('')
  const claim = useOnce()
  return (
    <Modal title="Mark Serviced" onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!claim()) return
          markServiced(item.id, { date, odometer: numVal(odo), cost: record ? numVal(cost) : undefined, shopName: shop, notes: item.name })
          close()
        }}
      >
        <p className="col-span-2 text-sm font-semibold">{item.name}</p>
        <Field label="Service Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Odometer (km)"><input type="number" inputMode="numeric" className="field" value={odo} onChange={(e) => setOdo(e.target.value)} required /></Field>
        <div className="col-span-2"><Toggle checked={record} onChange={setRecord} label="Also record as expense" /></div>
        {record && (
          <>
            <Field label="Cost (₱)"><input type="number" inputMode="decimal" className="field" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="Shop"><input className="field" value={shop} onChange={(e) => setShop(e.target.value)} /></Field>
          </>
        )}
        <button className="btn-primary col-span-2" type="submit">Confirm Service</button>
      </form>
    </Modal>
  )
}

function MaintModal({ item, close }: { item?: MaintItem; close: () => void }) {
  const { vehicle, saveMaint, deleteMaint } = useStore()
  const [name, setName] = useState(item?.name ?? '')
  const [km, setKm] = useState(item?.intervalKm ? String(item.intervalKm) : '')
  const [mo, setMo] = useState(item?.intervalMonths ? String(item.intervalMonths) : '')
  const [lastKm, setLastKm] = useState(String(item?.lastServiceKm ?? vehicle?.odometer ?? 0))
  const [lastDate, setLastDate] = useState(item?.lastServiceDate ?? todayISO())
  if (!vehicle) return null
  const valid = name.trim() && (numVal(km) > 0 || numVal(mo) > 0)
  const claim = useOnce()
  return (
    <Modal title={item ? 'Edit Maintenance Item' : 'Add Maintenance Item'} onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid || !claim()) return
          saveMaint({
            id: item?.id, vehicleId: vehicle.id, name: name.trim(),
            intervalKm: numVal(km) > 0 ? numVal(km) : undefined, intervalMonths: numVal(mo) > 0 ? numVal(mo) : undefined,
            lastServiceKm: numVal(lastKm), lastServiceDate: lastDate,
          })
          close()
        }}
      >
        <Field label="Name" className="col-span-2"><input className="field" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Interval (km)"><input type="number" inputMode="numeric" className="field" value={km} onChange={(e) => setKm(e.target.value)} /></Field>
        <Field label="Interval (months)"><input type="number" inputMode="numeric" className="field" value={mo} onChange={(e) => setMo(e.target.value)} /></Field>
        <Field label="Last Service (km)"><input type="number" inputMode="numeric" className="field" value={lastKm} onChange={(e) => setLastKm(e.target.value)} /></Field>
        <Field label="Last Service Date"><input type="date" className="field" value={lastDate} onChange={(e) => setLastDate(e.target.value)} /></Field>
        {!valid && <p className="col-span-2 text-xs text-slate-500">Set at least one interval (km and/or months).</p>}
        <button className="btn-primary col-span-2" type="submit" disabled={!valid}>Save</button>
        {item && (
          <button type="button" className="btn-danger col-span-2" onClick={() => { if (confirm('Delete this item?')) { deleteMaint(item.id); close() } }}>
            Delete item
          </button>
        )}
      </form>
    </Modal>
  )
}

function VehicleModal({ item, close, openModal }: { item?: Vehicle; close: () => void; openModal: (m: ModalState) => void }) {
  const { saveVehicle } = useStore()
  // A new vehicle gets its id here, so the setup dialog can open for it the moment it is saved.
  const [newId] = useState(() => item?.id ?? uid())
  const [type, setType] = useState<VehicleType>(item?.type ?? 'car')
  const [nickname, setNickname] = useState(item?.nickname ?? '')
  const [make, setMake] = useState(item?.make ?? '')
  const [model, setModel] = useState(item?.model ?? '')
  const [year, setYear] = useState(String(item?.year ?? new Date().getFullYear()))
  const [plate, setPlate] = useState(item?.plate ?? '')
  const [odo, setOdo] = useState(String(item?.odometer ?? 0))
  const [daily, setDaily] = useState(String(item?.avgDailyKm ?? 30))
  // The coding day follows the plate (cars) or is Exempt (motorcycles) until the user picks a day themselves.
  // A saved vehicle whose day already differs from its plate starts as a deliberate override and is left alone.
  const [coding, setCoding] = useState<CodingDay>(item?.codingDay ?? codingDayFor(item?.type ?? 'car', item?.plate ?? ''))
  const [codingManual, setCodingManual] = useState(item ? !codingIsAuto(item) : false)
  const [fuel, setFuel] = useState<FuelType>(item?.fuelType ?? 'Gasoline')
  // Preferred fuel: the brand and grade this vehicle usually buys. Grades follow the vehicle's fuel type.
  const [prefBrand, setPrefBrand] = useState(item?.preferredFuel?.brand ?? '')
  const [prefProduct, setPrefProduct] = useState<string>(item?.preferredFuel?.product ?? '')
  const { data: priceData } = useFuelData()
  const grades = productsFor(fuel)
  // Only offer brands that actually report the chosen grade; keep a saved brand listed so it is never silently lost.
  const brandChoices = (() => {
    const list = priceData && isProduct(prefProduct) ? brandsFor(priceData, prefProduct) : []
    return prefBrand && !list.includes(prefBrand) ? [prefBrand, ...list] : list
  })()
  const claim = useOnce()
  const autoCoding = codingDayFor(type, plate)
  const shownCoding = codingManual ? coding : autoCoding
  // "Already registered" is stored as the deadline that was paid. It is a switch on the CURRENT deadline: a different
  // plate digit means a different month, so a mark made for the old deadline no longer applies.
  const [registeredFor, setRegisteredFor] = useState(item?.registeredFor ?? '')
  const renewal = nextRenewal(plate, type, todayISO(), registeredFor)
  const markStale = !!registeredFor && !!renewal && !renewal.registered
  return (
    <Modal title={item ? 'Edit Vehicle' : 'Add Vehicle'} onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!claim()) return
          saveVehicle({
            id: newId, type, nickname: nickname.trim() || `${make} ${model}`.trim() || 'My Vehicle', make, model,
            year: numVal(year), plate, odometer: numVal(odo), avgDailyKm: numVal(daily), codingDay: shownCoding, fuelType: fuel,
            preferredFuel: prefBrand && isProduct(prefProduct) && grades.includes(prefProduct) ? { brand: prefBrand, product: prefProduct } : undefined,
            // Keep only a mark that still matches this plate's current deadline.
            registeredFor: renewal?.registered ? registeredFor : undefined,
          })
          if (item) close(); else openModal({ kind: 'setup', vehicleId: newId })
        }}
      >
        {!item && (
          <div className="col-span-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(['car', 'motorcycle'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`min-h-11 rounded-lg text-sm font-semibold capitalize ${type === t ? 'on-brand' : 'text-slate-500'}`}>{t}</button>
            ))}
          </div>
        )}
        <Field label="Nickname" className="col-span-2"><input className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} /></Field>
        <Field label="Make"><input className="field" value={make} onChange={(e) => setMake(e.target.value)} /></Field>
        <Field label="Model"><input className="field" value={model} onChange={(e) => setModel(e.target.value)} /></Field>
        <Field label="Year"><input type="number" inputMode="numeric" className="field" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
        <Field label="Plate Number"><input className="field uppercase" value={plate} onChange={(e) => setPlate(e.target.value)} autoCapitalize="characters" autoComplete="off" /></Field>
        <Field label="Odometer (km)"><input type="number" inputMode="numeric" className="field" value={odo} onChange={(e) => setOdo(e.target.value)} /></Field>
        <Field label="Avg Daily Km"><input type="number" inputMode="numeric" className="field" value={daily} onChange={(e) => setDaily(e.target.value)} /></Field>
        <Field label="Coding Day">
          <select className="field" value={shownCoding} onChange={(e) => { setCoding(e.target.value as CodingDay); setCodingManual(true) }}>
            {CODING_DAYS.map((d) => <option key={d} value={d}>{d === 'Exempt' ? 'Exempt / None' : d}</option>)}
          </select>
        </Field>
        <Field label="Fuel Type">
          <select className="field" value={fuel} onChange={(e) => {
            const next = e.target.value as FuelType
            setFuel(next)
            // A grade that does not suit the new fuel type (e.g. RON 95 on a diesel) would be nonsense: clear it.
            if (!productsFor(next).includes(prefProduct as FwProduct)) { setPrefProduct(''); setPrefBrand('') }
          }}>
            {FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        {grades.length > 0 && (
          <fieldset className="col-span-2 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-500">Preferred fuel (shown in Fuel Watch)</legend>
            <Field label="Fuel grade">
              <select className="field" value={prefProduct} onChange={(e) => { setPrefProduct(e.target.value); setPrefBrand('') }}>
                <option value="">No preference</option>
                {grades.map((g) => <option key={g} value={g}>{g.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase())}</option>)}
              </select>
            </Field>
            <Field label="Brand">
              <select className="field" value={prefBrand} disabled={!prefProduct} onChange={(e) => setPrefBrand(e.target.value)}>
                <option value="">{prefProduct ? 'Any brand' : 'Pick a grade first'}</option>
                {brandChoices.map((b) => <option key={b} value={b}>{b.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase())}</option>)}
              </select>
            </Field>
          </fieldset>
        )}
        <p className="col-span-2 -mt-1 text-xs text-slate-500" aria-live="polite">
          {codingManual && shownCoding !== autoCoding ? (
            <>Set by you. Your plate{autoCoding === 'Exempt' ? '' : ` would give ${autoCoding}`}. <button type="button" className="font-semibold text-orange-500 underline" onClick={() => setCodingManual(false)}>Use plate rule</button></>
          ) : type === 'motorcycle' ? 'Motorcycles are not number-coded, so this is set to Exempt automatically.'
            : autoCoding === 'Exempt' ? 'Enter your plate number and the coding day fills in from its last digit.'
            : `Filled in from the last digit of your plate (${autoCoding}).`}
        </p>
        {renewal && (
          <p className={`col-span-2 rounded-xl border px-3 py-2 text-xs ${renewal.status === 'overdue' ? 'border-red-500/40 bg-red-500/10 text-red-600' : renewal.status === 'due' || renewal.status === 'soon' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700' : 'border-slate-300 text-slate-600'}`}>
            {renewal.status === 'overdue'
              ? <>Registration looks <b>overdue</b>: it was due by the end of <b>{MONTH_NAMES[renewal.month - 1]} {renewal.deadline.slice(0, 4)}</b> ({-renewal.daysLeft} day{renewal.daysLeft === -1 ? '' : 's'} ago).</>
              : <>Estimated registration deadline: <b>{MONTH_NAMES[renewal.month - 1]} {renewal.deadline.slice(0, 4)}</b> (by {renewal.deadline.slice(5, 7)}/{renewal.deadline.slice(8)}).</>}
            {' '}Based on the plate&rsquo;s last digit; confirm your exact dates with LTO.
          </p>
        )}
        {renewal && (
          <div className="col-span-2 space-y-1">
            <Toggle
              checked={renewal.registered}
              onChange={(on) => setRegisteredFor(on ? renewal.deadline : '')}
              label={`Already registered for ${MONTH_NAMES[renewal.month - 1]} ${renewal.deadline.slice(0, 4)}`}
            />
            <p className="text-xs text-slate-500" aria-live="polite">
              {renewal.registered ? 'The registration reminder is hidden until the next renewal comes round.'
                : markStale ? 'Your plate changed, so the earlier "registered" mark no longer applies to this renewal.'
                : 'Switch on once you have renewed, and the reminder stays quiet until next year.'}
            </p>
          </div>
        )}
        {!item && <p className="col-span-2 text-xs text-slate-500">A tailored {type === 'car' ? 'car/pickup' : 'motorcycle'} maintenance schedule will be added automatically.</p>}
        <button className="btn-primary col-span-2" type="submit">{item ? 'Save changes' : 'Add vehicle'}</button>
      </form>
    </Modal>
  )
}
