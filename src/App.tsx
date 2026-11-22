import { useEffect, useRef, useState } from 'react'
import {
  Bike, Car, Cog, DatabaseBackup, Fuel, Gauge, History, LayoutDashboard, ListChecks, MoreHorizontal, Moon, Plus, Receipt, Settings, Sun, Wrench,
} from 'lucide-react'
import { useStore } from './store'
import { Modals, type ModalState } from './modals'
import { ChecklistPage, CodingBanner, GaragePage, LogsPage, MorePage, SettingsPage, VehiclesPage } from './pages'
import { FuelPage, HistoryPage, PartsPage } from './pages2'
import { FuelWatchPage } from './FuelWatch'
import { useLayout } from './useLayout'
import type { Page } from './types'
import { backupStatus, num } from './logic'

type NavItem = { page: Page; label: string; icon: typeof Car }
// Phone bottom bar: four destinations plus the centre quick-log button; the rest live under More.
const NAV: NavItem[] = [
  { page: 'garage', label: 'Garage', icon: LayoutDashboard },
  { page: 'logs', label: 'Logs', icon: Receipt },
  { page: 'checklist', label: 'Checklist', icon: ListChecks },
  { page: 'more', label: 'More', icon: MoreHorizontal },
]
// Tablet / compact rails and the desktop sidebar can show every destination.
const ALL: NavItem[] = [
  { page: 'garage', label: 'Garage', icon: LayoutDashboard },
  { page: 'logs', label: 'Logs', icon: Receipt },
  { page: 'fuelwatch', label: 'Fuel Watch', icon: Gauge },
  { page: 'fuel', label: 'Fuel Logs', icon: Fuel },
  { page: 'history', label: 'Service History', icon: History },
  { page: 'parts', label: 'Parts', icon: Cog },
  { page: 'checklist', label: 'Checklist', icon: ListChecks },
  { page: 'vehicles', label: 'Vehicles', icon: Car },
  { page: 'settings', label: 'Settings', icon: Settings },
]
const SHORT_LABEL: Partial<Record<Page, string>> = { fuelwatch: 'Fuel Watch', fuel: 'Fuel Logs', history: 'History', vehicles: 'Vehicles' }
const TITLES: Record<Page, string> = {
  garage: 'Garage', logs: 'Logs & Expenses', checklist: 'Pre-Trip Checklist', more: 'More', vehicles: 'Vehicles', settings: 'Settings',
  fuelwatch: 'Fuel Watch · PH Pump Prices', fuel: 'Fuel Logs', history: 'Service History', parts: 'Parts & Accessories',
}
// One-line bar on a landscape phone: shorter titles so the whole name is always readable.
const COMPACT_TITLES: Partial<Record<Page, string>> = { logs: 'Logs', checklist: 'Checklist', fuelwatch: 'Fuel Watch', history: 'History', parts: 'Parts' }
const MORE_PAGES: Page[] = ['vehicles', 'settings', 'fuel', 'history', 'parts', 'fuelwatch']

export default function App() {
  const { state, vehicle, setActive, toggleTheme } = useStore()
  const layout = useLayout()
  const [page, setPage] = useState<Page>('garage')
  const [modal, setModal] = useState<ModalState>(null)
  const open = (m: ModalState) => setModal(m)
  const close = () => setModal(null)
  const mainRef = useRef<HTMLElement>(null)
  const isActive = (p: Page) => page === p || (p === 'more' && MORE_PAGES.includes(page))
  const go = (p: Page) => setPage(p)

  // A new page starts at the top, and the "More" page is meaningless once every destination has its own button.
  useEffect(() => { window.scrollTo(0, 0) }, [page])
  useEffect(() => { if (layout !== 'phone' && page === 'more') setPage('garage') }, [layout, page])

  const switcher = (cls: string) => (
    <select aria-label="Active vehicle" className={cls} value={vehicle?.id ?? ''} onChange={(e) => setActive(e.target.value)}>
      {state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
    </select>
  )
  const ThemeIcon = state.theme === 'dark' ? Sun : Moon
  const backup = backupStatus(state)
  const phone = layout === 'phone'
  const sidebar = layout === 'desktop'
  const rail = layout === 'tablet' || layout === 'compact'
  const compact = layout === 'compact'

  const backupBanner = backup.due && page !== 'settings' && (
    <div role="status" className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-7xl items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 md:w-[calc(100%-3rem)]">
      <DatabaseBackup size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {backup.never ? 'You haven’t backed up yet.' : `Last backup was ${backup.days} days ago.`} Your data only lives in this browser.
      </span>
      <button className="btn-ghost !min-h-11 shrink-0" onClick={() => go('settings')}>Back up</button>
    </div>
  )

  return (
    <div className="min-h-dvh overflow-x-hidden">
      {/* Desktop sidebar: scrolls by itself when the window is short, so nothing is ever unreachable. */}
      {sidebar && (
        <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col gap-4 overflow-y-auto overscroll-contain border-r border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f1520]">
          <div className="flex items-center gap-2 px-1 text-lg font-extrabold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white"><Wrench size={18} /></span> MotoGarage PH
          </div>
          {vehicle && (
            <div className="space-y-2">
              {switcher('field font-semibold')}
              <CodingBanner v={vehicle} compact />
            </div>
          )}
          <nav className="space-y-1" aria-label="Main">
            {ALL.map((n) => (
              <button key={n.page} onClick={() => go(n.page)} aria-current={page === n.page ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${page === n.page ? 'bg-orange-500/15 text-orange-500' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'}`}>
                <n.icon size={18} /> {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-2">
            <button className="btn-primary w-full" onClick={() => open({ kind: 'log', tab: 'fuel' })}><Fuel size={16} /> Log Fuel</button>
            <button className="btn-ghost w-full" onClick={() => open({ kind: 'log', tab: 'expense' })}><Wrench size={16} /> Log Service</button>
            <button className="btn-ghost w-full" onClick={toggleTheme}><ThemeIcon size={16} /> {state.theme === 'dark' ? 'Light' : 'Dark'} mode</button>
          </div>
        </aside>
      )}

      {/* Tablet / landscape-phone rail: every destination, scrolls when the screen is short. */}
      {rail && (
        <nav aria-label="Main" className={`fixed inset-y-0 left-0 z-30 flex w-20 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f1520] ${compact ? 'py-2' : 'py-3'}`}
          style={{ paddingLeft: 'env(safe-area-inset-left)' }}>
          {!compact && <span className="mb-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500 text-white"><Wrench size={20} /></span>}
          {ALL.map((n) => (
            <button key={n.page} onClick={() => go(n.page)} aria-current={page === n.page ? 'page' : undefined}
              className={`flex min-h-12 w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-semibold leading-tight transition ${page === n.page ? 'bg-orange-500/15 text-orange-500' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
              <n.icon size={20} /> <span className="text-center">{SHORT_LABEL[n.page] ?? n.label}</span>
            </button>
          ))}
          <button onClick={toggleTheme} aria-label="Toggle theme" className="mt-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><ThemeIcon size={20} /></button>
        </nav>
      )}

      <div className={sidebar ? 'pl-64' : rail ? 'pl-20' : ''} style={rail ? { paddingLeft: 'calc(5rem + env(safe-area-inset-left))' } : undefined}>
        {/* Phone header */}
        {phone && (
          <header className="pt-safe sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0b0f17]/90">
            <div className="flex items-center gap-2 px-3 py-2">
              {switcher('field !min-h-11 min-w-0 flex-1 font-semibold')}
              <span className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-orange-500/15 px-3 text-xs font-bold text-orange-500">
                {vehicle?.type === 'motorcycle' ? <Bike size={14} /> : <Car size={14} />}{num(vehicle?.odometer ?? 0)} km
              </span>
              <button onClick={toggleTheme} aria-label="Toggle theme" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5"><ThemeIcon size={18} /></button>
            </div>
          </header>
        )}

        {/* Tablet / compact / desktop top bar. The compact bar is a single slim row. */}
        {!phone && (
          <header className={`sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0b0f17]/90 ${compact ? 'px-3 py-1.5' : 'gap-3 px-6 py-3'}`}>
            <div className="min-w-0 flex-1">
              <h1 className={`font-bold leading-tight ${compact ? 'text-base' : 'text-lg'}`}>{compact ? (COMPACT_TITLES[page] ?? TITLES[page]) : TITLES[page]}</h1>
              {!compact && <p className="text-xs text-slate-500 dark:text-slate-400">{vehicle ? `${vehicle.nickname} · ${num(vehicle.odometer)} km` : ''}</p>}
            </div>
            {!sidebar && switcher(`field min-w-0 shrink font-semibold ${compact ? '!w-40' : '!w-56'}`)}
            <button className="btn-primary" onClick={() => open({ kind: 'log', tab: 'fuel' })}><Plus size={16} /> {compact ? 'Fuel' : 'Log Fuel'}</button>
            <button className="btn-ghost" onClick={() => open({ kind: 'log', tab: 'expense' })}><Plus size={16} /> {compact ? 'Service' : 'Log Service'}</button>
          </header>
        )}

        {backupBanner}
        <main ref={mainRef} className={`mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 ${phone ? 'pb-28' : 'pb-10 md:pt-6'}`}
          style={{ paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          {page === 'garage' && <GaragePage open={open} go={go} />}
          {page === 'logs' && <LogsPage open={open} />}
          {page === 'fuel' && <FuelPage open={open} />}
          {page === 'fuelwatch' && <FuelWatchPage />}
          {page === 'history' && <HistoryPage open={open} />}
          {page === 'parts' && <PartsPage open={open} />}
          {page === 'checklist' && <ChecklistPage />}
          {page === 'more' && <MorePage go={go} />}
          {page === 'vehicles' && <VehiclesPage open={open} />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Phone bottom nav */}
      {phone && (
        <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#0f1520]/95">
          <div className="grid grid-cols-5 items-center">
            {[NAV[0], NAV[1]].map((n) => (
              <button key={n.page} onClick={() => go(n.page)} aria-current={isActive(n.page) ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive(n.page) ? 'text-orange-500' : 'text-slate-500'}`}>
                <n.icon size={20} /> {n.label}
              </button>
            ))}
            <div className="flex justify-center">
              <button onClick={() => open({ kind: 'log', tab: 'fuel' })} aria-label="Quick log" className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/40 transition active:scale-95">
                <Plus size={26} />
              </button>
            </div>
            {[NAV[2], NAV[3]].map((n) => (
              <button key={n.page} onClick={() => go(n.page)} aria-current={isActive(n.page) ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive(n.page) ? 'text-orange-500' : 'text-slate-500'}`}>
                <n.icon size={20} /> {n.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <Modals modal={modal} close={close} />
    </div>
  )
}
