import { useEffect, useRef, useState } from 'react'
import {
  Cog, DatabaseBackup, Fuel, Gauge, History, LayoutDashboard, ListChecks, Monitor, MoreHorizontal, Moon, Plus, Receipt, Settings, Sun, Warehouse, Wrench,
} from 'lucide-react'
import { useStore } from './store'
import { Modals, type ModalState } from './modals'
import { ChecklistPage, LogsPage, VehiclesPage } from './pages'
import { GaragePage } from './GarageScreen'
import { MorePage, SettingsPage } from './SettingsPages'
import { FuelPage, HistoryPage, PartsPage } from './pages2'
import { FuelWatchPage } from './FuelWatch'
import { Welcome } from './Welcome'
import { BrandMark } from './BrandMark'
import { VehicleSwitcher } from './VehicleSwitcher'
import { useLayout } from './useLayout'
import type { Page } from './types'
import { backupStatus } from './logic'
import { THEME_CHOICES } from './theme'

type NavItem = { page: Page; label: string; icon: typeof Cog }
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
  { page: 'vehicles', label: 'Vehicles', icon: Warehouse },
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
  const { state, vehicle, setTheme } = useStore()
  const layout = useLayout()
  const [page, setPage] = useState<Page>('garage')
  const [modal, setModal] = useState<ModalState>(null)
  const open = (m: ModalState) => setModal(m)
  const close = () => setModal(null)
  const mainRef = useRef<HTMLElement>(null)
  const isActive = (p: Page) => page === p || (p === 'more' && MORE_PAGES.includes(page))
  const go = (p: Page) => setPage(p)
  // First-time users start with no vehicle. Pages that need one show a welcome instead, and the "Log" buttons become "Add vehicle".
  const empty = state.vehicles.length === 0
  const addVehicle = () => open({ kind: 'vehicle' })
  const NEEDS_VEHICLE: Page[] = ['garage', 'logs', 'fuel', 'history', 'parts', 'checklist']

  // A new page starts at the top, and the "More" page is meaningless once every destination has its own button.
  useEffect(() => { window.scrollTo(0, 0) }, [page])
  useEffect(() => { if (layout !== 'phone' && page === 'more') setPage('garage') }, [layout, page])

  // The quick theme button steps Automatic -> Light -> Dark. The icon shows the CURRENT choice, so "automatic" is visible.
  const ThemeIcon = state.theme === 'system' ? Monitor : state.theme === 'dark' ? Moon : Sun
  const nextTheme = THEME_CHOICES[(THEME_CHOICES.indexOf(state.theme) + 1) % THEME_CHOICES.length]
  const themeName = state.theme === 'system' ? 'Automatic' : state.theme === 'dark' ? 'Dark' : 'Light'
  const themeLabel = `Appearance: ${themeName.toLowerCase()}. Switch to ${nextTheme === 'system' ? 'automatic' : nextTheme}`
  const cycleTheme = () => setTheme(nextTheme)
  const backup = backupStatus(state)
  const phone = layout === 'phone'
  const sidebar = layout === 'desktop'
  const rail = layout === 'tablet' || layout === 'compact'
  const compact = layout === 'compact'

  // Nothing to lose until the user has added a vehicle, so an empty garage never nags about backups.
  const backupBanner = backup.due && !empty && page !== 'settings' && (
    <div role="status" className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-7xl items-center gap-3 px-4 py-3 text-sm md:w-[calc(100%-3rem)]"
      style={{ background: 'var(--soon-bg)', color: 'var(--soon)', borderRadius: 'var(--r-card)' }}>
      <DatabaseBackup size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {backup.never ? 'You haven’t backed up yet.' : `Last backup was ${backup.days} days ago.`} Your data only lives in this browser.
      </span>
      <button className="btn-ghost !min-h-11 shrink-0" style={{ color: 'inherit' }} onClick={() => go('settings')}>Back up</button>
    </div>
  )

  const themeButton = (cls: string) => (
    <button onClick={cycleTheme} aria-label={themeLabel} title={themeLabel} className={cls} style={{ color: 'var(--text-2)' }}><ThemeIcon size={18} /></button>
  )
  const brandMark = (size: number) => <BrandMark size={size} />
  // Neutral navigation: only the active item carries the brand colour.
  const navClass = (active: boolean) => `transition ${active ? '' : 'hover:bg-[var(--surface-2)]'}`
  const navStyle = (active: boolean) => (active ? { background: 'var(--brand-bg)', color: 'var(--brand)' } : { color: 'var(--text-2)' })
  // Translucent, hairline-edged bars (as on iOS), not coloured ones.
  const barStyle = { background: 'color-mix(in srgb, var(--surface) 82%, transparent)', borderColor: 'var(--hairline)' }

  return (
    <div className="min-h-dvh overflow-x-hidden">
      {/* Desktop sidebar: scrolls by itself when the window is short, so nothing is ever unreachable. */}
      {sidebar && (
        <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col gap-5 overflow-y-auto overscroll-contain border-r p-4" style={{ ...barStyle, background: 'var(--surface)' }}>
          <div className="flex items-center gap-2.5 px-1 text-[17px] font-semibold tracking-tight">{brandMark(32)} MotoGarage PH</div>
          {vehicle && <VehicleSwitcher onAdd={addVehicle} />}
          <nav className="space-y-0.5" aria-label="Main">
            {ALL.map((n) => (
              <button key={n.page} onClick={() => go(n.page)} aria-current={page === n.page ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 px-3 text-[15px] font-medium ${navClass(page === n.page)}`} style={{ ...navStyle(page === n.page), borderRadius: 'var(--r-ctl)' }}>
                <n.icon size={18} /> {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-2">
            {empty ? (
              <button className="btn-primary w-full" onClick={addVehicle}><Plus size={16} /> Add vehicle</button>
            ) : (
              <>
                <button className="btn-primary w-full" onClick={() => open({ kind: 'log', tab: 'fuel' })}><Fuel size={16} /> Log Fuel</button>
                <button className="btn-ghost w-full" onClick={() => open({ kind: 'log', tab: 'expense' })}><Wrench size={16} /> Log Service</button>
              </>
            )}
            <button className="btn-ghost w-full" onClick={cycleTheme} aria-label={themeLabel}><ThemeIcon size={16} /> {themeName} appearance</button>
          </div>
        </aside>
      )}

      {/* Tablet / landscape-phone rail: every destination, scrolls when the screen is short. */}
      {rail && (
        <nav aria-label="Main" className={`fixed inset-y-0 left-0 z-30 flex w-20 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-r ${compact ? 'py-2' : 'py-3'}`}
          style={{ ...barStyle, background: 'var(--surface)', paddingLeft: 'env(safe-area-inset-left)' }}>
          {!compact && <span className="mb-2 shrink-0">{brandMark(40)}</span>}
          {ALL.map((n) => (
            <button key={n.page} onClick={() => go(n.page)} aria-current={page === n.page ? 'page' : undefined}
              className={`flex min-h-12 w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium leading-tight ${navClass(page === n.page)}`} style={{ ...navStyle(page === n.page), borderRadius: 'var(--r-ctl)' }}>
              <n.icon size={20} /> <span className="text-center">{SHORT_LABEL[n.page] ?? n.label}</span>
            </button>
          ))}
          {themeButton('mt-auto grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--surface-2)]')}
        </nav>
      )}

      <div className={sidebar ? 'pl-64' : rail ? 'pl-20' : ''} style={rail ? { paddingLeft: 'calc(5rem + env(safe-area-inset-left))' } : undefined}>
        {/* Phone header: the vehicle card is the whole header. */}
        {phone && (
          <header className="pt-safe sticky top-0 z-20 border-b backdrop-blur-xl" style={barStyle}>
            <div className="flex items-center gap-2 px-4 py-2">
              {empty ? (
                <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-[17px] font-semibold tracking-tight">{brandMark(32)} MotoGarage PH</span>
              ) : (
                <div className="min-w-0 flex-1"><VehicleSwitcher onAdd={addVehicle} /></div>
              )}
              {themeButton('grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--surface-2)]')}
            </div>
          </header>
        )}

        {/* Tablet / compact / desktop top bar. The compact bar is a single slim row. */}
        {!phone && (
          <header className={`sticky top-0 z-20 flex items-center gap-3 border-b backdrop-blur-xl ${compact ? 'px-4 py-1.5' : 'px-6 py-3'}`} style={barStyle}>
            <div className="min-w-0 flex-1">
              <h1 className={`font-bold leading-tight tracking-tight ${compact ? 'text-base' : 'text-[22px]'}`}>{compact ? (COMPACT_TITLES[page] ?? TITLES[page]) : TITLES[page]}</h1>
            </div>
            {empty ? (
              <button className="btn-primary" onClick={addVehicle}><Plus size={16} /> Add vehicle</button>
            ) : (
              <>
                {!sidebar && <div className={compact ? 'w-44' : 'w-64'}><VehicleSwitcher compact onAdd={addVehicle} /></div>}
                <button className="btn-primary" onClick={() => open({ kind: 'log', tab: 'fuel' })}><Plus size={16} /> {compact ? 'Fuel' : 'Log Fuel'}</button>
                <button className="btn-ghost" onClick={() => open({ kind: 'log', tab: 'expense' })}><Plus size={16} /> {compact ? 'Service' : 'Log Service'}</button>
              </>
            )}
          </header>
        )}

        {backupBanner}
        <main ref={mainRef} className={`mx-auto w-full max-w-7xl px-4 pt-5 md:px-6 ${phone ? 'pb-28' : 'pb-10 md:pt-6'}`}
          style={{ paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          {empty && NEEDS_VEHICLE.includes(page) && <Welcome onAdd={addVehicle} go={go} page={page} />}
          {!empty && page === 'garage' && <GaragePage open={open} go={go} />}
          {!empty && page === 'logs' && <LogsPage open={open} />}
          {!empty && page === 'fuel' && <FuelPage open={open} />}
          {page === 'fuelwatch' && <FuelWatchPage />}
          {!empty && page === 'history' && <HistoryPage open={open} />}
          {!empty && page === 'parts' && <PartsPage open={open} />}
          {!empty && page === 'checklist' && <ChecklistPage />}
          {page === 'more' && <MorePage go={go} />}
          {page === 'vehicles' && <VehiclesPage open={open} />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Phone bottom nav: translucent tab bar; the centre button is the single quick action. */}
      {phone && (
        <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-xl" style={barStyle}>
          <div className="grid grid-cols-5 items-center">
            {[NAV[0], NAV[1]].map((n) => (
              <button key={n.page} onClick={() => go(n.page)} aria-current={isActive(n.page) ? 'page' : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium" style={{ color: isActive(n.page) ? 'var(--brand)' : 'var(--text-2)' }}>
                <n.icon size={22} /> {n.label}
              </button>
            ))}
            <div className="flex justify-center">
              <button onClick={() => (empty ? addVehicle() : open({ kind: 'log', tab: 'fuel' }))} aria-label={empty ? 'Add vehicle' : 'Quick log'}
                className="-mt-5 grid h-14 w-14 place-items-center rounded-full transition active:scale-95" style={{ background: 'var(--brand)', color: 'var(--brand-on)', boxShadow: '0 4px 14px color-mix(in srgb, var(--brand) 35%, transparent)' }}>
                <Plus size={26} />
              </button>
            </div>
            {[NAV[2], NAV[3]].map((n) => (
              <button key={n.page} onClick={() => go(n.page)} aria-current={isActive(n.page) ? 'page' : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium" style={{ color: isActive(n.page) ? 'var(--brand)' : 'var(--text-2)' }}>
                <n.icon size={22} /> {n.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <Modals modal={modal} close={close} openModal={setModal} />
    </div>
  )
}
