// Checks every pack in pets/ the way the plugin will: npx tsx scripts/check-pets.ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parsePack } from '../hooks/pack'

const dir = join(import.meta.dirname, '..', 'pets')
let failed = false

for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
  try {
    const pack = parsePack(JSON.parse(readFileSync(join(dir, file), 'utf8')))
    if (`${pack.name}.json` !== file) throw new Error(`name "${pack.name}" must match the file name`)
    console.log(`ok   ${file}`)
  } catch (error) {
    failed = true
    console.log(`FAIL ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

process.exit(failed ? 1 : 0)
