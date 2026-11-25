import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (f: string) => fs.readFileSync(`src/${f}.tsx`, 'utf8')

describe('every page shares one design language', () => {
  it('every list page opens with the shared page header', () => {
    for (const f of ['pages', 'pages2', 'SettingsPages']) expect(read(f), f).toMatch(/<PageHeader/)
    // the Garage owns its own header (the vehicle summary), and Fuel Watch leads with the price card
    expect(read('GarageScreen')).toMatch(/VehicleHero/)
  })

  it('lists are one card with hairline dividers, not a card per row', () => {
    for (const f of ['pages', 'pages2']) expect(read(f), f).toMatch(/<ListCard/)
  })

  it('selected states are a soft tint, never a solid brand fill', () => {
    // 'on-brand' (a solid brand background) is for the one primary action, not for choosing between options
    for (const f of ['modals', 'SetupMaintenance', 'FuelWatch', 'pages', 'pages2', 'GarageScreen']) {
      expect(read(f), f).not.toMatch(/on-brand/)
    }
  })

  it('there is no floating Log Fuel button over the lists: the nav and top bar already log fuel', () => {
    expect(read('pages2')).not.toMatch(/LOG FUEL/)
  })

  it('oil companies are not colour-coded: colour in Fuel Watch means "cheapest", nothing else', () => {
    const fw = read('FuelWatch')
    expect(fw).not.toMatch(/BRAND_STYLE/)
    for (const c of ['bg-blue-500', 'bg-yellow-400', 'bg-lime-500', 'bg-sky-500', 'bg-indigo-500', 'bg-teal-500', 'bg-cyan-500']) expect(fw, c).not.toContain(c)
  })

  it('icon-only buttons are the shared quiet 44px button', () => {
    expect(read('pages')).toMatch(/export function IconBtn/)
    expect(read('pages')).toMatch(/h-11 w-11/)
    expect(read('pages2')).toMatch(/IconBtn/)
  })

  it('money and distances use tabular figures wherever a list shows them', () => {
    for (const f of ['pages', 'pages2']) expect(read(f), f).toMatch(/num /)
    expect(read('ui')).toMatch(/Stat/)
  })

  it('long text can break anywhere in a row, so one unbroken word cannot push a row wider than the screen', () => {
    for (const f of ['pages', 'pages2']) expect(read(f), f).toMatch(/overflow-wrap:anywhere/)
  })

  it('a headline figure is never wrapped across two lines', () => {
    expect(read('ui')).toMatch(/whitespace-nowrap[^"]*font-semibold/)
  })
})
