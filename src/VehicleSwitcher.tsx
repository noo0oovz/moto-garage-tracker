import { useState } from 'react'
import { Check, ChevronDown, ChevronsUpDown, Plus } from 'lucide-react'
import { VehicleIcon } from './VehicleIcon'
import { Modal } from './ui'
import { useStore } from './store'
import { num } from './logic'

/**
 * The active vehicle as a calm card (icon, name, plate, odometer). Tapping it opens a sheet listing every vehicle, so it
 * scales to three or four vehicles without crowding, unlike a dropdown. `compact` is the slim form for tight headers.
 */
export function VehicleSwitcher({ compact = false, slim = false, onAdd }: { compact?: boolean; /** Plain text only (name and plate with a chevron), for the phone header, where the Garage already shows the full summary. */ slim?: boolean; onAdd: () => void }) {
  const { state, vehicle, setActive } = useStore()
  const [open, setOpen] = useState(false)
  if (!vehicle) return null
  const many = state.vehicles.length > 1

  return (
    <>
      {slim ? (
        // Just who you are looking at: name, plate and a chevron. The Garage header owns the odometer and the rest.
        <button
          type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Active vehicle: ${vehicle.nickname}. ${many ? 'Change vehicle' : 'Vehicle options'}`}
          className="flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full px-1 text-left transition active:opacity-70"
        >
          {/* the name gives way first, so the plate and the chevron are always visible */}
          <span className="min-w-0 truncate text-[17px] font-semibold leading-tight tracking-tight" style={{ maxWidth: '16ch' }}>{vehicle.nickname}</span>
          {vehicle.plate && <span className="num shrink-0 text-[15px]" style={{ color: 'var(--text-2)' }}>· {vehicle.plate}</span>}
          <ChevronDown size={16} className="shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
        </button>
      ) : (
      <button
        type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Active vehicle: ${vehicle.nickname}. ${many ? 'Change vehicle' : 'Vehicle options'}`}
        className={`flex w-full min-w-0 items-center gap-3 text-left transition active:scale-[0.99] ${compact ? 'min-h-11 px-2' : 'min-h-14 px-3 py-2'}`}
        style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-ctl)' }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: 'var(--brand-bg)', color: 'var(--brand)' }}><VehicleIcon v={vehicle} /></span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[15px] font-semibold leading-tight">{vehicle.nickname}</span>
          {!compact && (
            <span className="num block text-xs" style={{ color: 'var(--text-2)' }}>
              {[vehicle.plate, `${num(vehicle.odometer)} km`].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        {many && <ChevronsUpDown size={16} className="shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />}
      </button>
      )}

      {open && (
        <Modal title="Your vehicles" onClose={() => setOpen(false)}>
          <ul className="group-list" role="listbox" aria-label="Vehicles">
            {state.vehicles.map((v) => {
              const active = v.id === vehicle.id
              return (
                <li key={v.id} role="option" aria-selected={active} className="row !p-0">
                  <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
                    onClick={() => { setActive(v.id); setOpen(false) }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: active ? 'var(--brand-bg)' : 'var(--surface-2)', color: active ? 'var(--brand)' : 'var(--text-2)' }}><VehicleIcon v={v} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[15px] font-semibold leading-tight">{v.nickname}</span>
                      <span className="num block text-xs" style={{ color: 'var(--text-2)' }}>{[v.plate, `${num(v.odometer)} km`].filter(Boolean).join(' · ')}</span>
                    </span>
                    {active && <Check size={18} style={{ color: 'var(--brand)' }} aria-label="Selected" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" className="btn-ghost mt-4 w-full" onClick={() => { setOpen(false); onAdd() }}><Plus size={16} /> Add vehicle</button>
        </Modal>
      )}
    </>
  )
}
