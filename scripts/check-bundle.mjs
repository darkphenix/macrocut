import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distAssets = join(process.cwd(), 'dist', 'assets')

const maxEntryKb = Number(process.env.MAX_ENTRY_KB ?? 260)
const maxCssKb = Number(process.env.MAX_CSS_KB ?? 30)

const files = readdirSync(distAssets)
const entryJs = files.find((name) => /^index-.*\.js$/.test(name))
const entryCss = files.find((name) => /^index-.*\.css$/.test(name))

if (!entryJs || !entryCss) {
  console.error('Impossible de verifier le bundle: fichiers index.* introuvables dans dist/assets.')
  process.exit(1)
}

const jsSizeKb = statSync(join(distAssets, entryJs)).size / 1024
const cssSizeKb = statSync(join(distAssets, entryCss)).size / 1024

console.log(`Bundle entry JS: ${jsSizeKb.toFixed(1)} KB (limite ${maxEntryKb} KB)`)
console.log(`Bundle entry CSS: ${cssSizeKb.toFixed(1)} KB (limite ${maxCssKb} KB)`)

if (jsSizeKb > maxEntryKb || cssSizeKb > maxCssKb) {
  console.error('Budget bundle depasse.')
  process.exit(1)
}

console.log('Budget bundle OK.')
