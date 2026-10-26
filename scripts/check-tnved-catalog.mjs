import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const partsDirectory = path.join(root, 'src', 'data', 'tnved-parts')
const partNames = ['01a.txt', '01b.txt', ...Array.from({ length: 8 }, (_, index) => String(index + 2).padStart(2, '0') + '.txt')]
const parts = partNames.map(name => {
  const file = path.join(partsDirectory, name)
  if (!fs.existsSync(file)) throw new Error(`Missing TN VED data part: ${name}`)
  return fs.readFileSync(file, 'utf8').trim()
})
const base64 = parts.join('')
if (base64.length !== 32836) {
  throw new Error(`TN VED payload length mismatch: expected 32836 characters, got ${base64.length}`)
}

let rows
try {
  rows = JSON.parse(gunzipSync(Buffer.from(base64, 'base64')).toString('utf8'))
} catch (error) {
  throw new Error('TN VED payload is not valid gzip JSON: ' + error.message)
}
if (!Array.isArray(rows)) throw new Error('TN VED payload must be a JSON array')
if (rows.length !== 954) throw new Error(`Expected 954 normalized records, found ${rows.length}`)

const scopeCounts = rows.reduce((result, row) => {
  if (row.t === 'MZKM') result.MZKM += 1
  else if (row.t === 'INTERNAL') result.INTERNAL += 1
  else throw new Error('Unknown catalogue scope: ' + row.t)
  if (!/^\d{10}$/.test(String(row.c))) throw new Error('Invalid ten-digit TN VED code: ' + row.c)
  if (!row.n || !row.g) throw new Error('TN VED row must include product name and group: ' + row.c)
  return result
}, { MZKM: 0, INTERNAL: 0 })

if (scopeCounts.MZKM !== 751) throw new Error(`Expected 751 MZKM records, found ${scopeCounts.MZKM}`)
if (scopeCounts.INTERNAL !== 203) throw new Error(`Expected 203 internal records, found ${scopeCounts.INTERNAL}`)

const count = (scope, group) => rows.filter(row => row.t === scope && row.g === group).length
const requiredGroups = [
  ['MZKM', 'Обувные товары', 61],
  ['MZKM', 'Предметы одежды', 392],
  ['MZKM', 'Молочная продукция', 171],
  ['MZKM', 'Игры и игрушки для детей', 23],
  ['MZKM', 'Бритвы', 4],
  ['INTERNAL', 'Алкоголь', 190],
  ['INTERNAL', 'Табак', 13],
]
for (const [scope, group, expected] of requiredGroups) {
  const actual = count(scope, group)
  if (actual !== expected) throw new Error(`Unexpected count for ${scope} / ${group}: expected ${expected}, found ${actual}`)
}

if (!rows.some(row => row.t === 'INTERNAL' && row.gc && row.gn)) {
  throw new Error('Internal catalogue lost GSKP mapping fields')
}
console.log(`TN VED catalog OK: ${rows.length} records (${scopeCounts.MZKM} MZKM, ${scopeCounts.INTERNAL} internal), 10-digit codes and GSKP links verified.`)
