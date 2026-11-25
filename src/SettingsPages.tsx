import { useRef, useState, type ReactNode } from 'react'
import { CalendarClock, ChevronRight, Cog, Download, FileSpreadsheet, Fuel, Gauge, RotateCcw, Upload, Warehouse, Wrench } from 'lucide-react'
import { useStore } from './store'
import { PageHeader, Segmented } from './ui'
import { backupStatus, csvEscape } from './logic'
import type { Page, ThemeMode } from './types'

/** One row of an inset-grouped list: icon tile, title, one muted line, and a chevron. */
export function ListRow({ icon: Icon, title, sub, onClick, danger, trailing }: {
  icon: typeof Download; title: string; sub?: ReactNode; onClick: () => void; danger?: boolean; trailing?: ReactNode
}) {
  return (
    <li className="row !p-0">
      <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={danger ? { background: 'var(--over-bg)', color: 'var(--over)' } : { background: 'var(--surface-2)', color: 'var(--text-2)' }}>
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-tight" style={danger ? { color: 'var(--over)' } : undefined}>{title}</span>
          {sub && <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>{sub}</span>}
        </span>
        {trailing ?? <ChevronRight size={16} style={{ color: 'var(--text-3)' }} aria-hidden />}
      </button>
    </li>
  )
}

/** A titled group: small caps title above, rounded container, optional footnote below (as in iOS Settings). */
export function Group({ title, footnote, children }: { title?: string; footnote?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-1.5 px-4 text-[13px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>{title}</h2>}
      <ul className="group-list">{children}</ul>
      {footnote && <p className="mt-1.5 px-4 text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>{footnote}</p>}
    </section>
  )
}

const APPEARANCE: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
]

export function SettingsPage() {
  const { state, importState, resetDemo, setTheme, markBackedUp } = useStore()
  const backup = backupStatus(state)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  const stamp = new Date().toISOString().slice(0, 10)

  const exportCsv = () => {
    const head = ['Vehicle', 'Date', 'Type', 'Category', 'Shop/Station', 'Details', 'Odometer', 'Liters', 'PricePerLiter', 'FullTank', 'Cost']
    const name = (id: string) => state.vehicles.find((v) => v.id === id)?.nickname ?? ''
    const lines = [
      ...state.fuel.map((f) => [name(f.vehicleId), f.date, 'Fuel', 'Fuel', f.station, '', f.odometer, f.liters, f.pricePerLiter, f.fullTank, f.totalCost]),
      ...state.expenses.map((e) => [name(e.vehicleId), e.date, 'Expense', e.category, e.shopName, e.notes, e.odometer ?? '', '', '', '', e.cost]),
    ].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
    download(`motogarage-logs-${stamp}.csv`, [head, ...lines].map((r) => r.map(csvEscape).join(',')).join('\n'), 'text/csv')
  }

  const onFile = async (f?: File) => {
    if (!f) return
    const ok = importState(await f.text())
    setMsg(ok ? 'Backup imported successfully.' : 'Import failed: not a valid MotoGarage backup.')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="page mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" />
      <Group title="Appearance" footnote="Automatic follows your device: light by day, dark at night.">
        <li className="row">
          <Segmented<ThemeMode> label="Appearance" value={state.theme} onChange={setTheme} options={APPEARANCE} className="w-full" />
        </li>
      </Group>

      <Group title="Data & Backup" footnote={msg ? undefined : 'Your data lives only in this browser. A backup file is how you keep it safe or move it to another device.'}>
        <ListRow icon={Download} title="Export JSON Backup"
          sub={backup.never ? 'Never backed up' : `Last backup ${backup.days === 0 ? 'today' : `${backup.days} day${backup.days === 1 ? '' : 's'} ago`}`}
          onClick={() => { download(`motogarage-backup-${stamp}.json`, JSON.stringify({ ...state, lastBackupAt: new Date().toISOString() }, null, 2), 'application/json'); markBackedUp() }} />
        <ListRow icon={Upload} title="Import JSON Backup" sub="Replaces current data" onClick={() => fileRef.current?.click()} />
        <ListRow icon={FileSpreadsheet} title="Export Logs to CSV" sub="Fuel and expenses, for spreadsheets" onClick={exportCsv} />
      </Group>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {msg && <p role="status" className="px-4 text-[13px] font-medium" style={{ color: 'var(--brand)' }}>{msg}</p>}

      <Group title="Sample data" footnote="Replaces everything you have with two example vehicles, so you can look around. Your own vehicles and logs are erased.">
        <ListRow icon={RotateCcw} danger title="Load sample garage"
          onClick={() => { if (confirm('Replace ALL your data with the sample garage? Your own vehicles and logs will be erased. This cannot be undone.')) { resetDemo(); setMsg('Sample garage loaded.') } }} />
      </Group>

      <p className="num px-2 text-center text-xs" style={{ color: 'var(--text-3)' }}>MotoGarage PH · data schema v{state.version}</p>
    </div>
  )
}

export function MorePage({ go }: { go: (p: Page) => void }) {
  const items: { p: Page; icon: typeof Cog; title: string; sub: string }[] = [
    { p: 'fuelwatch', icon: Gauge, title: 'Fuel Watch', sub: 'PH pump prices by brand, near you' },
    { p: 'fuel', icon: Fuel, title: 'Fuel Logs', sub: 'Fill-ups, litres and km/L' },
    { p: 'history', icon: Wrench, title: 'Service History', sub: 'Timeline of every service' },
    { p: 'parts', icon: Cog, title: 'Parts & Accessories', sub: 'Part records and warranties' },
    { p: 'vehicles', icon: Warehouse, title: 'Vehicles', sub: 'Add, edit, switch or delete' },
    { p: 'settings', icon: CalendarClock, title: 'Settings & Backup', sub: 'Appearance, export, import' },
  ]
  return (
    <div className="page mx-auto max-w-2xl space-y-5">
      <PageHeader title="More" />
      <Group>
        {items.map((i) => <ListRow key={i.p} icon={i.icon} title={i.title} sub={i.sub} onClick={() => go(i.p)} />)}
      </Group>
    </div>
  )
}
