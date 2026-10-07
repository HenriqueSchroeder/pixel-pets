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

// The config's picker lists every shipped pet, and `custom` for the person's own.
const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'))
const picker: string[] = manifest.userConfig.pet.options
const shipped = readdirSync(dir).filter(name => name.endsWith('.json')).map(name => name.slice(0, -'.json'.length))
if (shipped.includes('custom')) {
  failed = true
  console.log('FAIL custom.json: "custom" is the picker\'s own choice for a pack of your own; name the pet otherwise')
}
for (const name of shipped.filter(one => !picker.includes(one))) {
  failed = true
  console.log(`FAIL ${name}.json: add "${name}" to the pet option's options in .claude-plugin/plugin.json`)
}
for (const name of picker.filter(one => one !== 'custom' && !shipped.includes(one))) {
  failed = true
  console.log(`FAIL plugin.json: the pet option offers "${name}", but there is no pets/${name}.json`)
}

process.exit(failed ? 1 : 0)
