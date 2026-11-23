import { CarFront, Motorbike, Scooter } from 'lucide-react'
import type { Vehicle } from './types'

/**
 * The icon for a vehicle: a car, a scooter (twist-and-go) or a motorcycle (gears). Used everywhere a vehicle is shown,
 * so a motorcycle is never drawn as a pedal bicycle or a car.
 */
export function VehicleIcon({ v, size = 20 }: { v: Pick<Vehicle, 'type'> & Partial<Pick<Vehicle, 'transmission'>>; size?: number }) {
  if (v.type === 'car') return <CarFront size={size} aria-hidden />
  // CVT and automatic motorcycles are scooters; a manual gearbox means a bike with a clutch.
  const scooter = v.transmission === 'cvt' || v.transmission === 'automatic'
  return scooter ? <Scooter size={size} aria-hidden /> : <Motorbike size={size} aria-hidden />
}
