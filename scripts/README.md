# scripts

Data pipeline for Fuel Watch. Everything comes from the Philippine Department of Energy (DOE); no other source
publishes machine-usable pump prices (oil company sites carry no price tables or APIs, and aggregator sites
just republish DOE data under restrictive licences).

## Two DOE feeds, kept separate

| Feed | What it is | Cadence |
|---|---|---|
| Price Monitoring of Liquid Fuels (PDF, per region) | **Measured** prices by city and brand (min–max) | weekly, per region, posted at different times |
| Summary of Prior Notice on Price Adjustments (PDF) | **Announced** change per company and fuel, for the coming week | posted the Monday the week starts |

The app shows the measured price and, when a complete chain of announced changes exists since that measurement,
an **Est. now** price = measured + announced changes. A missing week or a brand that announced nothing means no
estimate — gaps are never bridged. Back-test (NCR, Nov 3–9 measured + Nov 10–16 announced vs. actually measured
Nov 10–16): diesel median error ₱0.25 (99% within ₱3); gasoline median ₱0.75 (82% within ₱3, worst ₱13).

## Files

- `import-doe.mjs` — importer. Writes `public/fuel-prices.json`. Run daily by `.github/workflows/update-fuel-prices.yml`
  or manually: `node scripts/import-doe.mjs`.
- `doe-parse.mjs` — measured-price PDF parser (pdfjs-dist). It never guesses: each price row is checked against the
  report's own "OVERALL RANGE" columns and dropped if it doesn't reconcile.
- `adjust-parse.mjs` — price-adjustment notice parser (Gasoline / Diesel / Kerosene columns by position).
- `week.mjs` — reads a week ("November 10-16, 2026") out of text.
- `prices-changed.mjs` — exit 3 when only `generatedAt` changed, so the workflow skips no-op commits.

## Safety rules

1. A row is kept only if it reconciles with the PDF's own range column.
2. A region is published only if it yields enough verified areas; otherwise its previous data is kept (its own week
   stamp makes the age visible) and the problem is recorded in `problems`.
3. Older data never replaces newer data.
4. Scanned/image-only reports are skipped, never OCR'd — a misread digit would show a wrong price and no checksum
   could catch it.
5. The workflow replaces the data file only if `npm test` passes against it.

## Parser notes (hard-won)

- Price lines are printed 1–2pt off their product label; cells are assigned to the **nearest** product row.
- Prices appear as `72.40`, `65.1 - 66.6` and `79`; one-price rows have a one-number range, which must equal the row.
- Province labels are centred over their group of towns; a town takes the province whose interval contains it.
- Visayas repeats template "ghost" labels (`Boracay`, `Aklan`) at the same coordinates on most later pages; labels
  that repeat on ≥60% of pages (min 3) after page 1 are ignored. Mindanao legitimately repeats multi-line
  province names on a few pages, so the threshold must stay above that.
- Visayas prints "For the week: Tuesday - Monday" with **no dates**; the week comes from the DOE listing label.
- DOE posts the coming week's report early (Mindanao `Nov 17 to 23` appears before Nov 17); reports are picked by
  whether their week has started, never by list position.

## Coverage

Included: NCR, South Luzon (Calabarzon, Mimaropa, Bicol), Visayas, Mindanao.
Not included: **North Luzon** — pages 3–17 of its report are scanned images with no text layer.
