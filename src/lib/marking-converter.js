const MAX_CODES = 150000
const MAX_REPORTED_ERRORS = 50
const GS = '\u001D'

export const converterModes = [
  { id: 'trim', label: 'Обрезка криптохвоста', description: 'Удаляет код проверки, сохраняя идентификатор товара и серийный номер.' },
  { id: 'removeQuotes', label: 'Удаление кавычек', description: 'Убирает дополнительное экранирование кавычками из кодов маркировки.' },
  { id: 'addQuotes', label: 'Добавление кавычек', description: 'Формирует CSV с экранированием кодов по RFC 4180.' },
]

export const productGroups = [
  { id: 'tobacco', label: 'Табачная продукция' },
  { id: 'alcohol', label: 'Алкогольная продукция' },
  { id: 'beer', label: 'Пивная продукция' },
]

export const packagingTypes = [
  { id: 'individual', label: 'Единичная упаковка' },
  { id: 'group', label: 'Групповая упаковка' },
]

export function detectDelimiter(input) {
  const firstLine = String(input || '').split(/\r?\n/, 1)[0] || ''
  let quoted = false
  const counts = { ';': 0, ',': 0, '\t': 0 }
  for (let i = 0; i < firstLine.length; i += 1) {
    const char = firstLine[i]
    if (char === '"' && quoted && firstLine[i + 1] === '"') { i += 1; continue }
    if (char === '"') quoted = !quoted
    else if (!quoted && Object.hasOwn(counts, char)) counts[char] += 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ';'
}

export function parseCsv(input, delimiter = detectDelimiter(input)) {
  const source = String(input || '').replace(/^\uFEFF/, '')
  if (!source.trim()) throw new Error('CSV-файл пустой.')

  const rows = []
  const lineNumbers = []
  let row = []
  let field = ''
  let quoted = false
  let line = 1
  let rowStart = 1

  const pushRow = () => {
    row.push(field)
    if (row.some(value => value.trim() !== '')) {
      rows.push(row)
      lineNumbers.push(rowStart)
    }
    row = []
    field = ''
    rowStart = line
  }

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
        if (char === '\n') line += 1
      }
      continue
    }

    if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\r' || char === '\n') {
      pushRow()
      if (char === '\r' && source[i + 1] === '\n') i += 1
      line += 1
      rowStart = line
    } else {
      field += char
    }
  }

  if (quoted) throw new Error('В CSV обнаружена незакрытая кавычка. Проверьте файл и повторите загрузку.')
  if (field.length > 0 || row.length > 0) pushRow()
  if (!rows.length) throw new Error('В CSV-файле не найдены строки с данными.')
  return { rows, lineNumbers, delimiter }
}

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .toLocaleLowerCase('ru-RU')
    .replace(/[\s._-]+/g, '')
    .replace(/[№#]/g, '')
}

const CODE_HEADER_NAMES = new Set([
  'км', 'код', 'кодмаркировки', 'коды', 'кодымаркировки',
  'кодидентификации', 'кодидентификацииединицы', 'datamatrix',
  'gs1datamatrix', 'markingcode', 'markingcodes', 'code',
])

function stripCodeQuotes(value) {
  let result = String(value ?? '').trim()
  if (result.length >= 2 && result.startsWith('"') && result.endsWith('"')) {
    result = result.slice(1, -1).replace(/""/g, '"')
  }
  return result
}

function getCodePattern(group, packaging) {
  if (group === 'tobacco' && packaging === 'individual') {
    return /^(\d{14})([^\u001D\r\n]{7})([^\u001D\r\n]{8})$/
  }
  if (group === 'tobacco' && packaging === 'group') {
    return /^01(\d{14})21([^\u001D\r\n]{7})\u001D93([^\u001D\r\n]{8})$/
  }
  if ((group === 'alcohol' || group === 'beer') && packaging === 'individual') {
    return /^01(\d{14})21([^\u001D\r\n]{7})\u001D93([^\u001D\r\n]{4})$/
  }
  if ((group === 'alcohol' || group === 'beer') && packaging === 'group') {
    return /^01(\d{14})21([^\u001D\r\n]{13})\u001D93([^\u001D\r\n]{4})$/
  }
  throw new Error('Выберите товарную группу и тип упаковки.')
}

export function validateMarkingCode(value, group, packaging) {
  const code = stripCodeQuotes(value)
  const pattern = getCodePattern(group, packaging)
  const match = code.match(pattern)
  if (!match) {
    return { valid: false, code, reason: 'Структура кода не соответствует выбранной товарной группе и типу упаковки.' }
  }

  let identificationCode
  if (group === 'tobacco' && packaging === 'individual') {
    identificationCode = match[1] + match[2]
  } else {
    identificationCode = '01' + match[1] + '21' + match[2]
  }
  return { valid: true, code, identificationCode }
}

function findCodeColumns(rows, group, packaging) {
  const headerIndexes = rows[0]
    .map((value, index) => CODE_HEADER_NAMES.has(normalizeHeader(value)) ? index : -1)
    .filter(index => index >= 0)

  if (headerIndexes.length) return { columns: headerIndexes, hasHeader: true }

  const pattern = getCodePattern(group, packaging)
  const sampleRows = rows.slice(0, 40)
  const columns = []
  const width = Math.max(...sampleRows.map(row => row.length))
  for (let col = 0; col < width; col += 1) {
    if (sampleRows.some(row => row[col] && pattern.test(stripCodeQuotes(row[col])))) columns.push(col)
  }
  if (columns.length) return { columns, hasHeader: false }
  if (rows.every(row => row.length === 1)) return { columns: [0], hasHeader: false }

  const likelyHeaderIndexes = rows[0]
    .map((value, index) => /код|маркиров|datamatrix|км/i.test(String(value)) ? index : -1)
    .filter(index => index >= 0)
  if (likelyHeaderIndexes.length) return { columns: likelyHeaderIndexes, hasHeader: true }
  throw new Error('Не удалось определить столбец с кодами маркировки. Добавьте в заголовок столбца название «Код маркировки» или «КМ».')
}

export async function convertCsv({
  input,
  mode,
  group,
  packaging,
  onProgress = () => {},
}) {
  if (!converterModes.some(item => item.id === mode)) throw new Error('Выберите операцию конвертации.')
  if (!productGroups.some(item => item.id === group)) throw new Error('Выберите товарную группу.')
  if (!packagingTypes.some(item => item.id === packaging)) throw new Error('Выберите тип упаковки.')

  const parsed = parseCsv(input)
  const { columns, hasHeader } = findCodeColumns(parsed.rows, group, packaging)
  const firstDataRow = hasHeader ? 1 : 0
  const outputRows = parsed.rows.map(row => [...row])
  const errors = []
  let processed = 0

  for (let rowIndex = firstDataRow; rowIndex < parsed.rows.length; rowIndex += 1) {
    const row = outputRows[rowIndex]
    for (const colIndex of columns) {
      const original = row[colIndex] ?? ''
      if (!String(original).trim()) continue
      processed += 1
      if (processed > MAX_CODES) {
        throw new Error('В загруженном CSV-файле более 150 000 кодов маркировки. Разделите файл и повторите конвертацию.')
      }

      const validation = validateMarkingCode(original, group, packaging)
      if (!validation.valid) {
        errors.push({
          line: parsed.lineNumbers[rowIndex] || rowIndex + 1,
          code: String(original).slice(0, 90),
          reason: validation.reason,
        })
        if (errors.length > MAX_REPORTED_ERRORS) {
          return {
            ok: false,
            tooManyErrors: true,
            errors: errors.slice(0, MAX_REPORTED_ERRORS),
            count: processed,
            delimiter: parsed.delimiter,
          }
        }
      } else if (mode === 'trim') {
        row[colIndex] = validation.identificationCode
      } else if (mode === 'removeQuotes') {
        row[colIndex] = validation.code
      }
    }
    if (rowIndex % 5000 === 0) {
      onProgress(Math.min(99, Math.round(((rowIndex - firstDataRow + 1) / Math.max(1, parsed.rows.length - firstDataRow)) * 100)))
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  if (errors.length) {
    return {
      ok: false,
      tooManyErrors: false,
      errors,
      count: processed,
      delimiter: parsed.delimiter,
    }
  }

  onProgress(100)
  return {
    ok: true,
    rows: outputRows,
    columns,
    hasHeader,
    count: processed,
    delimiter: parsed.delimiter,
    forceQuoteColumns: mode === 'addQuotes' ? columns : [],
  }
}

export function serializeCsv(rows, delimiter = ';', forceQuoteColumns = [], skipForcedRows = 0) {
  const force = new Set(forceQuoteColumns)
  return rows.map((row, rowIndex) => row.map((value, index) => {
    const text = String(value ?? '')
    const quote = (rowIndex >= skipForcedRows && force.has(index)) || text.includes('"') || text.includes('\r') || text.includes('\n') || text.includes(delimiter)
    return quote ? '"' + text.replace(/"/g, '""') + '"' : text
  }).join(delimiter)).join('\r\n') + '\r\n'
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnName(index) {
  let number = index + 1
  let name = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    number = Math.floor((number - 1) / 26)
  }
  return name
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function zipStore(files) {
  const encoder = new TextEncoder()
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    const checksum = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034B50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, 0, true)
    localView.setUint16(12, 0x0021, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    localParts.push(local)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014B50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, 0, true)
    centralView.setUint16(14, 0x0021, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centralParts.push(central)
    offset += local.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054B50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  endView.setUint16(20, 0, true)
  return new Blob([...localParts, ...centralParts, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function createXlsxBlob(rows) {
  const maxColumns = Math.max(1, ...rows.map(row => row.length))
  if (maxColumns > 16384) throw new Error('В XLSX не может быть более 16 384 столбцов.')
  if (rows.length > 1048576) throw new Error('В XLSX не может быть более 1 048 576 строк.')

  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const address = columnName(colIndex) + (rowIndex + 1)
      const text = xmlEscape(value)
      return '<c r="' + address + '" t="inlineStr"><is><t xml:space="preserve">' + text + '</t></is></c>'
    }).join('')
    return '<row r="' + (rowIndex + 1) + '">' + cells + '</row>'
  }).join('')

  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetData>' + sheetRows + '</sheetData></worksheet>'

  return zipStore([
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '</Types>',
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<sheets><sheet name="Коды" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        + '</Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheet },
  ])
}

export function createOutputBlob(result, format) {
  if (!result?.ok) throw new Error('Нельзя сформировать файл: сначала исправьте ошибки в кодах маркировки.')
  if (format === 'xlsx') return createXlsxBlob(result.rows)
  const content = '\uFEFF' + serializeCsv(result.rows, result.delimiter, result.forceQuoteColumns, result.hasHeader ? 1 : 0)
  return new Blob([content], { type: 'text/csv;charset=utf-8;' })
}

export function outputFileName(originalName, mode, format) {
  const base = String(originalName || 'codes.csv').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_.-]+/gu, '_')
  const suffix = { trim: 'without_crypto_tail', removeQuotes: 'quotes_removed', addQuotes: 'rfc4180' }[mode] || 'converted'
  return base + '_' + suffix + '.' + (format === 'xlsx' ? 'xlsx' : 'csv')
}
