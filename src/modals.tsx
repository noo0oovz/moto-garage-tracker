import { useState } from 'react'
import { Modal, Field, Toggle, numVal } from './ui'
import { useStore } from './store'
import { CODING_DAYS, FUEL_TYPES, PART_TYPES } from './data'
import { EXPENSE_CATEGORIES, PART_CONDITIONS, type CodingDay, type ExpenseCategory, type FuelType, type MaintItem, type PartCondition, type Vehicle, type VehicleType } from './types'
import { peso, todayISO } from './logic'

export type ModalState =
  | { kind: 'log'; tab: 'fuel' | 'expense' }
  | { kind: 'service'; item: MaintItem }
  | { kind: 'maint'; item?: MaintItem }
  | { kind: 'vehicle'; item?: Vehicle }
  | { kind: 'part' }
  | null

export function Modals({ modal, close }: { modal: ModalState; close: () => void }) {
  if (!modal) return null
  if (modal.kind === 'part') return <PartModal close={close} />
  if (modal.kind === 'log') return <LogModal initial={modal.tab} close={close} />
  if (modal.kind === 'service') return <ServiceModal item={modal.item} close={close} />
  if (modal.kind === 'maint') return <MaintModal item={modal.item} close={close} />
  return <VehicleModal item={modal.item} close={close} />
}

function LogModal({ initial, close }: { initial: 'fuel' | 'expense'; close: () => void }) {
  const { vehicle, addFuel, addExpense } = useStore()
  const [tab, setTab] = useState(initial)
  const [date, setDate] = useState(todayISO())
  const [odo, setOdo] = useState(String(vehicle?.odometer ?? ''))
  // fuel
  const [liters, setLiters] = useState('')
  const [ppl, setPpl] = useState('')
  const [total, setTotal] = useState('')
  const [station, setStation] = useState('')
  const [full, setFull] = useState(true)
  // expense
  const [cat, setCat] = useState<ExpenseCategory>('PMS & Fluids')
  const [cost, setCost] = useState('')
  const [shop, setShop] = useState('')
  const [notes, setNotes] = useState('')

  if (!vehicle) return null
  const recalc = (l: string, p: string) => {
    const t = numVal(l) * numVal(p)
    setTotal(t > 0 ? t.toFixed(2) : '')
  }
  const odoLow = numVal(odo) > 0 && numVal(odo) < (vehicle?.odometer ?? 0) && date >= todayISO()
  const valid = (tab === 'fuel' ? numVal(liters) > 0 && numVal(total) > 0 && numVal(odo) > 0 : numVal(cost) > 0) && !odoLow

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const odometer = numVal(odo) || undefined
    if (tab === 'fuel') {
      addFuel({
        vehicleId: vehicle.id, date, liters: numVal(liters), pricePerLiter: numVal(ppl) || numVal(total) / numVal(liters),
        totalCost: numVal(total), odometer: numVal(odo), station, fullTank: full,
      })
    } else {
      addExpense({ vehicleId: vehicle.id, date, category: cat, cost: numVal(cost), shopName: shop, notes, odometer })
    }
    close()
  }

  return (
    <Modal title={`Quick Log · ${vehicle.nickname}`} onClose={close}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-black/30">
        {(['fuel', 'expense'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`min-h-11 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'bg-orange-500 text-white shadow' : 'text-slate-500'}`}>
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
          Save {tab === 'fuel' ? `fuel ${numVal(total) ? peso(numVal(total), 2) : ''}` : 'expense'}
        </button>
      </form>
    </Modal>
  )
}

function PartModal({ close }: { close: () => void }) {
  const { vehicle, addPart } = useStore()
  const [partType, setPartType] = useState(PART_TYPES[0])
  const [condition, setCondition] = useState<PartCondition>('Brand New Original')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [shop, setShop] = useState('')
  const [amount, setAmount] = useState('')
  const [km, setKm] = useState(String(vehicle?.odometer ?? ''))
  const [date, setDate] = useState(todayISO())
  const [warranty, setWarranty] = useState('')
  const [notes, setNotes] = useState('')
  if (!vehicle) return null
  return (
    <Modal title="Add Part Replacement" onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          addPart({
            vehicleId: vehicle.id, partType, condition, description, brand, partNumber, shop, amount: numVal(amount),
            installedKm: numVal(km), date, warrantyMonths: numVal(warranty) > 0 ? numVal(warranty) : undefined, notes,
          })
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

function ServiceModal({ item, close }: { item: MaintItem; close: () => void }) {
  const { vehicle, markServiced } = useStore()
  const [date, setDate] = useState(todayISO())
  const [odo, setOdo] = useState(String(vehicle?.odometer ?? item.lastServiceKm))
  const [record, setRecord] = useState(true)
  const [cost, setCost] = useState('')
  const [shop, setShop] = useState('')
  return (
    <Modal title="Mark Serviced" onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
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
  return (
    <Modal title={item ? 'Edit Maintenance Item' : 'Add Maintenance Item'} onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
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

function VehicleModal({ item, close }: { item?: Vehicle; close: () => void }) {
  const { saveVehicle } = useStore()
  const [type, setType] = useState<VehicleType>(item?.type ?? 'car')
  const [nickname, setNickname] = useState(item?.nickname ?? '')
  const [make, setMake] = useState(item?.make ?? '')
  const [model, setModel] = useState(item?.model ?? '')
  const [year, setYear] = useState(String(item?.year ?? new Date().getFullYear()))
  const [plate, setPlate] = useState(item?.plate ?? '')
  const [odo, setOdo] = useState(String(item?.odometer ?? 0))
  const [daily, setDaily] = useState(String(item?.avgDailyKm ?? 30))
  const [coding, setCoding] = useState<CodingDay>(item?.codingDay ?? 'Exempt')
  const [fuel, setFuel] = useState<FuelType>(item?.fuelType ?? 'Gasoline')
  return (
    <Modal title={item ? 'Edit Vehicle' : 'Add Vehicle'} onClose={close}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          saveVehicle({
            id: item?.id, type, nickname: nickname.trim() || `${make} ${model}`.trim() || 'My Vehicle', make, model,
            year: numVal(year), plate, odometer: numVal(odo), avgDailyKm: numVal(daily), codingDay: coding, fuelType: fuel,
          })
          close()
        }}
      >
        {!item && (
          <div className="col-span-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-black/30">
            {(['car', 'motorcycle'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`min-h-11 rounded-lg text-sm font-semibold capitalize ${type === t ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>{t}</button>
            ))}
          </div>
        )}
        <Field label="Nickname" className="col-span-2"><input className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} /></Field>
        <Field label="Make"><input className="field" value={make} onChange={(e) => setMake(e.target.value)} /></Field>
        <Field label="Model"><input className="field" value={model} onChange={(e) => setModel(e.target.value)} /></Field>
        <Field label="Year"><input type="number" inputMode="numeric" className="field" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
        <Field label="Plate Number"><input className="field uppercase" value={plate} onChange={(e) => setPlate(e.target.value)} /></Field>
        <Field label="Odometer (km)"><input type="number" inputMode="numeric" className="field" value={odo} onChange={(e) => setOdo(e.target.value)} /></Field>
        <Field label="Avg Daily Km"><input type="number" inputMode="numeric" className="field" value={daily} onChange={(e) => setDaily(e.target.value)} /></Field>
        <Field label="Coding Day">
          <select className="field" value={coding} onChange={(e) => setCoding(e.target.value as CodingDay)}>
            {CODING_DAYS.map((d) => <option key={d} value={d}>{d === 'Exempt' ? 'Exempt / None' : d}</option>)}
          </select>
        </Field>
        <Field label="Fuel Type">
          <select className="field" value={fuel} onChange={(e) => setFuel(e.target.value as FuelType)}>
            {FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        {!item && <p className="col-span-2 text-xs text-slate-500">A tailored {type === 'car' ? 'car/pickup' : 'motorcycle'} maintenance schedule will be added automatically.</p>}
        <button className="btn-primary col-span-2" type="submit">{item ? 'Save changes' : 'Add vehicle'}</button>
      </form>
    </Modal>
  )
}
