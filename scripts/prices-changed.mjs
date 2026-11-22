// Exit 0 if public/fuel-prices.json differs from the committed one in anything but generatedAt, else exit 3.
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const strip = (s) => { const j = JSON.parse(s); delete j.generatedAt; return JSON.stringify(j) }
let old = ''
try { old = strip(execSync('git show HEAD:public/fuel-prices.json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()) } catch { /* first commit */ }
const cur = strip(fs.readFileSync('public/fuel-prices.json', 'utf8'))
process.exit(old === cur ? 3 : 0)
