import test from 'node:test'
import assert from 'node:assert/strict'
import {
  convertCsv, createOutputBlob, parseCsv, serializeCsv, validateMarkingCode,
} from './marking-converter.js'

const GS = '\u001D'

test('CSV parser handles commas, semicolons and RFC 4180 escaped quotes', () => {
  const parsed = parseCsv('Код маркировки;Комментарий\r\n"010123456789012321ABC1234' + GS + '930001";"текст; с ""кавычками"""\r\n')
  assert.equal(parsed.rows.length, 2)
  assert.equal(parsed.rows[1][1], 'текст; с "кавычками"')
})

test('validates tobacco consumer and group packaging structures', () => {
  assert.equal(validateMarkingCode('01234567890123SERIAL1CHECK123', 'tobacco', 'individual').valid, true)
  assert.equal(validateMarkingCode('010123456789012321SERIAL1' + GS + '93CHECK123', 'tobacco', 'group').valid, true)
})

test('validates alcohol and beer structures with the specified verification-code lengths', () => {
  const individual = '010123456789012321SERIAL1' + GS + '93AB12'
  const grouped = '010123456789012321SERIAL1234567' + GS + '93AB12'
  assert.equal(validateMarkingCode(individual, 'alcohol', 'individual').valid, true)
  assert.equal(validateMarkingCode(grouped, 'beer', 'group').valid, true)
  assert.equal(validateMarkingCode(individual, 'alcohol', 'group').valid, false)
})

test('trims verification tail and preserves other CSV columns', async () => {
  const source = 'Код маркировки;Примечание\r\n010123456789012321SERIAL1' + GS + '93AB12;строка\r\n'
  const result = await convertCsv({ input: source, mode: 'trim', group: 'alcohol', packaging: 'individual' })
  assert.equal(result.ok, true)
  assert.equal(result.rows[1][0], '010123456789012321SERIAL1')
  assert.equal(result.rows[1][1], 'строка')
})

test('reports invalid code rows and does not create an output file', async () => {
  const result = await convertCsv({ input: 'КМ\nBAD\n', mode: 'trim', group: 'alcohol', packaging: 'individual' })
  assert.equal(result.ok, false)
  assert.equal(result.errors[0].line, 2)
  assert.throws(() => createOutputBlob(result, 'csv'))
})

test('RFC 4180 mode forces quoting of code columns', async () => {
  const source = 'КМ;Примечание\r\n010123456789012321SERIAL1' + '\u001D' + '93AB12;строка\r\n'
  const result = await convertCsv({ input: source, mode: 'addQuotes', group: 'alcohol', packaging: 'individual' })
  assert.equal(result.ok, true)
  const output = serializeCsv(result.rows, result.delimiter, result.forceQuoteColumns)
  assert.match(output, /^КМ;Примечание\r\n"010123456789012321SERIAL1/)
})

test('XLSX export creates an OpenXML zip workbook', async () => {
  const result = await convertCsv({
    input: 'Код маркировки\n010123456789012321SERIAL1\u001D93AB12\n',
    mode: 'trim', group: 'alcohol', packaging: 'individual',
  })
  assert.equal(result.ok, true)
  const blob = createOutputBlob(result, 'xlsx')
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04])
})
