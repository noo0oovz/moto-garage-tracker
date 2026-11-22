# scripts

`import-doe.mjs` — weekly importer for the DOE "Price Monitoring of Liquid Fuels" PDFs. Writes `public/fuel-prices.json`.
Run by `.github/workflows/update-fuel-prices.yml` (Tue/Wed/Fri) or manually: `node scripts/import-doe.mjs`.

`doe-parse.mjs` — PDF parser (pdfjs-dist). It never guesses: each price row is checked against the report's own
"OVERALL RANGE" columns and dropped if it doesn't reconcile.

`week.mjs` — reads the report week ("November 10-16, 2026") out of the PDF text.
`prices-changed.mjs` — exit 3 when only `generatedAt` changed, so the workflow skips no-op commits.

## Coverage
Verified: NCR, South Luzon (Calabarzon, Mimaropa, Bicol), Mindanao (Region IX and others that reconcile).
Not yet: North Luzon and Visayas — their layouts (tighter row spacing; different column positions) fail the checksum,
so those rows are dropped rather than risk showing a wrong price. Add them by extending `parsePage` and
raising a region in `REGIONS` only once its rows reconcile.
