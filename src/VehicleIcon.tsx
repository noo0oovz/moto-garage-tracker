import { CarFront, Motorbike, Scooter } from 'lucide-react'
import type { Vehicle } from './types'

/**
 * The icon for a vehicle: a car, a scooter (twist-and-go) or a motorcycle (gears). Used everywhere a vehicle is shown,
 * so a motorcycle is never drawn as a pedal bicycle or a car.
 */
export function VehicleIcon({ v, size = 20 }: { v: Pick<Vehicle, 'type'> & Partial<Pick<Vehicle, 'transmission' | 'bikeType'>>; size?: number }) {
  if (v.type === 'car') return <CarFront size={size} aria-hidden />
  // The owner's chosen bike type decides. Bikes saved before that question fall back on the gearbox: CVT/automatic is a
  // scooter, a manual gearbox is a bike with a clutch. (Same rule as the large illustration, so the two never disagree.)
  const scooter = v.bikeType ? v.bikeType === 'scooter' : v.transmission === 'cvt' || v.transmission === 'automatic'
  return scooter ? <Scooter size={size} aria-hidden /> : <Motorbike size={size} aria-hidden />
}
