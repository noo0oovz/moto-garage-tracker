import type { AppState } from './types'
import { SCHEMA_VERSION } from './data'

/**
 * Validate and upgrade stored/imported data to the current schema.
 * Returns null when the input isn't a usable MotoGarage state.
 */
export function migrate(raw: unknown, now = new Date()): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<AppState>
  if (!Array.isArray(s.vehicles) || !Array.isArray(s.maint) || !Array.isArray(s.fuel) || !Array.isArray(s.expenses)) return null
  if (s.vehicles.some((v) => !v || typeof v !== 'object' || typeof (v as { id?: unknown }).id !== 'string')) return null
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
    checklist: s.checklist && typeof s.checklist === 'object' ? s.checklist : {},
    activeVehicleId: vehicles.some((v) => v.id === s.activeVehicleId) ? (s.activeVehicleId as string) : (vehicles[0]?.id ?? ''),
    theme: s.theme === 'light' ? 'light' : 'dark',
    installedAt: typeof s.installedAt === 'string' ? s.installedAt : now.toISOString(),
    lastBackupAt: typeof s.lastBackupAt === 'string' ? s.lastBackupAt : undefined,
  }
}
