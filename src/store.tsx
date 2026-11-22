import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppState, Expense, FuelLog, MaintItem, PartRecord, ServiceRecord, Vehicle } from './types'
import { SCHEMA_VERSION, STORAGE_KEY, buildDemoState, buildMaintenance } from './data'
import { todayISO, uid } from './logic'

function migrate(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<AppState>
  if (!Array.isArray(s.vehicles) || !Array.isArray(s.maint) || !Array.isArray(s.fuel) || !Array.isArray(s.expenses)) return null
  // Future schema migrations hook in here keyed on s.version.
  const vehicles = s.vehicles
  return {
    version: SCHEMA_VERSION,
    vehicles,
    maint: s.maint,
    fuel: s.fuel,
    expenses: s.expenses,
    // v1 -> v2: service history and parts ledger were added.
    services: Array.isArray(s.services) ? s.services : [],
    parts: Array.isArray(s.parts) ? s.parts : [],
    checklist: s.checklist ?? {},
    activeVehicleId: vehicles.some((v) => v.id === s.activeVehicleId) ? (s.activeVehicleId as string) : (vehicles[0]?.id ?? ''),
    theme: s.theme === 'light' ? 'light' : 'dark',
  }
}

function load(): AppState {
  try {
    const txt = localStorage.getItem(STORAGE_KEY)
    if (txt) {
      const s = migrate(JSON.parse(txt))
      if (s) return s
    }
  } catch { /* fall through to demo */ }
  return buildDemoState(todayISO())
}

export interface ServicePayload {
  date: string
  odometer: number
  cost?: number
  shopName?: string
  notes?: string
}

interface Store {
  state: AppState
  vehicle: Vehicle | undefined
  setActive: (id: string) => void
  toggleTheme: () => void
  saveVehicle: (v: Omit<Vehicle, 'id'> & { id?: string }) => void
  deleteVehicle: (id: string) => void
  saveMaint: (m: Omit<MaintItem, 'id'> & { id?: string }) => void
  deleteMaint: (id: string) => void
  markServiced: (id: string, p: ServicePayload) => void
  deleteService: (id: string) => void
  addPart: (p: Omit<PartRecord, 'id'>) => void
  deletePart: (id: string) => void
  addFuel: (f: Omit<FuelLog, 'id'>) => void
  addExpense: (e: Omit<Expense, 'id'>) => void
  deleteLog: (kind: 'fuel' | 'expense', id: string) => void
  toggleCheck: (vehicleId: string, key: string) => void
  resetChecklist: (vehicleId: string) => void
  importState: (json: string) => boolean
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota/private mode */ }
    const light = state.theme === 'light'
    document.documentElement.classList.toggle('dark', !light)
    document.documentElement.style.colorScheme = light ? 'light' : 'dark'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f4f6fa' : '#0b0f17')
  }, [state])

  const bumpOdo = (vehicles: Vehicle[], id: string, odo?: number) =>
    odo ? vehicles.map((v) => (v.id === id && odo > v.odometer ? { ...v, odometer: odo } : v)) : vehicles

  const api = useMemo<Omit<Store, 'state' | 'vehicle'>>(() => ({
    setActive: (id) => setState((s) => ({ ...s, activeVehicleId: id })),
    toggleTheme: () => setState((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
    saveVehicle: (v) => setState((s) => {
      if (v.id) return { ...s, vehicles: s.vehicles.map((x) => (x.id === v.id ? ({ ...v, id: v.id } as Vehicle) : x)) }
      const id = uid()
      const nv: Vehicle = { ...v, id }
      return {
        ...s,
        vehicles: [...s.vehicles, nv],
        maint: [...s.maint, ...buildMaintenance(id, nv.type, nv.odometer, todayISO())],
        activeVehicleId: id,
      }
    }),
    deleteVehicle: (id) => setState((s) => {
      const vehicles = s.vehicles.filter((v) => v.id !== id)
      return {
        ...s,
        vehicles,
        maint: s.maint.filter((m) => m.vehicleId !== id),
        fuel: s.fuel.filter((m) => m.vehicleId !== id),
        expenses: s.expenses.filter((m) => m.vehicleId !== id),
        services: s.services.filter((m) => m.vehicleId !== id),
        parts: s.parts.filter((m) => m.vehicleId !== id),
        activeVehicleId: s.activeVehicleId === id ? (vehicles[0]?.id ?? '') : s.activeVehicleId,
      }
    }),
    saveMaint: (m) => setState((s) =>
      m.id
        ? { ...s, maint: s.maint.map((x) => (x.id === m.id ? ({ ...m, id: m.id } as MaintItem) : x)) }
        : { ...s, maint: [...s.maint, { ...m, id: uid() }] }),
    deleteMaint: (id) => setState((s) => ({ ...s, maint: s.maint.filter((m) => m.id !== id) })),
    markServiced: (id, p) => setState((s) => {
      const item = s.maint.find((m) => m.id === id)
      if (!item) return s
      const maint = s.maint.map((m) => (m.id === id ? { ...m, lastServiceKm: p.odometer, lastServiceDate: p.date } : m))
      const recId = uid()
      const record: ServiceRecord = {
        id: recId, vehicleId: item.vehicleId, maintItemId: id, name: item.name, date: p.date, odometer: p.odometer,
        cost: p.cost && p.cost > 0 ? p.cost : undefined, shopName: p.shopName, notes: p.notes,
      }
      const expenses = record.cost
        ? [...s.expenses, {
            id: uid(), vehicleId: item.vehicleId, date: p.date, category: 'PMS & Fluids' as const, cost: record.cost,
            shopName: p.shopName ?? '', notes: item.name, odometer: p.odometer, sourceId: recId,
          }]
        : s.expenses
      return { ...s, maint, expenses, services: [...s.services, record], vehicles: bumpOdo(s.vehicles, item.vehicleId, p.odometer) }
    }),
    deleteService: (id) => setState((s) => ({
      ...s, services: s.services.filter((x) => x.id !== id), expenses: s.expenses.filter((e) => e.sourceId !== id),
    })),
    addPart: (p) => setState((s) => {
      const id = uid()
      const expense: Expense = {
        id: uid(), vehicleId: p.vehicleId, date: p.date, category: 'Wear & Tear Parts', cost: p.amount,
        shopName: p.shop, notes: `${p.partType}${p.brand ? ` (${p.brand})` : ''}`, odometer: p.installedKm, sourceId: id,
      }
      return {
        ...s, parts: [...s.parts, { ...p, id }], expenses: p.amount > 0 ? [...s.expenses, expense] : s.expenses,
        vehicles: bumpOdo(s.vehicles, p.vehicleId, p.installedKm),
      }
    }),
    deletePart: (id) => setState((s) => ({
      ...s, parts: s.parts.filter((x) => x.id !== id), expenses: s.expenses.filter((e) => e.sourceId !== id),
    })),
    addFuel: (f) => setState((s) => ({
      ...s, fuel: [...s.fuel, { ...f, id: uid() }], vehicles: bumpOdo(s.vehicles, f.vehicleId, f.odometer),
    })),
    addExpense: (e) => setState((s) => ({
      ...s, expenses: [...s.expenses, { ...e, id: uid() }], vehicles: bumpOdo(s.vehicles, e.vehicleId, e.odometer),
    })),
    deleteLog: (kind, id) => setState((s) =>
      kind === 'fuel' ? { ...s, fuel: s.fuel.filter((x) => x.id !== id) } : { ...s, expenses: s.expenses.filter((x) => x.id !== id) }),
    toggleCheck: (vid, key) => setState((s) => {
      const cur = s.checklist[vid] ?? []
      return { ...s, checklist: { ...s.checklist, [vid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] } }
    }),
    resetChecklist: (vid) => setState((s) => ({ ...s, checklist: { ...s.checklist, [vid]: [] } })),
    importState: (json) => {
      try {
        const next = migrate(JSON.parse(json))
        if (!next) return false
        setState(next)
        return true
      } catch { return false }
    },
    resetDemo: () => setState(buildDemoState(todayISO())),
  }), [])

  const setActive = useCallback(api.setActive, [api])
  const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId) ?? state.vehicles[0]
  const value = useMemo(() => ({ ...api, setActive, state, vehicle }), [api, setActive, state, vehicle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('StoreProvider missing')
  return c
}
