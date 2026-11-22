import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

// Detect the repo name so assets resolve on GitHub Pages (https://user.github.io/<repo>/).
function repoName(): string {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY.split('/')[1]
  try {
    const url = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const m = url.match(/([^/:]+?)(?:\.git)?$/)
    if (m) return m[1]
  } catch { /* not a git repo */ }
  return path.basename(process.cwd())
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${repoName()}/` : '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      // Version the service-worker cache per build so old caches are dropped on deploy.
      name: 'stamp-sw',
      apply: 'build',
      closeBundle() {
        const f = path.resolve('dist/sw.js')
        if (fs.existsSync(f)) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('__BUILD__', Date.now().toString(36)))
      },
    },
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}))
