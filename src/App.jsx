import { useEffect, useMemo, useRef, useState } from 'react'
import { API_ENABLED, API_BASE, apiRequest, clearStoredToken, getStoredToken, storeToken } from './lib/api.js'
import { loadTnvedCatalog } from './data/tnved-catalog.js'
import {
  ArrowDownRight, ArrowUpRight, BookOpen, Boxes, CalendarDays, ChevronDown,
  CircleHelp, ExternalLink, FileCheck2, FilePlus2, FileText, Globe2, Home,
  Landmark, Layers3, LibraryBig, Link2, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Bot, Send, Workflow, X, Pencil, Trash2, RefreshCw, UsersRound, LogOut, Paperclip, Download, History, CheckCircle2, UserPlus, Moon, Sun, Copy, ListTree, Clock3, Printer
} from 'lucide-react'

const demoDocuments = [
  { id: 'demo-1', title: 'Нормативная база маркировки товаров в Российской Федерации', kind: 'Обзор', jurisdiction: 'RU', area: 'Нормативная база', description: 'Демонстрационная карточка для подборки нормативных документов РФ и материалов системы «Честный ЗНАК».', status: 'Демонстрационная запись', isDemo: true },
  { id: 'demo-2', title: 'Нормативные документы Кыргызской Республики по маркировке', kind: 'Обзор', jurisdiction: 'KG', area: 'Нормативная база', description: 'Демонстрационная карточка для законов, постановлений и положений национальной системы маркировки.', status: 'Демонстрационная запись', isDemo: true },
  { id: 'demo-3', title: 'Наднациональные документы ЕАЭС', kind: 'Обзор', jurisdiction: 'EAEU', area: 'Нормативная база', description: 'Демонстрационная карточка для соглашений и решений ЕАЭС, применимых к маркировке и трансграничному взаимодействию.', status: 'Демонстрационная запись', isDemo: true },
  { id: 'demo-4', title: 'Инструкция по работе с карточками товаров в МЗКМ', kind: 'Инструкция', jurisdiction: 'RU', area: 'Карточки товаров', description: 'Пример категории для проверенных инструкций, связанных с внешним контуром МЗКМ.', status: 'Демонстрационная запись', isDemo: true },
  { id: 'demo-5', title: 'Порядок работы с ГАИС МТ', kind: 'Внутренний документ', jurisdiction: 'KG', area: 'ГАИС МТ', description: 'Пример категории для внутренних регламентов и инструкций национальной системы.', status: 'Демонстрационная запись', isDemo: true },
]

const jurisdictions = {
  RU: { label: 'Российская Федерация', short: 'РФ', className: 'ru', flag: '🇷🇺' },
  KG: { label: 'Кыргызская Республика', short: 'КР', className: 'kg', flag: '🇰🇬' },
  EAEU: { label: 'Евразийский экономический союз', short: 'ЕАЭС', className: 'eaeu', flag: '🌐' },
}

function isMzkmCatalogDocument(doc) {
  const area = String(doc?.area || '').trim().toLocaleLowerCase('ru-RU')
  const productGroup = String(doc?.productGroup || '').trim().toLocaleLowerCase('ru-RU')
  return area.startsWith('мзкм /')
    || /внешн(?:яя|ие|юю)\s+(?:маркировка|товарные группы).*мзкм/.test(productGroup)
}

const navGroups = [
  { title: 'ПЛАТФОРМА', items: [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'assistant', label: 'ИИ-помощник', icon: Bot },
    { id: 'documents', label: 'Все документы', icon: LibraryBig },
  ]},
  { title: 'ЮРИСДИКЦИИ', items: [
    { id: 'RU', label: 'МЗКМ · РФ', icon: Landmark },
    { id: 'KG', label: 'ГАИС МТ · КР', icon: ShieldCheck },
    { id: 'EAEU', label: 'ЕАЭС', icon: Globe2 },
  ]},
  { title: 'СПРАВОЧНИКИ', items: [
    { id: 'groups', label: 'Товарные группы', icon: Boxes },
    { id: 'processes', label: 'Бизнес-процессы', icon: Workflow },
    { id: 'knowledge', label: 'Инструкции и база знаний', icon: BookOpen },
  ]},
  { title: 'АДМИНИСТРИРОВАНИЕ', items: [
    { id: 'monitoring', label: 'Источники и проверки', icon: RefreshCw },
    { id: 'users', label: 'Пользователи', icon: UsersRound },
  ]},
]

const STORAGE_KEY = 'teksher-hub-user-documents'
const THEME_STORAGE_KEY = 'teksher-hub-theme'

function loadTheme() {
  try { return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

function loadUserDocuments() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const ATTACHMENTS_DB_NAME = 'teksher-hub-attachments'
const ATTACHMENTS_STORE_NAME = 'attachments'

function openLocalAttachmentsDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Браузер не поддерживает локальное хранилище файлов.'))
      return
    }
    const request = window.indexedDB.open(ATTACHMENTS_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ATTACHMENTS_STORE_NAME)) {
        const store = db.createObjectStore(ATTACHMENTS_STORE_NAME, { keyPath: 'id' })
        store.createIndex('documentId', 'documentId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Не удалось открыть локальное хранилище файлов.'))
    request.onblocked = () => reject(new Error('Локальное хранилище файлов заблокировано другой вкладкой.'))
  })
}

async function saveLocalAttachment(documentId, file) {
  const db = await openLocalAttachmentsDb()
  const row = {
    id: 'local-' + String(documentId) + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    documentId: String(documentId),
    originalName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'Этот браузер',
    textExtractionStatus: 'NOT_INDEXED',
    textExtractionNote: 'Файл хранится локально в этом браузере. Серверная индексация и поиск по содержимому недоступны в демо-режиме.',
    localAttachment: true,
    blob: file,
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ATTACHMENTS_STORE_NAME, 'readwrite')
    transaction.objectStore(ATTACHMENTS_STORE_NAME).put(row)
    transaction.oncomplete = () => {
      db.close()
      const { blob, ...metadata } = row
      resolve(metadata)
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('Не удалось сохранить файл в браузере.'))
    }
    transaction.onabort = () => {
      db.close()
      reject(transaction.error || new Error('Сохранение файла было отменено.'))
    }
  })
}

async function loadLocalAttachments(documentId) {
  const db = await openLocalAttachmentsDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ATTACHMENTS_STORE_NAME, 'readonly')
    const request = transaction.objectStore(ATTACHMENTS_STORE_NAME).index('documentId').getAll(String(documentId))
    request.onsuccess = () => {
      const rows = request.result
        .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
        .map(({ blob, ...metadata }) => metadata)
      resolve(rows)
    }
    request.onerror = () => reject(request.error || new Error('Не удалось прочитать локальные вложения.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('Не удалось прочитать локальные вложения.'))
    }
  })
}

async function readLocalAttachment(id) {
  const db = await openLocalAttachmentsDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ATTACHMENTS_STORE_NAME, 'readonly')
    const request = transaction.objectStore(ATTACHMENTS_STORE_NAME).get(String(id))
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Не удалось открыть локальное вложение.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('Не удалось открыть локальное вложение.'))
    }
  })
}

const csvImportFields = [
  { key: 'title', header: 'Название', aliases: ['title', 'название', 'наименование'], required: true },
  { key: 'jurisdiction', header: 'Юрисдикция', aliases: ['jurisdiction', 'юрисдикция', 'контур'], required: true },
  { key: 'kind', header: 'Тип материала', aliases: ['kind', 'тип', 'типматериала', 'тип материала'], required: true },
  { key: 'area', header: 'Тематическая область', aliases: ['area', 'тема', 'область', 'тематическая область'], required: true },
  { key: 'productGroup', header: 'Товарная группа', aliases: ['productGroup', 'product_group', 'товарная группа'] },
  { key: 'keywords', header: 'Ключевые слова', aliases: ['keywords', 'ключевые слова', 'теги'] },
  { key: 'documentNumber', header: 'Номер документа', aliases: ['documentNumber', 'document_number', 'номер документа', 'номер'] },
  { key: 'documentDate', header: 'Дата документа', aliases: ['documentDate', 'document_date', 'дата документа'] },
  { key: 'effectiveFrom', header: 'Действует с', aliases: ['effectiveFrom', 'effective_from', 'действует с'] },
  { key: 'effectiveUntil', header: 'Действует по', aliases: ['effectiveUntil', 'effective_until', 'действует по'] },
  { key: 'sourceUrl', header: 'Официальный источник', aliases: ['sourceUrl', 'source_url', 'официальный источник', 'ссылка на источник', 'источник'] },
  { key: 'description', header: 'Описание', aliases: ['description', 'описание', 'краткое описание'], required: true },
  { key: 'content', header: 'Содержание', aliases: ['content', 'содержание', 'полный текст', 'текст материала', 'инструкция'] },
]

function normalizeCsvHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim().toLocaleLowerCase('ru-RU').replace(/[\s._-]+/g, '')
}

function detectCsvDelimiter(text) {
  const firstLine = String(text).split(/\r?\n/, 1)[0] || ''
  let quoted = false
  let commas = 0
  let semicolons = 0
  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i]
    if (char === '"' && quoted && firstLine[i + 1] === '"') { i++; continue }
    if (char === '"') quoted = !quoted
    else if (!quoted && char === ',') commas++
    else if (!quoted && char === ';') semicolons++
  }
  return semicolons > commas ? ';' : ','
}

function parseCsvGrid(text) {
  const input = String(text || '').replace(/^\uFEFF/, '')
  if (!input.trim()) throw new Error('CSV-файл пустой.')
  const delimiter = detectCsvDelimiter(input)
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === delimiter) {
      row.push(field); field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      if (row.some(value => value.trim() !== '')) rows.push(row)
      row = []; field = ''
    } else {
      field += char
    }
  }
  if (quoted) throw new Error('В CSV найдена незакрытая кавычка. Проверьте поле с запятыми или переносами строк.')
  row.push(field)
  if (row.some(value => value.trim() !== '')) rows.push(row)
  if (rows.length < 2) throw new Error('В CSV должна быть строка заголовков и хотя бы одна строка данных.')
  return rows
}

function normalizeImportJurisdiction(value) {
  const raw = String(value || '').trim()
  const normalized = normalizeCsvHeader(raw).toUpperCase()
  const aliases = {
    RU: 'RU', РФ: 'RU', РОССИЙСКАЯФЕДЕРАЦИЯ: 'RU',
    KG: 'KG', КР: 'KG', КЫРГЫЗСКАЯРЕСПУБЛИКА: 'KG',
    EAEU: 'EAEU', ЕАЭС: 'EAEU', ЕВРАЗИЙСКИЙЭКОНОМИЧЕСКИЙСОЮЗ: 'EAEU',
  }
  return aliases[normalized] || raw.toUpperCase()
}

function normalizeImportDate(value, rowNumber, columnName) {
  const raw = String(value || '').trim()
  if (!raw) return null
  let iso = ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    iso = raw
  } else {
    const match = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
    if (match) iso = match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0')
  }

  const parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (parts) {
    const year = Number(parts[1])
    const month = Number(parts[2])
    const day = Number(parts[3])
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]) return iso
  }

  throw new Error('Строка CSV ' + rowNumber + ': некорректная дата в столбце «' + columnName + '»: ' + raw + '. Используйте ГГГГ-ММ-ДД или ДД.ММ.ГГГГ.')
}

function parseDocumentCsv(text) {
  const grid = parseCsvGrid(text)
  const headers = grid[0].map(normalizeCsvHeader)
  const fieldIndexes = {}
  for (const field of csvImportFields) {
    fieldIndexes[field.key] = headers.findIndex(header =>
      field.aliases.some(alias => normalizeCsvHeader(alias) === header))
  }
  const missingHeaders = csvImportFields.filter(field => field.required && fieldIndexes[field.key] < 0)
  if (missingHeaders.length) {
    throw new Error('Не найдены обязательные столбцы: ' + missingHeaders.map(field => field.header).join(', ') + '. Скачайте шаблон CSV и перенесите в него данные.')
  }

  const dataRows = grid.slice(1).filter(row => row.some(value => value.trim() !== ''))
  if (dataRows.length > 100) throw new Error('За один раз можно импортировать не более 100 строк. Разделите файл на несколько частей.')
  const wrongWidth = dataRows.findIndex(row => row.length !== headers.length)
  if (wrongWidth >= 0) {
    throw new Error('Строка CSV ' + (wrongWidth + 2) + ' содержит ' + dataRows[wrongWidth].length
      + ' полей при ' + headers.length + ' столбцах заголовка. Проверьте разделители и кавычки.')
  }

  const read = (row, key) => {
    const index = fieldIndexes[key]
    return index < 0 ? '' : String(row[index] ?? '').trim()
  }
  return dataRows.map((row, index) => {
    const rowNumber = index + 2
    return {
      title: read(row, 'title'),
      jurisdiction: normalizeImportJurisdiction(read(row, 'jurisdiction')),
      kind: read(row, 'kind'),
      area: read(row, 'area'),
      productGroup: read(row, 'productGroup') || null,
      keywords: read(row, 'keywords') || null,
      relatedDocumentIds: [],
      documentNumber: read(row, 'documentNumber') || null,
      documentDate: normalizeImportDate(read(row, 'documentDate'), rowNumber, 'Дата документа'),
      effectiveFrom: normalizeImportDate(read(row, 'effectiveFrom'), rowNumber, 'Действует с'),
      effectiveUntil: normalizeImportDate(read(row, 'effectiveUntil'), rowNumber, 'Действует по'),
      sourceUrl: read(row, 'sourceUrl') || null,
      description: read(row, 'description'),
      content: read(row, 'content'),
      status: '',
      changeNote: 'CSV импорт',
    }
  })
}

function downloadCsvTemplate() {
  const headers = csvImportFields.map(field => field.header).join(';')
  const blob = new Blob(['\uFEFF' + headers + '\r\n'], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'teksher-hub-import-template.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function App() {
  const [theme, setTheme] = useState(loadTheme)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState([])
  const [globalSearchActiveIndex, setGlobalSearchActiveIndex] = useState(0)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [globalSearchError, setGlobalSearchError] = useState('')
  const [active, setActive] = useState('home')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Все типы')
  const [statusFilter, setStatusFilter] = useState('Все статусы')
  const [sortBy, setSortBy] = useState('updated')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [userDocuments, setUserDocuments] = useState(loadUserDocuments)
  const [apiDocuments, setApiDocuments] = useState([])
  const [apiSearchResults, setApiSearchResults] = useState([])
  const [apiSearchTerm, setApiSearchTerm] = useState('')
  const [apiFiles, setApiFiles] = useState([])
  const [localAttachmentFiles, setLocalAttachmentFiles] = useState([])
  const [reindexingFileId, setReindexingFileId] = useState(null)
  const [documentVersions, setDocumentVersions] = useState([])
  const [monitors, setMonitors] = useState([])
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [authInitializing, setAuthInitializing] = useState(API_ENABLED)
  const [loginError, setLoginError] = useState('')
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isBulkReindexing, setIsBulkReindexing] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [monitorModalOpen, setMonitorModalOpen] = useState(false)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [passwordResetTarget, setPasswordResetTarget] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [reviewDialog, setReviewDialog] = useState(null)
  const [reviewNote, setReviewNote] = useState('Проверено вручную')
  const [isReviewSaving, setIsReviewSaving] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* storage unavailable */ }
  }, [theme])

  useEffect(() => {
    const onShortcut = (event) => {
      const target = event.target
      const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setGlobalSearchQuery(''); setGlobalSearchActiveIndex(0); setGlobalSearchError(''); setShowGlobalSearch(true)
      } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setGlobalSearchQuery(''); setGlobalSearchActiveIndex(0); setGlobalSearchError(''); setShowGlobalSearch(true)
      } else if (event.key === 'Escape') {
        setShowGlobalSearch(false)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const documents = useMemo(() => API_ENABLED ? apiDocuments : [...userDocuments, ...demoDocuments], [apiDocuments, userDocuments])

  useEffect(() => {
    let cancelled = false
    if (API_ENABLED || !selectedDoc || selectedDoc.isDemo) {
      setLocalAttachmentFiles([])
      return undefined
    }
    loadLocalAttachments(selectedDoc.id)
      .then(rows => { if (!cancelled) setLocalAttachmentFiles(rows) })
      .catch(error => { if (!cancelled) setActionError(error.message || 'Не удалось прочитать вложения из браузера.') })
    return () => { cancelled = true }
  }, [selectedDoc?.id])

  useEffect(() => {
    if (!showGlobalSearch) return
    const term = globalSearchQuery.trim()
    if (term.length < 2) {
      setGlobalSearchResults([])
      setGlobalSearchLoading(false)
      setGlobalSearchError('')
      return
    }
    if (!API_ENABLED) {
      const normalized = term.toLocaleLowerCase('ru-RU')
      setGlobalSearchResults(documents.filter(doc => [doc.title, doc.description, doc.content || '', doc.area, doc.kind, doc.productGroup || '', doc.keywords || '', doc.documentNumber || '', doc.statusLabel || doc.status || ''].join(' ').toLocaleLowerCase('ru-RU').includes(normalized)).slice(0, 8))
      setGlobalSearchLoading(false)
      setGlobalSearchError('')
      return
    }
    let cancelled = false
    setGlobalSearchResults([])
    setGlobalSearchActiveIndex(0)
    setGlobalSearchLoading(true)
    setGlobalSearchError('')
    const timeout = window.setTimeout(() => {
      apiRequest('/api/documents?q=' + encodeURIComponent(term))
        .then(rows => { if (!cancelled) setGlobalSearchResults(rows.slice(0, 8)) })
        .catch(error => { if (!cancelled) { setGlobalSearchResults([]); setGlobalSearchError(error.message || 'Не удалось выполнить поиск.') } })
        .finally(() => { if (!cancelled) setGlobalSearchLoading(false) })
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timeout) }
  }, [showGlobalSearch, globalSearchQuery, documents, currentUser])

  const filteredDocuments = useMemo(() => {
    const searchSource = API_ENABLED && query.trim()
      ? (apiSearchTerm === query.trim() ? apiSearchResults : [])
      : documents
    const filtered = searchSource.filter((doc) => {
      const isMzkm = isMzkmCatalogDocument(doc)
      const matchesJurisdiction = active === 'RU'
        ? doc.jurisdiction === 'RU' || isMzkm
        : active === 'KG'
          ? doc.jurisdiction === 'KG' && !isMzkm
          : active === 'EAEU'
            ? doc.jurisdiction === 'EAEU'
            : true
      const matchesQuery = API_ENABLED || [doc.title, doc.description, doc.content || '', doc.area, doc.kind, doc.productGroup || '', doc.keywords || '', doc.documentNumber || ''].join(' ').toLowerCase().includes(query.toLowerCase())
      const matchesFilter = filter === 'Все типы' || doc.kind === filter
      const displayStatus = doc.statusLabel || doc.status
      const matchesStatus = statusFilter === 'Все статусы' || displayStatus === statusFilter
      const matchesSection = active === 'groups' ? (doc.kind === 'Товарная группа' || doc.area === 'Товарные группы')
        : active === 'processes' ? doc.kind === 'Бизнес-процесс'
        : active === 'knowledge' ? ['Нормативный акт', 'Товарная группа', 'Инструкция', 'Внутренний документ', 'Техническая документация', 'Известная ошибка', 'Шаблон', 'Бизнес-процесс', 'Обзор'].includes(doc.kind)
        : true
      return matchesJurisdiction && matchesQuery && matchesFilter && matchesStatus && matchesSection
    })
    const updatedAt = doc => {
      const value = doc.updatedAt || doc.createdAt || doc.documentDate
      const parsed = value ? Date.parse(value) : 0
      return Number.isNaN(parsed) ? 0 : parsed
    }
    if (sortBy === 'title') return filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru-RU', { sensitivity: 'base' }))
    if (sortBy === 'review') {
      const reviewPriority = doc => ['UNDER_REVIEW', 'НА ПРОВЕРКЕ'].includes(String(doc.status || doc.statusLabel || '').toLocaleUpperCase('ru-RU')) || doc.statusLabel === 'На проверке' ? 0 : 1
      return filtered.sort((a, b) => reviewPriority(a) - reviewPriority(b) || updatedAt(b) - updatedAt(a))
    }
    if (sortBy === 'expires') {
      const endDate = doc => {
        if (!doc.effectiveUntil) return Number.POSITIVE_INFINITY
        const parsed = Date.parse(doc.effectiveUntil)
        return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
      }
      return filtered.sort((a, b) => endDate(a) - endDate(b) || updatedAt(b) - updatedAt(a))
    }
    return filtered.sort((a, b) => updatedAt(b) - updatedAt(a))
  }, [documents, apiSearchResults, apiSearchTerm, active, query, filter, statusFilter, sortBy])

  useEffect(() => {
    if (!API_ENABLED) { setAuthInitializing(false); return }
    const token = getStoredToken()
    if (!token) { setAuthInitializing(false); return }
    apiRequest('/api/auth/me', { token }).then(setCurrentUser).catch(() => {
      clearStoredToken()
      setCurrentUser(null)
    }).finally(() => setAuthInitializing(false))
  }, [])

  useEffect(() => {
    if (!API_ENABLED || !currentUser) return
    let cancelled = false
    apiRequest('/api/documents').then(rows => { if (!cancelled) setApiDocuments(rows) }).catch(err => { if (!cancelled) setActionError(err.message) })
    apiRequest('/api/monitors').then(rows => { if (!cancelled) setMonitors(rows) }).catch(err => { if (!cancelled) setActionError(err.message) })
    if (currentUser.role === 'ADMIN') {
      apiRequest('/api/users').then(rows => { if (!cancelled) setUsers(rows) }).catch(err => { if (!cancelled) setActionError(err.message) })
    }
    return () => { cancelled = true }
  }, [currentUser])

  useEffect(() => {
    if (!API_ENABLED || !currentUser) return
    const term = query.trim()
    if (!term) {
      setApiSearchResults([])
      setApiSearchTerm('')
      return
    }
    let cancelled = false
    const timeout = window.setTimeout(() => {
      apiRequest('/api/documents?q=' + encodeURIComponent(term))
        .then(rows => {
          if (!cancelled) {
            setApiSearchResults(rows)
            setApiSearchTerm(term)
          }
        })
        .catch(err => { if (!cancelled) setActionError(err.message) })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [currentUser, query])

  useEffect(() => {
    if (!API_ENABLED || !currentUser || !selectedDoc || selectedDoc.isDemo) {
      setApiFiles([])
      setDocumentVersions([])
      return
    }
    let cancelled = false
    apiRequest('/api/documents/' + selectedDoc.id + '/files').then(rows => { if (!cancelled) setApiFiles(rows) }).catch(() => { if (!cancelled) setApiFiles([]) })
    apiRequest('/api/documents/' + selectedDoc.id + '/versions').then(rows => { if (!cancelled) setDocumentVersions(rows) }).catch(() => { if (!cancelled) setDocumentVersions([]) })
    return () => { cancelled = true }
  }, [currentUser, selectedDoc?.id, selectedDoc?.versionNumber])

  const pageTitle = active === 'home' ? 'База знаний оператора маркировки'
    : active === 'RU' ? 'МЗКМ · материалы для маркировки в РФ'
    : active === 'KG' ? 'ГАИС МТ · национальные материалы КР'
    : jurisdictions[active]?.label || ({ assistant: 'ИИ-помощник', documents: 'Все документы', groups: 'Товарные группы', processes: 'Бизнес-процессы', knowledge: 'Инструкции и база знаний', monitoring: 'Мониторинг официальных источников', users: 'Управление пользователями' }[active] || 'TEKSHER HUB')

  const syncRoute = (section, docId = null, replace = false) => {
    const route = { app: 'teksher-hub', section, docId }
    const url = docId ? '#' + section + '/document/' + encodeURIComponent(docId) : '#' + section
    if (replace) window.history.replaceState(route, '', url)
    else window.history.pushState(route, '', url)
  }

  const openSection = (id) => {
    syncRoute(id)
    setActive(id); setSelectedDoc(null); setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы')
    setActionError(''); setSuccessMessage('')
  }

  const searchProductGroupMaterials = (groupName) => {
    syncRoute('documents')
    setActive('documents')
    setSelectedDoc(null)
    setQuery(groupName)
    setFilter('Все типы')
    setStatusFilter('Все статусы')
    setSortBy('updated')
    setActionError('')
    setSuccessMessage('')
  }

  const openDocument = (doc) => {
    syncRoute(active, doc.id)
    setSelectedDoc(doc)
    setActionError(''); setSuccessMessage('')
  }

  const openGlobalSearchResult = (doc) => {
    setShowGlobalSearch(false)
    setGlobalSearchQuery('')
    setActive('documents')
    setSelectedDoc(doc)
    setQuery('')
    setFilter('Все типы')
    setStatusFilter('Все статусы')
    syncRoute('documents', doc.id)
    setActionError('')
    setSuccessMessage('')
  }

  useEffect(() => {
    const restoreRoute = () => {
      const route = window.history.state
      if (route?.app === 'teksher-hub') {
        setActive(route.section || 'home')
        const doc = route.docId ? documents.find(item => String(item.id) === String(route.docId)) : null
        setSelectedDoc(doc || null)
      } else {
        setActive('home')
        setSelectedDoc(null)
      }
      setActionError(''); setSuccessMessage('')
    }
    if (!window.history.state?.app) syncRoute('home', null, true)
    window.addEventListener('popstate', restoreRoute)
    return () => window.removeEventListener('popstate', restoreRoute)
  }, [documents])

  const refreshDocuments = async () => {
    if (!API_ENABLED) return
    const term = query.trim()
    const [rows, searchRows] = await Promise.all([
      apiRequest('/api/documents'),
      term ? apiRequest('/api/documents?q=' + encodeURIComponent(term)) : Promise.resolve([])
    ])
    setApiDocuments(rows)
    if (term) {
      setApiSearchResults(searchRows)
      setApiSearchTerm(term)
    }
  }
  const refreshMonitors = async () => setMonitors(await apiRequest('/api/monitors'))
  const refreshUsers = async () => setUsers(await apiRequest('/api/users'))

  const handleLogin = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setLoginError('')
    try {
      const result = await apiRequest('/api/auth/login', { method: 'POST', auth: false, body: {
        username: String(data.get('username') || '').trim(),
        password: String(data.get('password') || '')
      }})
      storeToken(result.token)
      setCurrentUser(result.user)
    } catch (error) { setLoginError(error.message || 'Не удалось выполнить вход') }
  }

  const handleLogout = () => {
    clearStoredToken()
    setCurrentUser(null)
    setApiDocuments([])
    setApiSearchResults([])
    setApiSearchTerm('')
    setApiFiles([])
    setDocumentVersions([])
    setSelectedDoc(null)
    setActive('home')
  }

  const handleUploadAttachment = async (file) => {
    if (!file || !selectedDoc || selectedDoc.isDemo) return
    if (file.size > 30 * 1024 * 1024) {
      setActionError('Размер файла превышает 30 МБ.')
      return
    }
    if (!API_ENABLED) {
      setIsUploadingAttachment(true)
      setActionError('')
      setSuccessMessage('')
      try {
        await saveLocalAttachment(selectedDoc.id, file)
        setLocalAttachmentFiles(await loadLocalAttachments(selectedDoc.id))
        setSuccessMessage('Файл прикреплён к карточке и сохранён в этом браузере. Для совместного доступа подключите общую базу.')
      } catch (error) {
        setActionError(error.message || 'Не удалось сохранить файл в браузере.')
      } finally {
        setIsUploadingAttachment(false)
      }
      return
    }
    if (!['ADMIN', 'EDITOR'].includes(currentUser?.role)) {
      setActionError('Для загрузки вложений нужна роль редактора или администратора.')
      return
    }
    setIsUploadingAttachment(true)
    setActionError('')
    setSuccessMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiRequest('/api/documents/' + selectedDoc.id + '/files', { method: 'POST', body: formData })
      const [updatedFiles] = await Promise.all([
        apiRequest('/api/documents/' + selectedDoc.id + '/files'),
        refreshDocuments()
      ])
      setApiFiles(updatedFiles)
      setSuccessMessage('Документ прикреплён. Текстовое содержимое будет доступно в поиске после обработки.')
    } catch (error) {
      setActionError(error.message || 'Не удалось прикрепить документ.')
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const handleSaveDocument = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const sourceValue = String(data.get('sourceUrl') || '').trim()
    let sourceUrl = ''
    if (sourceValue) {
      try {
        const parsedSource = new URL(sourceValue)
        if (['https:', 'http:'].includes(parsedSource.protocol)) sourceUrl = parsedSource.href
        else throw new Error('Ссылка должна начинаться с HTTP или HTTPS')
      } catch {
        setActionError('Проверь ссылку на официальный источник: нужен полный адрес HTTP или HTTPS.')
        return
      }
    }
    const payload = {
      title: String(data.get('title') || '').trim(),
      jurisdiction: String(data.get('jurisdiction') || 'KG'),
      kind: String(data.get('kind') || 'Нормативный акт'),
      area: String(data.get('area') || '').trim(),
      productGroup: String(data.get('productGroup') || '').trim() || null,
      keywords: String(data.get('keywords') || '').trim() || null,
      relatedDocumentIds: data.getAll('relatedDocumentIds').map(String).filter(Boolean),
      documentNumber: String(data.get('documentNumber') || '').trim() || null,
      documentDate: String(data.get('documentDate') || '') || null,
      effectiveFrom: String(data.get('effectiveFrom') || '') || null,
      effectiveUntil: String(data.get('effectiveUntil') || '') || null,
      sourceUrl: sourceUrl || null,
      description: String(data.get('description') || '').trim(),
      content: String(data.get('content') || '').trim(),
      status: String(data.get('status') || ''),
      changeNote: String(data.get('changeNote') || '').trim() || (editingDoc ? 'Редактирование карточки' : 'Создание карточки'),
    }
    const upload = data.get('file')
    if (upload instanceof File && upload.size > 30 * 1024 * 1024) {
      setActionError('Размер файла превышает 30 МБ.')
      return
    }
    setIsSaving(true); setActionError(''); setSuccessMessage('')
    try {
      let doc
      if (API_ENABLED) {
        doc = await apiRequest(editingDoc ? '/api/documents/' + editingDoc.id : '/api/documents', {
          method: editingDoc ? 'PUT' : 'POST', body: payload
        })
        if (upload instanceof File && upload.size > 0) {
          const formData = new FormData()
          formData.append('file', upload)
          await apiRequest('/api/documents/' + doc.id + '/files', { method: 'POST', body: formData })
        }
        await refreshDocuments()
        setSuccessMessage(editingDoc ? 'Карточка и история редакций обновлены.' : 'Карточка добавлена в общую базу.')
      } else {
        doc = {
          ...(editingDoc || {}),
          ...payload,
          id: editingDoc?.id || 'user-' + Date.now(),
          status: sourceUrl ? 'Источник указан' : 'Черновик',
          createdAt: editingDoc?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDemo: false,
        }
        const nextDocuments = editingDoc ? userDocuments.map(item => item.id === doc.id ? doc : item) : [doc, ...userDocuments]
        setUserDocuments(nextDocuments)
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDocuments)) } catch { /* storage quota may be reached */ }
        if (upload instanceof File && upload.size > 0) await saveLocalAttachment(doc.id, upload)
        setSuccessMessage('Карточка сохранена в текущем браузере.' + (upload instanceof File && upload.size > 0 ? ' Файл прикреплён к карточке.' : '') + ' Для общей базы подключите API.')
      }
      setActive('documents')
      syncRoute('documents', doc.id)
      setSelectedDoc(doc)
      setShowCreateModal(false)
      setEditingDoc(null)
      setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы')
    } catch (error) {
      setActionError(error.message || 'Не удалось сохранить документ.')
    } finally { setIsSaving(false) }
  }

  const handleDeleteDocument = (doc) => {
    if (doc.isDemo) return
    setConfirmDialog({
      title: 'Удалить карточку документа?',
      message: 'Карточка «' + doc.title + '» будет удалена из общей базы. Связанные вложения и история редакций также удалятся. Это действие нельзя отменить.',
      confirmLabel: 'Удалить карточку',
      tone: 'danger',
      onConfirm: async () => {
        setActionError(''); setSuccessMessage('')
        try {
          if (API_ENABLED) {
            await apiRequest('/api/documents/' + doc.id, { method: 'DELETE' })
            await refreshDocuments()
            setSuccessMessage('Карточка удалена.')
          } else {
            const nextDocuments = userDocuments.filter(item => item.id !== doc.id)
            setUserDocuments(nextDocuments)
            try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDocuments)) } catch { /* local storage unavailable */ }
          }
          setSelectedDoc(null)
          setActive('documents')
        } catch (error) {
          setActionError(error.message || 'Не удалось удалить карточку.')
        }
      },
    })
  }

  const handleReviewDocument = (status) => {
    if (!selectedDoc || !API_ENABLED) return
    setActionError('')
    setReviewNote('Проверено вручную')
    setReviewDialog({ status, documentId: selectedDoc.id, documentTitle: selectedDoc.title })
  }

  const handleSubmitReview = async () => {
    if (!reviewDialog || !API_ENABLED || isReviewSaving) return
    setIsReviewSaving(true)
    setActionError('')
    try {
      const updated = await apiRequest('/api/documents/' + reviewDialog.documentId + '/review', {
        method: 'POST',
        body: { status: reviewDialog.status, note: reviewNote.trim() },
      })
      setSelectedDoc(current => current?.id === updated.id ? updated : current)
      await refreshDocuments()
      setSuccessMessage('Статус проверки обновлён.')
      setActionError('')
      setReviewDialog(null)
    } catch (error) {
      setActionError(error.message || 'Не удалось обновить статус.')
    } finally {
      setIsReviewSaving(false)
    }
  }

  const handleDownloadFile = async (file) => {
    try {
      let blob
      if (file.localAttachment || String(file.id).startsWith('local-')) {
        const localFile = await readLocalAttachment(file.id)
        if (!localFile?.blob) throw new Error('Файл не найден в локальном хранилище этого браузера.')
        blob = localFile.blob
      } else {
        blob = await apiRequest(file.downloadPath, { responseType: 'blob' })
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) { setActionError(error.message || 'Не удалось скачать файл.') }
  }

  const handleReindexFile = async (file) => {
    if (!API_ENABLED || !selectedDoc) return
    setReindexingFileId(file.id)
    setActionError('')
    setSuccessMessage('')
    try {
      const updated = await apiRequest('/api/documents/' + selectedDoc.id + '/files/' + file.id + '/reindex', { method: 'POST' })
      setApiFiles(current => current.map(item => item.id === file.id ? updated : item))
      await refreshDocuments()
      setSuccessMessage('Индексация завершена: ' + fileIndexLabel(updated))
    } catch (error) {
      setActionError(error.message || 'Не удалось переиндексировать файл.')
    } finally {
      setReindexingFileId(null)
    }
  }

  const handleBulkReindex = async () => {
    if (!API_ENABLED || currentUser?.role !== 'ADMIN' || isBulkReindexing) return
    setIsBulkReindexing(true)
    setActionError('')
    setSuccessMessage('')
    try {
      const result = await apiRequest('/api/admin/attachments/reindex-unindexed?limit=25', { method: 'POST' })
      await refreshDocuments()
      if (selectedDoc) {
        const refreshedFiles = await apiRequest('/api/documents/' + selectedDoc.id + '/files')
        setApiFiles(refreshedFiles)
      }
      setSuccessMessage('Переиндексация старых вложений: обработано ' + result.processed
        + ', индексировано ' + result.indexed
        + ', частично ' + result.partiallyIndexed
        + ', пустых / неподдерживаемых ' + result.emptyOrUnsupported
        + ', ошибок ' + result.failed
        + '. В очереди без индекса осталось: ' + result.remainingUnindexed + '.')
    } catch (error) {
      setActionError(error.message || 'Не удалось запустить пакетную переиндексацию.')
    } finally {
      setIsBulkReindexing(false)
    }
  }

  const handleImportDocuments = async (rows) => {
    if (!API_ENABLED || !['ADMIN', 'EDITOR'].includes(currentUser?.role)) {
      throw new Error('Импорт доступен только редакторам и администраторам подключённой общей базы.')
    }
    setActionError('')
    setSuccessMessage('')
    try {
      const result = await apiRequest('/api/documents/import', {
        method: 'POST',
        body: { documents: rows },
      })
      const refreshed = await apiRequest('/api/documents')
      setApiDocuments(refreshed)
      setApiSearchResults([])
      setApiSearchTerm('')
      setQuery('')
      setFilter('Все типы')
      setStatusFilter('Все статусы')
      setSuccessMessage('CSV импорт завершён: добавлено ' + result.imported + ', отклонено ' + result.rejected + '. Импортированные материалы не получают статус «Действует» автоматически.')
      return result
    } catch (error) {
      setActionError(error.message || 'Не удалось импортировать CSV.')
      throw error
    }
  }

  const handleExportDocuments = async () => {
    if (!API_ENABLED || !['ADMIN', 'EDITOR'].includes(currentUser?.role) || isExporting) return
    setIsExporting(true)
    setActionError('')
    setSuccessMessage('')
    try {
      const blob = await apiRequest('/api/documents/export.csv', { responseType: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'teksher-hub-export.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setSuccessMessage('Экспорт карточек подготовлен. CSV содержит реквизиты и текст карточек, но не является резервной копией вложенных файлов или базы данных.')
    } catch (error) {
      setActionError(error.message || 'Не удалось экспортировать CSV.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleSaveMonitor = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setIsSaving(true); setActionError('')
    try {
      await apiRequest('/api/monitors', { method: 'POST', body: {
        name: String(data.get('name') || '').trim(),
        jurisdiction: String(data.get('jurisdiction') || 'KG'),
        sourceUrl: String(data.get('sourceUrl') || '').trim(),
        enabled: data.get('enabled') === 'on',
        intervalHours: Number(data.get('intervalHours') || 24),
      }})
      await refreshMonitors()
      setMonitorModalOpen(false)
      setSuccessMessage('Источник добавлен в мониторинг.')
    } catch (error) { setActionError(error.message || 'Не удалось добавить источник.') }
    finally { setIsSaving(false) }
  }

  const handleCheckMonitor = async (monitor) => {
    setActionError('')
    try {
      const updated = await apiRequest('/api/monitors/' + monitor.id + '/check', { method: 'POST' })
      setMonitors(rows => rows.map(row => row.id === updated.id ? updated : row))
      setSuccessMessage('Источник проверен.')
    } catch (error) { setActionError(error.message || 'Проверка источника не выполнена.') }
  }

  const handleDeleteMonitor = (monitor) => {
    setConfirmDialog({
      title: 'Удалить источник мониторинга?',
      message: 'Источник «' + monitor.name + '» будет удалён из списка отслеживания. Это действие нельзя отменить.',
      confirmLabel: 'Удалить источник',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await apiRequest('/api/monitors/' + monitor.id, { method: 'DELETE' })
          await refreshMonitors()
          setSuccessMessage('Источник удалён из мониторинга.')
          setActionError('')
        } catch (error) {
          setActionError(error.message || 'Не удалось удалить источник.')
        }
      },
    })
  }

  const handleSaveUser = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setIsSaving(true); setActionError('')
    try {
      await apiRequest('/api/users', { method: 'POST', body: {
        username: String(data.get('username') || '').trim(),
        displayName: String(data.get('displayName') || '').trim(),
        password: String(data.get('password') || ''),
        role: String(data.get('role') || 'READER'),
      }})
      await refreshUsers()
      setUserModalOpen(false)
      setSuccessMessage('Пользователь создан.')
    } catch (error) { setActionError(error.message || 'Не удалось создать пользователя.') }
    finally { setIsSaving(false) }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (!passwordResetTarget) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') || '')
    setIsSaving(true); setActionError('')
    try {
      await apiRequest('/api/users/' + passwordResetTarget.id + '/password', { method: 'PUT', body: { password } })
      setPasswordResetTarget(null)
      setSuccessMessage('Пароль пользователя «' + passwordResetTarget.username + '» обновлён.')
      await refreshUsers()
    } catch (error) { setActionError(error.message || 'Не удалось сменить пароль.') }
    finally { setIsSaving(false) }
  }

  const handleToggleUser = async (user) => {
    try {
      await apiRequest('/api/users/' + user.id + '/enabled', { method: 'PATCH', body: { enabled: !user.enabled } })
      await refreshUsers()
    } catch (error) { setActionError(error.message || 'Не удалось изменить пользователя.') }
  }

  const closeDocumentModal = () => { setShowCreateModal(false); setEditingDoc(null); setActionError('') }
  const openNewDocumentModal = () => { setEditingDoc(null); setActionError(''); setShowCreateModal(true) }


  if (API_ENABLED && authInitializing) return <LoginScreen loading />
  if (API_ENABLED && !currentUser) return <LoginScreen onSubmit={handleLogin} error={loginError} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => openSection('home')} aria-label="На главную">
          <span className="brand-mark">T</span>
          <span className="brand-copy"><strong>TEKSHER<span>HUB</span></strong><small>KNOWLEDGE PLATFORM</small></span>
        </button>
        <div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        {navGroups.map((group) => {
          const items = group.items.filter(item => {
            if (!API_ENABLED && ['monitoring', 'users'].includes(item.id)) return false
            if (item.id === 'users' && currentUser?.role !== 'ADMIN') return false
            return true
          })
          if (!items.length) return null
          return <div className="nav-group" key={group.title}>
            <div className="nav-heading">{group.title}</div>
            {items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => openSection(id)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{active === id && <span className="active-dot" />}
            </button>)}
          </div>
        })}
        <div className="sidebar-bottom">
          <div className="status-indicator"><span /> Платформа в разработке</div>
          <div className="sidebar-version">Версия 0.3 · MVP</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>TEKSHER HUB</span><span className="crumb-slash">/</span><strong>{selectedDoc ? 'Карточка документа' : pageTitle}</strong></div>
          <button className="global-search-trigger" type="button" onClick={() => { setGlobalSearchQuery(''); setGlobalSearchActiveIndex(0); setGlobalSearchError(''); setShowGlobalSearch(true) }} aria-label="Поиск по базе документов"><Search size={15}/><span>Поиск по базе</span><kbd>Ctrl K</kbd></button>
          <div className="topbar-right"><button className="theme-toggle" type="button" onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span></button><span className="internal-badge"><ShieldCheck size={14} /> {API_ENABLED ? currentUser?.role || 'Пользователь' : 'Демо-режим'}</span><div className="avatar">{currentUser?.displayName ? currentUser.displayName.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase() : 'ОП'}</div>{API_ENABLED && <button className="logout-button" onClick={handleLogout} title="Выйти"><LogOut size={15} /><span>Выход</span></button>}</div>
        </header>

        <div className="page-content">
          {actionError && <div className="feedback feedback-error" role="alert"><CircleHelp size={16} /><span>{actionError}</span><button onClick={() => setActionError('')} aria-label="Закрыть сообщение"><X size={15} /></button></div>}
          {successMessage && <div className="feedback feedback-success" role="status"><CheckCircle2 size={16} /><span>{successMessage}</span><button onClick={() => setSuccessMessage('')} aria-label="Закрыть сообщение"><X size={15} /></button></div>}
          {active === 'home' && !selectedDoc ? <>
            <section className="welcome">
              <div className="welcome-content">
                <div className="eyebrow"><Sparkles size={14} /> ЕДИНОЕ ПРОСТРАНСТВО ЗНАНИЙ</div>
                <h1>Вся маркировка.<br /><span>В одном месте.</span></h1>
                <p>Нормативные документы, инструкции и рабочие материалы оператора – структурировано по юрисдикциям и системам.</p>
                <button className="welcome-button" onClick={() => openSection('documents')}>Открыть базу документов <ArrowUpRight size={17} /></button>
              </div>
              <div className="welcome-graphic" aria-hidden="true">
                <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="graphic-core"><Layers3 size={42} /></div>
                <div className="float-card float-ru"><span>🇷🇺</span><div><b>МЗКМ</b><small>Российская Федерация</small></div></div>
                <div className="float-card float-kg"><span>🇰🇬</span><div><b>ГАИС МТ</b><small>Кыргызская Республика</small></div></div>
                <div className="float-card float-eaeu"><span>🌐</span><div><b>ЕАЭС</b><small>Наднациональные акты</small></div></div>
              </div>
            </section>

            <section className="home-overview" aria-label="Сводка платформы">
              <button className="overview-card" onClick={() => openSection('documents')}>
                <span className="overview-icon overview-blue"><LibraryBig size={20} /></span>
                <span className="overview-copy"><strong>{documents.length}</strong><b>{API_ENABLED ? 'Материалов в базе' : 'Демо-карточек'}</b><small>{API_ENABLED ? 'Документы и рабочие материалы' : 'Примеры интерфейса, не официальные НПА'}</small></span>
                <ArrowUpRight size={16} className="overview-arrow" />
              </button>
              <button className="overview-card" onClick={() => {
                setActive('documents'); setSelectedDoc(null); setQuery(''); setFilter('Все типы'); setStatusFilter('На проверке'); syncRoute('documents')
              }}>
                <span className="overview-icon overview-amber"><CircleHelp size={20} /></span>
                <span className="overview-copy"><strong>{API_ENABLED ? documents.filter(doc => ['UNDER_REVIEW', 'На проверке'].includes(doc.statusLabel || doc.status)).length : '—'}</strong><b>Требуют проверки</b><small>{API_ENABLED ? 'Нормативные записи на юридической проверке' : 'Доступно в подключённой базе'}</small></span>
                <ArrowUpRight size={16} className="overview-arrow" />
              </button>
              <button className="overview-card" onClick={() => openSection('groups')}>
                <span className="overview-icon overview-green"><Boxes size={20} /></span>
                <span className="overview-copy"><strong>02</strong><b>Контура маркировки</b><small>Внешний МЗКМ и внутренний ГАИС МТ</small></span>
                <ArrowUpRight size={16} className="overview-arrow" />
              </button>
            </section>

            <section className="home-workbench">
              <div className="workbench-heading">
                <div><div className="section-kicker">РАБОЧАЯ ПАНЕЛЬ</div><h2>Материалы и контроль</h2><p>Быстрый переход к документам и проверке актуальности.</p></div>
                <button className="text-button" onClick={() => openSection('documents')}>Вся база <ArrowUpRight size={15}/></button>
              </div>
              <div className="workbench-grid">
                <div className="workbench-panel">
                  <div className="workbench-panel-title"><span className="workbench-panel-icon"><LibraryBig size={17}/></span><div><b>Недавно добавленные</b><small>{documents.length ? 'Последние материалы в базе' : 'Пока нет материалов'}</small></div></div>
                  {documents.length ? [...documents].sort((a,b) => new Date(b.updatedAt || b.createdAt || b.documentDate || 0) - new Date(a.updatedAt || a.createdAt || a.documentDate || 0)).slice(0,4).map(doc => (
                    <button className="recent-document" key={doc.id} onClick={() => { setActive('documents'); setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы'); syncRoute('documents', doc.id); setSelectedDoc(doc) }}>
                      <span className={'recent-jurisdiction ' + (isMzkmCatalogDocument(doc) ? 'ru' : (jurisdictions[doc.jurisdiction]?.className || ''))}>{isMzkmCatalogDocument(doc) ? 'МЗКМ' : (jurisdictions[doc.jurisdiction]?.short || 'НПА')}</span>
                      <span className="recent-copy"><b>{doc.title}</b><small>{doc.documentNumber ? '№ ' + doc.documentNumber + ' · ' : ''}{doc.kind || 'Материал'} · {doc.statusLabel || doc.status || 'Без статуса'}</small></span>
                      <ArrowUpRight size={15}/>
                    </button>
                  )) : <div className="workbench-empty">Добавьте первый документ, чтобы он появился здесь.</div>}
                </div>
                <FreshnessReviewPanel documents={documents} apiEnabled={API_ENABLED} onOpenDocument={(doc) => {
                  setActive('documents'); setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы'); syncRoute('documents', doc.id); setSelectedDoc(doc)
                }} />
              </div>
              {!API_ENABLED && <div className="workbench-demo-note"><CircleHelp size={14}/> Сейчас показан демонстрационный режим. Счётчики юридической проверки появятся после подключения API и загрузки общей базы.</div>}
            </section>

            <div className="section-title-row"><div><div className="section-kicker">БЫСТРЫЙ ДОСТУП</div><h2>Выберите направление</h2><p>Каждый контур – отдельная нормативная область</p></div><span className="muted-count">03 направления</span></div>
            <section className="jurisdiction-grid">
              <JurisdictionCard code="RU" title="МЗКМ" subtitle="Российская Федерация" description="Законы РФ, нормативные акты и материалы системы «Честный ЗНАК»." count="Нормативная база РФ" onClick={() => openSection('RU')} />
              <JurisdictionCard code="KG" title="ГАИС МТ" subtitle="Кыргызская Республика" description="Национальное законодательство, положения и внутренние документы оператора." count="Нормативная база КР" onClick={() => openSection('KG')} />
              <JurisdictionCard code="EAEU" title="ЕАЭС" subtitle="Наднациональное регулирование" description="Соглашения, решения ЕЭК и документы для трансграничных процессов." count="Общие правила" onClick={() => openSection('EAEU')} />
            </section>

            <div className="section-title-row compact"><div><div className="section-kicker">НАВИГАЦИЯ</div><h2>Рабочие системы</h2></div></div>
            <section className="system-grid">
              <a className="system-card" href="https://label.teksher.kg" target="_blank" rel="noreferrer"><span className="system-icon blue"><ExternalLink size={20} /></span><span className="system-copy"><b>МЗКМ «Текшер»</b><small>Внешний контур · РФ</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://main.teksher.kg" target="_blank" rel="noreferrer"><span className="system-icon green"><ExternalLink size={20} /></span><span className="system-copy"><b>ГАИС МТ</b><small>Внутренний контур · КР</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
            </section>
          </> : selectedDoc ? <DocumentDetail doc={selectedDoc} onBack={() => { if (window.history.state?.app === 'teksher-hub') window.history.back(); else { setSelectedDoc(null); syncRoute(active, null, true) } }}
              onEdit={() => { setEditingDoc(selectedDoc); setShowCreateModal(true) }}
              onDelete={() => handleDeleteDocument(selectedDoc)}
              canEdit={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)}
              canDelete={!API_ENABLED || currentUser?.role === 'ADMIN'}
              canReview={API_ENABLED && ['ADMIN','EDITOR'].includes(currentUser?.role)}
              files={API_ENABLED ? apiFiles : localAttachmentFiles} versions={documentVersions} documents={documents} onOpenRelated={docId => { const related = documents.find(item => item.id === docId); if (related) openDocument(related) }} onDownload={handleDownloadFile} onUploadFile={handleUploadAttachment} uploadingFile={isUploadingAttachment} canUploadFiles={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)} onReview={handleReviewDocument} canReindex={API_ENABLED && ['ADMIN','EDITOR'].includes(currentUser?.role)} onReindexFile={handleReindexFile} reindexingFileId={reindexingFileId} />
            : active === 'assistant' ? <AiAssistantSection apiEnabled={API_ENABLED} onOpenDocument={docId => { const target = documents.find(item => String(item.id) === String(docId)); if (target) { setActive('documents'); setSelectedDoc(target); setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы'); syncRoute('documents', target.id) } }} />
            : active === 'knowledge' ? <KnowledgeCenterSection documents={documents} onSelectKind={(kind) => { setActive('documents'); setSelectedDoc(null); setQuery(''); setFilter(kind); setStatusFilter('Все статусы'); syncRoute('documents') }} onOpenAll={() => openSection('documents')} onAdd={openNewDocumentModal} canAdd={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)} />
            : active === 'groups' ? <ProductGroupsSection onOpen={openSection} onSearchGroup={searchProductGroupMaterials} />
            : active === 'monitoring' ? <MonitorSection monitors={monitors} canManage={['ADMIN','EDITOR'].includes(currentUser?.role)}
                onAdd={() => { setActionError(''); setMonitorModalOpen(true) }} onCheck={handleCheckMonitor} onDelete={handleDeleteMonitor} />
            : active === 'users' ? <UsersSection users={users} onAdd={() => { setActionError(''); setUserModalOpen(true) }} onToggle={handleToggleUser} onReset={user => { setActionError(''); setPasswordResetTarget(user) }} />
            : <>
            <div className="page-heading">
              <div><div className="section-kicker">БАЗА ЗНАНИЙ / {active === 'RU' ? 'МЗКМ' : active === 'KG' ? 'ГАИС МТ · КР' : (jurisdictions[active]?.short || 'TEKSHER HUB')}</div><h1>{pageTitle}</h1><p>{active === 'RU' ? 'Материалы МЗКМ, инструкции оператора и нормативные источники для маркировки товаров при обороте в РФ. Исходная юрисдикция каждого источника указана в карточке.' : active === 'KG' ? 'Национальные документы Кыргызской Республики и материалы ГАИС МТ. Карточки, классифицированные как МЗКМ, вынесены в отдельный каталог.' : jurisdictions[active] ? `Документы и материалы: ${jurisdictions[active].label}. ` : 'Поиск по нормативным актам и рабочим материалам платформы.'}{API_ENABLED ? ' Проверяйте реквизиты и статус каждого документа перед применением.' : ' Демонстрационные записи не являются официальной нормативной базой.'}</p></div>
              <div className="heading-actions"><span className="record-count">{filteredDocuments.length} записей</span>{active === 'documents' && API_ENABLED && ['ADMIN','EDITOR'].includes(currentUser?.role) && <button className="secondary-button csv-import-trigger" type="button" onClick={() => setShowImportModal(true)}><FileText size={14}/> Импорт CSV</button>}{active === 'documents' && API_ENABLED && ['ADMIN','EDITOR'].includes(currentUser?.role) && <button className="secondary-button csv-export-trigger" type="button" onClick={handleExportDocuments} disabled={isExporting}><Download size={14}/>{isExporting ? 'Экспорт…' : 'Экспорт CSV'}</button>}{active === 'documents' && API_ENABLED && currentUser?.role === 'ADMIN' && <button className="secondary-button bulk-reindex-button" type="button" onClick={handleBulkReindex} disabled={isBulkReindexing}><RefreshCw size={14} className={isBulkReindexing ? 'spin' : ''}/>{isBulkReindexing ? 'Обработка…' : 'Индексировать старые файлы'}</button>}{(!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)) && <button className="primary-button" onClick={openNewDocumentModal}><FilePlus2 size={16} /> Добавить запись</button>}</div>
            </div>
            <div className="search-panel">
              <div className="search-input-wrap"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию, реквизитам, содержанию карточек и вложений..." /></div>
              <div className="filter-wrap"><SlidersHorizontal size={16} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>Все типы</option><option>Обзор</option><option>Нормативный акт</option><option>Товарная группа</option><option>Инструкция</option><option>Техническая документация</option><option>Известная ошибка</option><option>Шаблон</option><option>Внутренний документ</option><option>Бизнес-процесс</option></select><ChevronDown size={14} /></div>
              <div className="filter-wrap status-select"><select aria-label="Фильтр по статусу" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Все статусы</option><option>Демонстрационная запись</option><option>Черновик</option><option>Источник указан</option><option>На проверке</option><option>Действует</option><option>Срок действия истёк</option><option>В архиве</option></select><ChevronDown size={14} /></div>
              <div className="filter-wrap sort-select"><ArrowDownRight size={16}/><select aria-label="Сортировка материалов" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="updated">Сначала обновлённые</option><option value="title">По названию А–Я</option><option value="review">Сначала на проверке</option><option value="expires">По дате окончания</option></select><ChevronDown size={14}/></div>
            </div>
            {(query.trim() || filter !== 'Все типы' || statusFilter !== 'Все статусы' || sortBy !== 'updated') && <div className="catalog-filter-summary"><span>Найдено материалов: <b>{filteredDocuments.length}</b></span><button type="button" onClick={() => { setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы'); setSortBy('updated') }}><X size={13}/> Сбросить поиск и фильтры</button></div>}
            <div className="notice"><CircleHelp size={17} /><div><b>{API_ENABLED ? 'Единая база документов' : 'Локальный демонстрационный режим'}</b><span>{API_ENABLED ? 'Данные загружаются из PostgreSQL через защищённый API. Перед публикацией проверяйте официальный источник и дату действия.' : 'Карточки сохраняются только в этом браузере. Чтобы включить общую базу, вход по ролям, версии и загрузку файлов, задайте VITE_API_URL после развёртывания backend.'}</span></div></div>
            <div className="document-list">{filteredDocuments.length ? filteredDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} onClick={() => openDocument(doc)} />) : <div className="empty-state"><Search size={28} /><b>{active === 'groups' ? 'Справочник товарных групп пока пуст' : active === 'processes' ? 'Бизнес-процессы ещё не добавлены' : 'Ничего не найдено'}</b><span>{['groups', 'processes'].includes(active) ? 'Добавь первую карточку через форму. Она сохранится в этом браузере.' : 'Измени поисковый запрос или фильтр.'}</span>{['groups', 'processes'].includes(active) && (!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)) && <button className="secondary-button" onClick={openNewDocumentModal}>Добавить первую запись</button>}</div>}</div>
          </>}
          <footer className="footer"><span>TEKSHER HUB <i>·</i> Информационная платформа оператора маркировки</span><span>Версия 0.3 · 2026</span></footer>
        </div>
      </main>

      {showGlobalSearch && <div className="global-search-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowGlobalSearch(false) }}>
        <section className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
          <div className="global-search-heading"><div><div className="section-kicker">TEKSHER HUB / ПОИСК</div><h2 id="global-search-title">Найти материал</h2></div><button className="icon-button" type="button" onClick={() => setShowGlobalSearch(false)} aria-label="Закрыть поиск"><X size={18}/></button></div>
          <label className="global-search-input"><Search size={18}/><input autoFocus value={globalSearchQuery} onChange={event => { setGlobalSearchQuery(event.target.value); setGlobalSearchActiveIndex(0) }} onKeyDown={event => { if (event.key === 'ArrowDown' && globalSearchResults.length) { event.preventDefault(); setGlobalSearchActiveIndex(index => (index + 1) % globalSearchResults.length) } else if (event.key === 'ArrowUp' && globalSearchResults.length) { event.preventDefault(); setGlobalSearchActiveIndex(index => (index - 1 + globalSearchResults.length) % globalSearchResults.length) } else if (event.key === 'Enter' && globalSearchResults.length) { event.preventDefault(); openGlobalSearchResult(globalSearchResults[Math.min(globalSearchActiveIndex, globalSearchResults.length - 1)]) } }} placeholder="Название, номер, инструкция или ключевые слова…" /><kbd>ESC</kbd></label>
          <div className="global-search-helper">Введите минимум 2 символа. Поиск доступен из любого раздела.</div>
          <div className="global-search-results" aria-live="polite">
            {!globalSearchQuery.trim() && <div className="global-search-prompt"><Search size={22}/><b>Поиск по всей базе знаний</b><span>Можно искать материалы из любого контура: РФ, КР и ЕАЭС.</span><small>Быстрый вызов: Ctrl K или /</small></div>}
            {globalSearchQuery.trim().length === 1 && <div className="global-search-message">Введите ещё хотя бы один символ.</div>}
            {globalSearchLoading && <div className="global-search-message"><RefreshCw size={16} className="spin"/> Ищем материалы…</div>}
            {globalSearchError && <div className="global-search-message error"><CircleHelp size={16}/>{globalSearchError}</div>}
            {!globalSearchLoading && !globalSearchError && globalSearchQuery.trim().length >= 2 && globalSearchResults.length === 0 && <div className="global-search-message">Ничего не найдено. Попробуйте другое название или ключевое слово.</div>}
            {globalSearchResults.map((doc, index) => <button className={'global-search-result ' + (globalSearchActiveIndex === index ? 'active' : '')} type="button" role="option" aria-selected={globalSearchActiveIndex === index} key={doc.id} onMouseEnter={() => setGlobalSearchActiveIndex(index)} onClick={() => openGlobalSearchResult(doc)}>
              <span className={'global-search-result-icon ' + (isMzkmCatalogDocument(doc) ? 'ru' : (jurisdictions[doc.jurisdiction]?.className || ''))}><FileText size={17}/></span>
              <span className="global-search-result-copy"><b>{doc.title}</b><small>{isMzkmCatalogDocument(doc) ? 'МЗКМ' : (jurisdictions[doc.jurisdiction]?.short || 'Материал')} · {doc.kind || 'Документ'}{doc.documentNumber ? ' · № ' + doc.documentNumber : ''}</small><span>{doc.description || 'Без краткого описания'}</span></span>
              <ArrowUpRight size={16} className="global-search-result-arrow"/>
            </button>)}
          </div>
          <div className="global-search-footer"><span><kbd>Enter</kbd> Открыть материал</span><span>Все результаты ведут к карточке документа</span></div>
        </section>
      </div>}
      {showCreateModal && <CreateDocumentModal initialDoc={editingDoc} documents={documents.filter(item => !item.isDemo && item.id !== editingDoc?.id)} onClose={closeDocumentModal} onSubmit={handleSaveDocument} apiEnabled={API_ENABLED} saving={isSaving} error={actionError} />}
      {showImportModal && <DocumentImportModal onClose={() => setShowImportModal(false)} onImport={handleImportDocuments} />}
      {monitorModalOpen && <MonitorModal onClose={() => setMonitorModalOpen(false)} onSubmit={handleSaveMonitor} saving={isSaving} error={actionError} />}
      {userModalOpen && <UserModal onClose={() => setUserModalOpen(false)} onSubmit={handleSaveUser} saving={isSaving} error={actionError} />}
      {passwordResetTarget && <UserPasswordModal user={passwordResetTarget} onClose={() => setPasswordResetTarget(null)} onSubmit={handleResetPassword} saving={isSaving} error={actionError} />}
      {confirmDialog && <ConfirmActionModal {...confirmDialog} onClose={() => setConfirmDialog(null)} onConfirm={async () => { const action = confirmDialog?.onConfirm; if (action) await action() }} />}
      {reviewDialog && <ReviewSourceModal documentTitle={reviewDialog.documentTitle} status={reviewDialog.status} note={reviewNote} onNoteChange={setReviewNote} onClose={() => { if (!isReviewSaving) setReviewDialog(null) }} onSubmit={handleSubmitReview} saving={isReviewSaving} error={actionError} />}
    </div>
  )
}



function ConfirmActionModal({ title, message, confirmLabel = 'Подтвердить', tone = 'primary', onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape' && !busy) onClose?.() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])
  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm?.()
      onClose?.()
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop action-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose?.() }}>
    <section className="action-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="action-confirm-title" aria-describedby="action-confirm-message">
      <button type="button" className="icon-button action-modal-close" onClick={onClose} disabled={busy} aria-label="Закрыть"><X size={18}/></button>
      <div className={'action-modal-symbol ' + (tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'normal')}>
        {tone === 'danger' ? <Trash2 size={22}/> : tone === 'warning' ? <ShieldCheck size={22}/> : <CircleHelp size={22}/>}
      </div>
      <h2 id="action-confirm-title">{title}</h2>
      <p id="action-confirm-message">{message}</p>
      <div className="modal-actions action-confirm-buttons">
        <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Отмена</button>
        <button type="button" className={tone === 'danger' ? 'danger-button' : 'primary-button'} onClick={handleConfirm} disabled={busy}>
          {busy ? <RefreshCw size={15} className="spin"/> : tone === 'danger' ? <Trash2 size={15}/> : <CheckCircle2 size={15}/>}
          {busy ? 'Выполняется…' : confirmLabel}
        </button>
      </div>
    </section>
  </div>
}

function ReviewSourceModal({ documentTitle, status, note, onNoteChange, onClose, onSubmit, saving, error }) {
  const reviewing = status === 'UNDER_REVIEW'
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape' && !saving) onClose?.() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saving, onClose])
  return <div className="modal-backdrop action-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose?.() }}>
    <section className="action-confirm-modal review-source-modal" role="dialog" aria-modal="true" aria-labelledby="review-source-title">
      <button type="button" className="icon-button action-modal-close" onClick={onClose} disabled={saving} aria-label="Закрыть"><X size={18}/></button>
      <div className={'action-modal-symbol ' + (reviewing ? 'warning' : 'normal')}>{reviewing ? <RefreshCw size={22}/> : <CheckCircle2 size={22}/>}</div>
      <div className="section-kicker">КОНТРОЛЬ КАЧЕСТВА БАЗЫ</div>
      <h2 id="review-source-title">{reviewing ? 'Отправить на повторную проверку?' : 'Подтвердить актуальность источника?'}</h2>
      <p className="review-source-document">{documentTitle}</p>
      <label className="review-source-note-field">
        <span>Комментарий проверки <em>необязательно</em></span>
        <textarea autoFocus maxLength={1000} rows={4} value={note} onChange={event => onNoteChange(event.target.value)} placeholder="Что проверено: редакция акта, даты действия, товарная группа, ссылка на первоисточник…" />
        <small>Комментарий сохраняется вместе со статусом проверки и помогает коллегам понять, что именно было проверено.</small>
      </label>
      {error && <div className="feedback feedback-error review-modal-error" role="alert"><CircleHelp size={15}/><span>{error}</span></div>}
      <div className="modal-actions action-confirm-buttons">
        <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Отмена</button>
        <button type="button" className="primary-button" onClick={onSubmit} disabled={saving}>
          {saving ? <RefreshCw size={15} className="spin"/> : reviewing ? <RefreshCw size={15}/> : <CheckCircle2 size={15}/>}
          {saving ? 'Сохраняем…' : reviewing ? 'Отправить на проверку' : 'Сохранить проверку'}
        </button>
      </div>
    </section>
  </div>
}

const FRESHNESS_REVIEW_DAYS = 180

function getFreshnessFlags(doc) {
  const flags = []
  const status = doc.status || ''
  const statusLabel = doc.statusLabel || ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (status === 'ARCHIVED' || statusLabel === 'В архиве') return flags

  if (doc.effectiveUntil) {
    const dateOnly = String(doc.effectiveUntil).slice(0, 10)
    const endDate = new Date(dateOnly + 'T00:00:00')
    if (!Number.isNaN(endDate.getTime()) && endDate < today) {
      flags.push('Дата «Действует по» уже прошла')
    }
  }
  if (status === 'EXPIRED' || statusLabel === 'Срок действия истёк') {
    flags.push('Статус отмечен как истёкший')
  }
  if (!doc.sourceUrl || !String(doc.sourceUrl).trim()) {
    flags.push('Не указан официальный источник')
  }
  if (status === 'UNDER_REVIEW' || statusLabel === 'На проверке') {
    flags.push('Ожидает проверки')
  } else if (status === 'DRAFT' || statusLabel === 'Черновик' || !status) {
    flags.push('Черновик / статус не подтверждён')
  }

  if (!doc.officialSourceCheckedAt) {
    flags.push('Нет даты подтверждения актуальности')
  } else {
    const checkedAt = new Date(doc.officialSourceCheckedAt)
    if (!Number.isNaN(checkedAt.getTime())) {
      const ageDays = Math.floor((today.getTime() - new Date(checkedAt.getFullYear(), checkedAt.getMonth(), checkedAt.getDate()).getTime()) / 86400000)
      if (ageDays >= FRESHNESS_REVIEW_DAYS) flags.push('Проверка была ' + ageDays + ' дн. назад')
    } else {
      flags.push('Не удалось определить дату проверки')
    }
  }
  return [...new Set(flags)]
}

function freshnessPriority(flags) {
  if (flags.some(flag => flag.includes('Дата «Действует по»') || flag.includes('отмечен как истёкший'))) return 0
  if (flags.includes('Не указан официальный источник')) return 1
  if (flags.includes('Ожидает проверки') || flags.includes('Черновик / статус не подтверждён')) return 2
  if (flags.includes('Нет даты подтверждения актуальности')) return 3
  return 4
}

function FreshnessReviewPanel({ documents, apiEnabled, onOpenDocument }) {
  const records = documents.filter(doc => !doc.isDemo)
  const items = records
    .map(doc => ({ doc, flags: getFreshnessFlags(doc) }))
    .filter(item => item.flags.length > 0)
    .sort((a, b) => freshnessPriority(a.flags) - freshnessPriority(b.flags)
      || new Date(b.doc.updatedAt || b.doc.createdAt || 0) - new Date(a.doc.updatedAt || a.doc.createdAt || 0))
  const dateWarnings = items.filter(item => item.flags.some(flag => flag.includes('Дата «Действует по»') || flag.includes('отмечен как истёкший'))).length
  const missingSources = items.filter(item => item.flags.includes('Не указан официальный источник')).length
  const unconfirmed = items.filter(item => item.flags.includes('Нет даты подтверждения актуальности')).length

  return <div className="workbench-panel workbench-check-panel">
    <div className="workbench-panel-title">
      <span className="workbench-panel-icon amber"><RefreshCw size={17}/></span>
      <div><b>Контроль актуальности</b><small>{records.length ? items.length + ' карточек требуют внимания' : 'Проверка карточек базы'}</small></div>
    </div>
    {records.length > 0 ? <>
      <div className="freshness-metrics">
        <span><b>{dateWarnings}</b><small>Проверить срок</small></span>
        <span><b>{missingSources}</b><small>Без источника</small></span>
        <span><b>{unconfirmed}</b><small>Без подтверждения</small></span>
      </div>
      {items.length ? <div className="freshness-list">
        {items.slice(0, 5).map(({ doc, flags }) => <button className="freshness-item" key={doc.id} type="button" onClick={() => onOpenDocument(doc)} aria-label={'Открыть карточку: ' + doc.title}>
          <span className={'freshness-marker ' + (freshnessPriority(flags) === 0 ? 'urgent' : '')}><CircleHelp size={15}/></span>
          <span className="freshness-item-copy"><b>{doc.title}</b><small>{flags.slice(0, 3).join(' · ')}{flags.length > 3 ? ' · +' + (flags.length - 3) : ''}</small></span>
          <ArrowUpRight size={15}/>
        </button>)}
        {items.length > 5 && <div className="freshness-more">И ещё {items.length - 5} карточек в очереди.</div>}
      </div> : <div className="freshness-empty"><CheckCircle2 size={16}/><span>По контрольным критериям замечаний нет. Это не заменяет проверку официальных источников.</span></div>}
      <button className="secondary-button workbench-review-button" type="button" onClick={() => onOpenDocument(items[0]?.doc)} disabled={!items.length}>
        Открыть первую карточку очереди <ArrowUpRight size={15}/>
      </button>
    </> : <div className="freshness-empty"><LibraryBig size={16}/><span>{apiEnabled ? 'В общей базе пока нет карточек для контроля.' : 'В демо-режиме показаны только примеры. Добавьте реальную карточку, чтобы проверить работу очереди.'}</span></div>}
    <div className="freshness-footnote">Напоминания не являются юридическим заключением. Порог повторной проверки в {FRESHNESS_REVIEW_DAYS} дней – внутренний контрольный ориентир; применимость подтверждается по официальному источнику.</div>
  </div>
}

function KnowledgeCenterSection({ documents, onSelectKind, onOpenAll, onAdd, canAdd }) {
  const categories = [
    { kind: 'Нормативный акт', title: 'Нормативные акты', description: 'Законы, постановления, решения ЕЭК и официальные основания требований.', icon: Landmark, tone: 'purple' },
    { kind: 'Товарная группа', title: 'Товарные группы', description: 'Требования по группам товаров с учётом юрисдикции и периода действия.', icon: Boxes, tone: 'green' },
    { kind: 'Инструкция', title: 'Инструкции и руководства', description: 'Пошаговая работа в МЗКМ, ГАИС МТ и связанных сервисах.', icon: BookOpen, tone: 'blue' },
    { kind: 'Бизнес-процесс', title: 'Бизнес-процессы', description: 'Последовательности действий, роли, входы, результаты и исключения.', icon: Workflow, tone: 'green' },
    { kind: 'Техническая документация', title: 'Техническая документация', description: 'Интеграции, API, обмен данными, ограничения и технические решения.', icon: Layers3, tone: 'purple' },
    { kind: 'Известная ошибка', title: 'Ошибки и решения', description: 'Текст ошибки, причина, диагностика и подтверждённый способ устранения.', icon: CircleHelp, tone: 'amber' },
    { kind: 'Шаблон', title: 'Шаблоны документов', description: 'Формы писем, уведомлений, служебных записок и технических заданий.', icon: FileCheck2, tone: 'blue' },
    { kind: 'Внутренний документ', title: 'Регламенты и внутренние материалы', description: 'Правила работы оператора, инструкции подразделений и рабочие памятки.', icon: FileText, tone: 'green' },
    { kind: 'Обзор', title: 'Обзоры и справочные материалы', description: 'Объяснения, вводные материалы и сводная информация по системам.', icon: LibraryBig, tone: 'amber' },
  ]
  return <section className="knowledge-center">
    <div className="page-heading">
      <div><div className="section-kicker">ЕДИНАЯ БАЗА ЗНАНИЙ</div><h1>Инструкции и рабочие знания</h1><p>Здесь собираются проверенные инструкции, процессы, технические решения, ошибки и шаблоны. Выберите тему, чтобы открыть соответствующие материалы общей базы.</p></div>
      <div className="heading-actions"><span className="record-count">{documents.filter(doc => !doc.isDemo).length} материалов</span>{canAdd && <button className="primary-button" onClick={onAdd}><FilePlus2 size={16}/> Добавить материал</button>}</div>
    </div>
    <div className="knowledge-principle"><ShieldCheck size={19}/><div><b>Одна база – связанные знания</b><span>По возможности у каждого материала должны быть указаны система, юрисдикция, официальный источник или основание, дата проверки и связанные записи. Непроверенные сведения не следует использовать как подтверждённые требования.</span></div></div>
    <div className="knowledge-category-grid">
      {categories.map(({ kind, title, description, icon: Icon, tone }) => {
        const count = documents.filter(doc => doc.kind === kind && !doc.isDemo).length
        return <button className="knowledge-category" key={kind} onClick={() => onSelectKind(kind)}>
          <span className={'knowledge-category-icon ' + tone}><Icon size={21}/></span>
          <span className="knowledge-category-copy"><b>{title}</b><small>{description}</small><em>{count} {count === 1 ? 'материал' : count > 1 && count < 5 ? 'материала' : 'материалов'}</em></span>
          <ArrowUpRight size={17} className="knowledge-category-arrow"/>
        </button>
      })}
    </div>
    <div className="knowledge-bottom-actions"><div><b>Нужен другой материал?</b><span>Откройте общий каталог или добавьте новую карточку в соответствующую категорию.</span></div><button className="secondary-button" onClick={onOpenAll}>Открыть все материалы <ArrowUpRight size={15}/></button></div>
  </section>
}

function ProductGroupsSection({ onOpen, onSearchGroup }) {
  const mzkmGroups = [
    'Обувные товары',
    'Белье постельное, столовое, туалетное и кухонное',
    'Предметы одежды',
    'Духи и туалетная вода',
    'Фотокамеры (кроме кинокамер), фотовспышки и лампы-вспышки',
    'Молочная продукция',
    'Продукты, используемые для кормления животных',
    'Косметика, бытовая химия и товары личной гигиены',
    'Моторные масла, смазочные материалы, тормозные жидкости и антифризы',
    'Игры и игрушки для детей',
  ]
  const internalGroups = [
    {
      name: 'Алкоголь',
      description: 'Национальная внутренняя маркировка Кыргызской Республики. Применимость и способ маркировки проверять по действующим актам КР и официальным методическим правилам.',
      source: 'https://main.teksher.kg/internal-marking.html',
    },
    {
      name: 'Табак',
      description: 'Национальная внутренняя маркировка Кыргызской Республики. Для конкретного вида продукции проверять действующие требования и методические правила.',
      source: 'https://main.teksher.kg/internal-marking.html',
    },
  ]

  const [tnvedCatalog, setTnvedCatalog] = useState([])
  const [tnvedLoading, setTnvedLoading] = useState(true)
  const [tnvedLoadError, setTnvedLoadError] = useState('')
  const [tnvedMode, setTnvedMode] = useState('code')
  const [tnvedScope, setTnvedScope] = useState('ALL')
  const [tnvedInput, setTnvedInput] = useState('')
  const [tnvedSubmitted, setTnvedSubmitted] = useState(null)
  const [tnvedGroupFilter, setTnvedGroupFilter] = useState('')
  const [tnvedValidation, setTnvedValidation] = useState('')
  const [tnvedPage, setTnvedPage] = useState(0)
  const [showInternalGskp, setShowInternalGskp] = useState('')

  useEffect(() => {
    let cancelled = false
    loadTnvedCatalog()
      .then(rows => {
        if (!cancelled) {
          setTnvedCatalog(Array.isArray(rows) ? rows : [])
          setTnvedLoadError('')
          setTnvedLoading(false)
        }
      })
      .catch(error => {
        if (!cancelled) {
          setTnvedLoadError(error?.message || 'Не удалось загрузить справочник ТН ВЭД.')
          setTnvedLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const tnvedGroupCounts = useMemo(() => {
    const counts = new Map()
    tnvedCatalog.forEach(row => {
      const key = row.t + '|' + row.g
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [tnvedCatalog])

  const selectTnvedGroup = (groupName, scope = 'MZKM') => {
    setTnvedGroupFilter(groupName)
    setTnvedScope(scope)
    setTnvedMode('code')
    setTnvedInput('')
    setTnvedSubmitted('__GROUP__')
    setTnvedValidation('')
    setTnvedPage(0)
    document.getElementById('tnved-checker')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearTnvedFilters = () => {
    setTnvedGroupFilter('')
    setTnvedScope('ALL')
    setTnvedInput('')
    setTnvedSubmitted(null)
    setTnvedValidation('')
    setTnvedPage(0)
    setShowInternalGskp('')
  }

  const handleTnvedSubmit = event => {
    event?.preventDefault()
    const raw = tnvedInput.trim()
    if (!raw) {
      setTnvedValidation(tnvedMode === 'code' ? 'Введите код ТН ВЭД: от 4 до 10 цифр.' : 'Введите название товара или его часть.')
      return
    }
    if (tnvedMode === 'code') {
      const normalized = raw.replace(/[.\s-]/g, '')
      if (!/^\d{4,10}$/.test(normalized)) {
        setTnvedValidation('Для поиска по ТН ВЭД введите от 4 до 10 цифр без букв.')
        return
      }
      setTnvedInput(normalized)
      setTnvedSubmitted(normalized)
    } else {
      if (raw.length < 2) {
        setTnvedValidation('Для поиска по названию введите минимум 2 символа.')
        return
      }
      setTnvedSubmitted(raw)
    }
    setTnvedGroupFilter('')
    setTnvedValidation('')
    setTnvedPage(0)
    setShowInternalGskp('')
  }

  const tnvedResults = useMemo(() => {
    if (!tnvedCatalog.length || tnvedSubmitted === null) return []
    const query = String(tnvedSubmitted === '__GROUP__' ? '' : tnvedSubmitted).trim().toLocaleLowerCase('ru-RU')
    return tnvedCatalog.filter(row => {
      if (tnvedScope === 'MZKM' && row.t !== 'MZKM') return false
      if (tnvedScope === 'INTERNAL' && row.t !== 'INTERNAL') return false
      if (tnvedGroupFilter && row.g !== tnvedGroupFilter) return false
      if (tnvedSubmitted === '__GROUP__') return true
      if (tnvedMode === 'code') return String(row.c || '').startsWith(query)
      const haystack = [row.n, row.g, row.c, row.p, row.gc, row.gn].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU')
      return haystack.includes(query)
    }).sort((a, b) => String(a.c).localeCompare(String(b.c)) || String(a.g).localeCompare(String(b.g), 'ru'))
  }, [tnvedCatalog, tnvedSubmitted, tnvedMode, tnvedScope, tnvedGroupFilter])

  const tnvedPageSize = 25
  const tnvedPageCount = Math.max(1, Math.ceil(tnvedResults.length / tnvedPageSize))
  const tnvedVisibleResults = tnvedResults.slice(tnvedPage * tnvedPageSize, (tnvedPage + 1) * tnvedPageSize)
  const getCount = (group, scope) => tnvedGroupCounts.get(scope + '|' + group) || 0

  return <div className="product-groups-page">
    <div className="page-heading">
      <div>
        <div className="section-kicker">СПРАВОЧНИК / МАРКИРОВКА ТОВАРОВ</div>
        <h1>Товарные группы</h1>
        <p>Единые группы МЗКМ, национальные товарные группы КР и поиск кодов ТН ВЭД по предоставленному перечню.</p>
      </div>
      <div className="record-count">10 групп МЗКМ · 2 внутренние</div>
    </div>

    <section className="tnved-checker" id="tnved-checker" aria-labelledby="tnved-checker-title">
      <div className="tnved-checker-header">
        <div className="tnved-checker-icon"><Search size={20}/></div>
        <div className="tnved-checker-heading">
          <div className="section-kicker">ПОИСК ПО СПРАВОЧНИКУ</div>
          <h2 id="tnved-checker-title">Проверка кодов ТН ВЭД</h2>
          <p>Проверьте, встречается ли код или товар в предоставленном Excel, и посмотрите, к какой группе он отнесён.</p>
        </div>
        <div className="tnved-catalog-counter">
          <strong>{tnvedLoading ? '…' : tnvedCatalog.length.toLocaleString('ru-RU')}</strong>
          <span>записей</span>
        </div>
      </div>

      <div className="tnved-scope-switch" role="group" aria-label="Источник списка для поиска">
        {[
          { value: 'ALL', label: 'Все списки' },
          { value: 'MZKM', label: 'МЗКМ' },
          { value: 'INTERNAL', label: 'Внутренняя маркировка КР' },
        ].map(option => <button key={option.value} type="button" className={tnvedScope === option.value ? 'active' : ''} onClick={() => { setTnvedScope(option.value); setTnvedPage(0); setShowInternalGskp('') }}>{option.label}</button>)}
      </div>

      <div className="tnved-search-tabs" role="tablist" aria-label="Тип поиска">
        <button type="button" role="tab" aria-selected={tnvedMode === 'code'} className={tnvedMode === 'code' ? 'active' : ''} onClick={() => { setTnvedMode('code'); setTnvedInput(''); setTnvedSubmitted(null); setTnvedValidation('') }}>
          <span>ТН ВЭД</span><small>Поиск по коду</small>
        </button>
        <button type="button" role="tab" aria-selected={tnvedMode === 'name'} className={tnvedMode === 'name' ? 'active' : ''} onClick={() => { setTnvedMode('name'); setTnvedInput(''); setTnvedSubmitted(null); setTnvedValidation('') }}>
          <span>Название товара</span><small>Поиск по описанию</small>
        </button>
      </div>

      <form className="tnved-search-form" onSubmit={handleTnvedSubmit}>
        <label htmlFor="tnved-search-input">{tnvedMode === 'code' ? 'Введите код ТН ВЭД или его первые цифры' : 'Введите название товара или часть наименования'}</label>
        <div className="tnved-search-control">
          <input
            id="tnved-search-input"
            value={tnvedInput}
            onChange={event => { setTnvedInput(event.target.value); setTnvedValidation('') }}
            placeholder={tnvedMode === 'code' ? 'Например, 950300 или 9503005500' : 'Например, шампунь, обувь, детская игрушка'}
            inputMode={tnvedMode === 'code' ? 'numeric' : 'search'}
            maxLength={tnvedMode === 'code' ? 15 : 160}
            aria-invalid={Boolean(tnvedValidation)}
          />
          <button type="submit" className="primary-button" disabled={tnvedLoading}><Search size={16}/> Проверить</button>
        </div>
        {tnvedValidation && <div className="tnved-validation" role="alert">{tnvedValidation}</div>}
        {tnvedMode === 'code' && <p className="tnved-input-help">Допускается ввод от 4 до 10 цифр. Поиск выполняется по началу кода.</p>}
      </form>

      {tnvedLoading && <div className="tnved-loading"><RefreshCw size={17} className="spin"/> Загружаем справочник кодов из Excel…</div>}
      {tnvedLoadError && <div className="feedback feedback-error tnved-load-error" role="alert">{tnvedLoadError}</div>}

      {tnvedSubmitted !== null && !tnvedLoading && !tnvedLoadError && <section className="tnved-results" aria-live="polite">
        <div className="tnved-results-heading">
          <div>
            <h3>{tnvedGroupFilter ? 'Коды товарной группы' : 'Результаты проверки'}</h3>
            <p>{tnvedGroupFilter ? tnvedGroupFilter : (tnvedMode === 'code' ? 'Код начинается с ' + tnvedSubmitted : 'Поиск по названию: «' + tnvedSubmitted + '»')}</p>
          </div>
          <div className="tnved-result-actions">
            <span className="record-count">{tnvedResults.length.toLocaleString('ru-RU')} записей</span>
            <button type="button" className="tnved-clear-button" onClick={clearTnvedFilters}><X size={14}/> Сбросить</button>
          </div>
        </div>

        {tnvedResults.length === 0
          ? <div className="tnved-empty"><Search size={22}/><b>Совпадений не найдено</b><span>Код или название не встретились в выбранном перечне Excel. Это не означает, что товар не подлежит маркировке.</span></div>
          : <>
            <div className="tnved-table-wrap">
              <table className="tnved-table">
                <thead><tr><th>Код ТН ВЭД</th><th>Наименование товара</th><th>Товарная группа</th><th>Список</th><th>ГСКП</th></tr></thead>
                <tbody>
                  {tnvedVisibleResults.map((row, index) => <tr key={row.t + '|' + row.c + '|' + row.g + '|' + row.r + '|' + index}>
                    <td><button type="button" className="tnved-code-link" onClick={() => { setTnvedMode('code'); setTnvedInput(row.c); setTnvedSubmitted(row.c); setTnvedGroupFilter(''); setTnvedPage(0) }}>{row.c}</button></td>
                    <td className="tnved-product-name">{row.n}</td>
                    <td>{row.g}</td>
                    <td><span className={'tnved-list-badge ' + (row.t === 'INTERNAL' ? 'internal' : 'mzkm')}>{row.t === 'INTERNAL' ? 'Внутренняя КР' : 'МЗКМ'}</span></td>
                    <td>{row.t === 'INTERNAL' && (row.gc || row.gn) ? <button type="button" className="tnved-gskp-toggle" onClick={() => setShowInternalGskp(showInternalGskp === row.t + row.c ? '' : row.t + row.c)}>{showInternalGskp === row.t + row.c ? 'Скрыть' : 'Показать'}</button> : '—'}
                      {row.t === 'INTERNAL' && showInternalGskp === row.t + row.c && <div className="tnved-gskp-details"><b>ГСКП:</b><span>{row.gc || '—'}</span><b>Наименование ГСКП:</b><span>{row.gn || '—'}</span></div>}
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            {tnvedResults.length > tnvedPageSize && <div className="tnved-pagination">
              <button type="button" className="secondary-button" disabled={tnvedPage === 0} onClick={() => setTnvedPage(page => Math.max(0, page - 1))}>Назад</button>
              <span>Страница {tnvedPage + 1} из {tnvedPageCount}</span>
              <button type="button" className="secondary-button" disabled={tnvedPage + 1 >= tnvedPageCount} onClick={() => setTnvedPage(page => Math.min(tnvedPageCount - 1, page + 1))}>Дальше</button>
            </div>}
          </>
        }
      </section>}

      <div className="tnved-advisory-note"><CircleHelp size={16}/><span>Справочник основан на файле «Список ТН ВЭД.xlsx». Совпадение означает только то, что код присутствует в переданном перечне и отнесён в файле к указанной группе. Проверка не подтверждает юридическую обязательность маркировки. Для решения сверяйте полный код, описание товара, исключения и актуальный нормативный акт.</span></div>
    </section>

    <section className="mzkm-product-group-section">
      <div className="mzkm-section-heading">
        <div className="mzkm-section-icon"><Boxes size={19}/></div>
        <div>
          <div className="section-kicker">РУКОВОДСТВО МЗКМ v2.1 · 09.10.2026</div>
          <h2>Товарные группы МЗКМ</h2>
          <p>Единый список с титульной страницы руководства. Нажмите «Коды ТН ВЭД», чтобы открыть соответствующие строки из Excel.</p>
        </div>
        <span className="record-count">10 групп</span>
      </div>
      <section className="mzkm-groups-grid" aria-label="Единый список товарных групп МЗКМ v2.1">
        {mzkmGroups.map((name, index) => <article className="mzkm-group-card mzkm-group-card-interactive" key={name}>
          <div className="mzkm-group-number">{String(index + 1).padStart(2, '0')}</div>
          <div className="mzkm-group-copy">
            <h3>{name}</h3>
            <p>{getCount(name, 'MZKM')} кодов из Excel · МЗКМ v2.1</p>
            <div className="tnved-group-actions">
              <button type="button" className="tnved-group-button primary" onClick={() => selectTnvedGroup(name, 'MZKM')}>Коды ТН ВЭД ({getCount(name, 'MZKM')})</button>
              <button type="button" className="tnved-group-button" onClick={() => onSearchGroup(name)}>Материалы</button>
            </div>
          </div>
        </article>)}
      </section>
      <article className="tnved-supplemental-group">
        <div className="tnved-supplemental-copy"><b>Бритвы</b><span>{getCount('Бритвы', 'MZKM')} кода в Excel. Группа есть в файле, но отсутствует в перечне 10 групп на титульной странице руководства МЗКМ v2.1.</span></div>
        <button type="button" className="tnved-group-button primary" onClick={() => selectTnvedGroup('Бритвы', 'MZKM')}>Показать коды</button>
      </article>
      <div className="notice mzkm-groups-version-note">
        <CircleHelp size={17}/>
        <div>
          <b>Примечание к руководству</b>
          <span>«Бритвы» описаны в разделе атрибутов v2.1, но отсутствуют в списке из десяти групп на титульной странице. В Excel для них есть отдельные четыре кода; поэтому они доступны в проверке как дополнительный список, а не включены в основной список десяти групп.</span>
        </div>
      </div>
    </section>

    <section className="internal-product-group-section">
      <div className="mzkm-section-heading">
        <div className="mzkm-section-icon internal"><ShieldCheck size={19}/></div>
        <div>
          <div className="section-kicker">КЫРГЫЗСКАЯ РЕСПУБЛИКА · НАЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ</div>
          <h2>Товарные группы внутренней маркировки</h2>
          <p>По официальному перечню и приложенному Excel внутренние коды представлены для алкоголя и табака.</p>
        </div>
        <span className="record-count">2 группы</span>
      </div>
      <section className="internal-groups-grid" aria-label="Товарные группы внутренней маркировки Кыргызстана">
        {internalGroups.map((group, index) => <article className="internal-group-card" key={group.name}>
          <div className="internal-group-badge">{String(index + 1).padStart(2, '0')}</div>
          <div className="internal-group-copy">
            <h3>{group.name}</h3>
            <p>{group.description}</p>
            <div className="internal-group-actions">
              <button type="button" className="internal-group-find" onClick={() => onSearchGroup(group.name)}><Search size={13}/> Найти материалы</button>
              <button type="button" className="internal-group-find" onClick={() => selectTnvedGroup(group.name, 'INTERNAL')}>Коды ТН ВЭД ({getCount(group.name, 'INTERNAL')})</button>
              <a href={group.source} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Официальная страница</a>
            </div>
          </div>
        </article>)}
      </section>
      <div className="notice internal-ukm-note">
        <CircleHelp size={17}/>
        <div>
          <b>Отдельный национальный режим: упакованная вода и УКМ</b>
          <span>Кабинет Министров КР отдельно установил режим учетно-контрольных марок для упакованной воды (ТН ВЭД 2201). В приложенном Excel отдельного списка внутренней маркировки для воды нет; здесь не добавляем коды из внешнего перечня к внутреннему списку без основания.</span>
          <div className="internal-ukm-actions">
            <a href="https://www.gov.kg/ru/npa/s/4687" target="_blank" rel="noreferrer">Постановление КМ КР № 385 от 01.07.2025 <ExternalLink size={13}/></a>
            <button type="button" className="internal-group-find" onClick={() => selectTnvedGroup('Упакованная вода', 'INTERNAL')}><Search size={13}/> Найти код воды во внутреннем списке</button>
          </div>
        </div>
      </div>
    </section>

    <section className="contour-reference mzkm-groups-sources">
      <div className="section-kicker">ИСТОЧНИКИ И ПРОВЕРКА</div>
      <h2>Источники справочника</h2>
      <p className="mzkm-groups-source-note">Справочник формируется из файла «Список ТН ВЭД.xlsx»: лист «Полный список ТН ВЭД внешки» для МЗКМ и лист «Полный список ТН ВЭД внутренней» для алкоголя/табака. Дубликаты по одинаковому коду и описанию сгруппированы; разные связи с ГСКП сохранены. Файл загружен пользователем, дата актуальности исходного перечня в нём отдельно не подтверждена.</p>
      <div className="reference-links">
        <a href="https://xn--80ajghhoc2aj1c8b.xn--p1ai/checking_codes/" target="_blank" rel="noreferrer"><b>Пример проверки кода</b><span>Принцип поиска по коду ТН ВЭД или наименованию</span><ExternalLink size={16}/></a>
        <a href="https://main.teksher.kg/news.html" target="_blank" rel="noreferrer"><b>Новости «Текшер»</b><span>Опубликованные оператором перечни и изменения</span><ExternalLink size={16}/></a>
        <a href="https://cbd.minjust.gov.kg/" target="_blank" rel="noreferrer"><b>Правовая база КР</b><span>Нормативные акты Кыргызской Республики</span><ExternalLink size={16}/></a>
      </div>
    </section>
  </div>
}

function JurisdictionCard({ code, title, subtitle, description, count, onClick }) {
  const item = jurisdictions[code]
  return <button className={`jurisdiction-card ${item.className}`} onClick={onClick}>
    <div className="jurisdiction-top"><span className="flag">{item.flag}</span><span className="jurisdiction-code">{item.short}</span></div>
    <h3>{title}</h3><div className="jurisdiction-subtitle">{subtitle}</div><p>{description}</p>
    <div className="jurisdiction-bottom"><span>{count}</span><span className="round-arrow"><ArrowUpRight size={17} /></span></div>
  </button>
}

function DocumentRow({ doc, onClick }) {
  const jurisdiction = jurisdictions[doc.jurisdiction] || jurisdictions.EAEU
  const isMzkm = isMzkmCatalogDocument(doc)
  const catalogLabel = isMzkm ? 'МЗКМ' : jurisdiction.short
  const catalogClass = isMzkm ? 'ru' : jurisdiction.className
  return <button className="document-row" onClick={onClick}>
    <span className={`doc-icon ${catalogClass}`}><FileText size={20} /></span>
    <span className="doc-main"><b>{doc.title}</b><span>{doc.description}</span>{doc.matchedInAttachment && <span className="search-match-origin"><Paperclip size={12}/>Найдено в приложенном файле</span>}<small><span className={`tag ${catalogClass}`}>{catalogLabel}</span>{doc.documentNumber && <span>№ {doc.documentNumber}</span>}<span>{doc.kind}</span><span>·</span><span>{doc.area}</span></small></span>
    <span className={`doc-status ${statusClass(doc)}`}>{doc.statusLabel || doc.status}</span><ArrowDownRight size={17} className="doc-arrow" />
  </button>
}

function statusClass(doc) {
  const status = doc.status || ''
  if (status === 'ACTIVE' || status === 'Действует' || doc.statusLabel === 'Действует') return 'source-status'
  if (status === 'EXPIRED' || status === 'Срок действия истёк' || doc.statusLabel === 'Срок действия истёк') return 'expired-status'
  if (status === 'ARCHIVED' || status === 'В архиве' || doc.statusLabel === 'В архиве') return 'archived-status'
  if (status === 'UNDER_REVIEW' || status === 'На проверке' || doc.statusLabel === 'На проверке') return 'review-status'
  return doc.isDemo ? 'demo-status' : 'draft-status'
}

function formatDate(value) {
  if (!value) return 'Не указана'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Не указана' : date.toLocaleDateString('ru-RU')
}

function buildWikiBlocks(content) {
  const blocks = []
  let paragraph = []
  let pendingList = null
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
      paragraph = []
    }
  }
  const flushList = () => {
    if (pendingList) {
      blocks.push(pendingList)
      pendingList = null
    }
  }
  const slugify = value => String(value || '').toLocaleLowerCase('ru-RU')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || 'section'

  String(content || '').replace(/\r/g, '').split('\n').forEach((rawLine, lineIndex) => {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      return
    }
    const markdownHeading = line.match(/^#{1,3}\s+(.+)$/)
    const colonHeading = !/^\d+[.)]\s/.test(line) && line.length <= 90 && /:$/.test(line)
    if (markdownHeading || colonHeading) {
      flushParagraph()
      flushList()
      const title = (markdownHeading ? markdownHeading[1] : line).replace(/:$/, '').trim()
      blocks.push({ type: 'heading', title, id: 'wiki-section-' + lineIndex + '-' + slugify(title) })
      return
    }
    const listMatch = line.match(/^(\d+[.)]|[-*•])\s+(.*)$/)
    if (listMatch) {
      flushParagraph()
      const ordered = /^\d/.test(listMatch[1])
      if (!pendingList || pendingList.ordered !== ordered) {
        flushList()
        pendingList = { type: 'list', ordered, items: [] }
      }
      pendingList.items.push(listMatch[2])
      return
    }
    flushList()
    paragraph.push(line)
  })
  flushParagraph()
  flushList()
  return blocks
}

function DocumentDetail({ doc, onBack, onEdit, onDelete, canEdit, canDelete, canReview, canReindex, canUploadFiles, files = [], versions = [], documents = [], onOpenRelated, onDownload, onUploadFile, uploadingFile, onReview, onReindexFile, reindexingFileId }) {
  const jurisdiction = jurisdictions[doc.jurisdiction] || { label: doc.jurisdiction || 'Не указана', short: doc.jurisdiction || '—', flag: '🌐', className: 'eaeu' }
  const isMzkm = isMzkmCatalogDocument(doc)
  const catalogClass = isMzkm ? 'ru' : jurisdiction.className
  const catalogLabel = isMzkm ? 'МЗКМ · материалы оператора КР' : jurisdiction.label
  const catalogShort = isMzkm ? 'МЗКМ' : jurisdiction.short
  const statusLabel = doc.statusLabel || doc.status || 'Черновик'
  const attachmentInputRef = useRef(null)
  const [copyMessage, setCopyMessage] = useState('')
  const wikiBlocks = useMemo(() => buildWikiBlocks(doc.content), [doc.content])
  const articleHeadings = wikiBlocks.filter(block => block.type === 'heading')
  const readingMinutes = Math.max(1, Math.ceil(String(doc.content || doc.description || '').split(/\s+/).filter(Boolean).length / 200))
  const relatedDocs = (doc.relatedDocumentIds || []).map(id => documents.find(item => item.id === id)).filter(Boolean)

  const copyArticleLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyMessage('Ссылка скопирована')
    } catch {
      setCopyMessage('Не удалось скопировать ссылку в этом браузере')
    }
  }
  const handleAttachmentChange = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file && onUploadFile) await onUploadFile(file)
  }

  const scrollToArticleSection = (event, id) => {
    event.preventDefault()
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const staticToc = [
    { id: 'wiki-overview', label: 'Краткое содержание' },
    ...(doc.content ? [{ id: 'wiki-content', label: 'Содержание материала' }] : []),
    { id: 'wiki-details', label: 'Сведения о материале' },
    { id: 'wiki-source', label: 'Источники и проверка' },
    ...(relatedDocs.length ? [{ id: 'wiki-related', label: 'Связанные материалы' }] : []),
    ...(!doc.isDemo ? [{ id: 'wiki-files', label: 'Документы и вложения' }, { id: 'wiki-history', label: 'История редакций' }] : []),
  ]

  return <section className="detail-page wiki-detail-page">
    <div className="wiki-toolbar">
      <button className="back-button" onClick={onBack}><ArrowUpRight className="wiki-back-arrow" size={15}/> Назад к каталогу</button>
      <div className="wiki-toolbar-actions">
        <button type="button" className="secondary-button wiki-print-button" onClick={() => window.print()}><Printer size={14}/> Печать</button>
        <button type="button" className="secondary-button wiki-copy-button" onClick={copyArticleLink}><Copy size={14}/>{copyMessage === 'Ссылка скопирована' ? 'Скопировано' : 'Скопировать ссылку'}</button>
        {copyMessage && <span className="wiki-copy-status" role="status">{copyMessage}</span>}
      </div>
    </div>

    <article className="detail-card wiki-article">
      <header className="wiki-article-header">
        <div className="wiki-article-labels">
          <span className={'tag ' + catalogClass}>{isMzkm ? <Boxes size={13} /> : jurisdiction.flag} {catalogLabel}</span>
          <span className={'status-pill ' + statusClass(doc)}>{statusLabel}</span>
          {doc.isDemo && <span className="wiki-demo-label">Демонстрационная запись</span>}
        </div>
        <div className="wiki-article-title-row">
          <div className="wiki-article-title-copy">
            <div className="section-kicker">TEKSHER HUB / ВНУТРЕННЯЯ ЭНЦИКЛОПЕДИЯ</div>
            <h1>{doc.title}</h1>
            <p className="wiki-article-subtitle">{catalogShort} · {doc.kind || 'Материал'}{doc.documentNumber ? ' · № ' + doc.documentNumber : ''}{doc.area ? ' · ' + doc.area : ''}{doc.content ? ' · около ' + readingMinutes + ' мин чтения' : ''}</p>
          </div>
          <div className="wiki-article-mark"><BookOpen size={29}/></div>
        </div>
        <div className="wiki-article-actions">
          {!doc.isDemo && canEdit && <button type="button" className="secondary-button" onClick={onEdit}><Pencil size={14}/> Редактировать</button>}
          {!doc.isDemo && canDelete && <button type="button" className="danger-button" onClick={onDelete}><Trash2 size={14}/> Удалить карточку</button>}
          <span className="wiki-updated"><Clock3 size={13}/> Обновлено {formatDate(doc.updatedAt || doc.createdAt)}</span>
        </div>
      </header>

      <section className="wiki-summary" id="wiki-overview">
        <div className="wiki-summary-heading"><span className="wiki-summary-icon"><Sparkles size={16}/></span><div><span>КРАТКОЕ СОДЕРЖАНИЕ</span><small>{doc.description ? 'Справка по материалу' : 'Описание ещё не заполнено'}</small></div></div>
        <p>{doc.description || 'Краткое описание не добавлено. Редактор может заполнить его вручную или подготовить по загруженному документу с помощью ИИ, когда сервис будет подключён.'}</p>
      </section>

      {doc.isDemo && <div className="notice wiki-demo-notice"><CircleHelp size={17}/><div><b>Демонстрационная запись</b><span>Этот материал показывает структуру внутренней базы. Не используйте его как юридическое основание и не считайте официальной инструкцией.</span></div></div>}

      {canReview && !doc.isDemo && <section className="review-actions wiki-review-actions" id="wiki-review">
        <span>Контроль актуальности источника</span>
        <button type="button" className="secondary-button" onClick={() => onReview('UNDER_REVIEW')}><RefreshCw size={14}/> На проверку</button>
        <button type="button" className="primary-button" onClick={() => onReview('ACTIVE')}><CheckCircle2 size={14}/> Подтвердить актуальность</button>
      </section>}

      <div className="wiki-page-layout">
        <aside className="wiki-side-column">
          <nav className="wiki-toc" aria-label="Содержание карточки">
            <div className="wiki-side-title"><ListTree size={15}/><b>В этой статье</b></div>
            {staticToc.map(item => <a key={item.id} href={'#' + item.id} onClick={event => scrollToArticleSection(event, item.id)}>{item.label}</a>)}
            {articleHeadings.length > 0 && <div className="wiki-toc-subhead">Разделы текста</div>}
            {articleHeadings.map(block => <a className="wiki-toc-nested" key={block.id} href={'#' + block.id} onClick={event => scrollToArticleSection(event, block.id)}>{block.title}</a>)}
          </nav>

          <section className="wiki-infobox" id="wiki-details">
            <div className="wiki-side-title"><FileText size={15}/><b>Сведения о материале</b></div>
            <dl className="wiki-facts">
              <div><dt>Тип материала</dt><dd>{doc.kind || 'Не указан'}</dd></div>
              <div><dt>Юрисдикция</dt><dd>{jurisdiction.label}</dd></div>
              <div><dt>Тематическая область</dt><dd>{doc.area || 'Не указана'}</dd></div>
              <div><dt>Товарная группа</dt><dd>{doc.productGroup || 'Не указана'}</dd></div>
              <div><dt>Ключевые слова</dt><dd>{doc.keywords || 'Не указаны'}</dd></div>
              <div><dt>Номер документа</dt><dd>{doc.documentNumber || 'Не указан'}</dd></div>
              <div><dt>Дата документа</dt><dd>{formatDate(doc.documentDate)}</dd></div>
              <div><dt>Действует с</dt><dd>{formatDate(doc.effectiveFrom)}</dd></div>
              <div><dt>Действует по</dt><dd>{formatDate(doc.effectiveUntil)}</dd></div>
              <div><dt>Версия карточки</dt><dd>{doc.versionNumber || 1}</dd></div>
              <div><dt>Источник проверен</dt><dd>{formatDate(doc.officialSourceCheckedAt)}</dd></div>
              <div><dt>Добавил</dt><dd>{doc.createdBy || 'Локальная запись'}</dd></div>
              <div><dt>Последнее изменение</dt><dd>{formatDate(doc.updatedAt || doc.createdAt)}</dd></div>
            </dl>
          </section>
        </aside>

        <div className="wiki-main-column">
          <section className="detail-subsection wiki-content-section" id="wiki-content">
            <div className="wiki-section-heading"><div><BookOpen size={18}/><div><h2>Содержание материала</h2><p>Основной текст, порядок работы и полезные заметки</p></div></div></div>
            {wikiBlocks.length ? <div className="document-content-body wiki-prose">
              {wikiBlocks.map((block, index) => {
                if (block.type === 'heading') return <h3 id={block.id} key={block.id}>{block.title}</h3>
                if (block.type === 'list' && block.ordered) return <ol key={'list-' + index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ol>
                if (block.type === 'list') return <ul key={'list-' + index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
                return <p key={'paragraph-' + index}>{block.text}</p>
              })}
            </div> : <div className="wiki-empty-content"><BookOpen size={22}/><b>Пока нет основного текста</b><span>Добавьте выдержку из документа, инструкцию или практический порядок действий. Текст будет доступен для поиска по базе знаний.</span>{canEdit && !doc.isDemo && <button type="button" className="secondary-button" onClick={onEdit}><Pencil size={14}/> Заполнить содержание</button>}</div>}
          </section>

          <section className="detail-subsection wiki-source-section" id="wiki-source">
            <div className="wiki-section-heading"><div><ExternalLink size={17}/><div><h2>Источник и проверка</h2><p>Основание, по которому подготовлена эта статья</p></div></div></div>
            {doc.sourceUrl ? <a className="source-link" href={doc.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={17}/><span><b>Открыть официальный источник</b><small>{doc.sourceUrl}</small></span><ArrowUpRight size={16}/></a> : <div className="notice"><CircleHelp size={17}/><div><b>Источник не указан</b><span>Добавьте официальный источник или внутренний утверждённый документ. До проверки не используйте содержание как подтверждённое нормативное требование.</span></div></div>}
            {doc.sourceCheckNote && <div className="check-note"><b>Комментарий проверки</b><span>{doc.sourceCheckNote}</span></div>}
            {!doc.isDemo && <div className="wiki-source-meta"><span><b>Добавил:</b> {doc.createdBy || 'Не указано'}</span><span><b>Изменил:</b> {doc.updatedBy || 'Не указано'}</span><span><b>Проверка источника:</b> {formatDate(doc.officialSourceCheckedAt)}</span></div>}
          </section>

          {relatedDocs.length > 0 && <section className="detail-subsection wiki-related-section" id="wiki-related">
            <div className="wiki-section-heading"><div><Link2 size={17}/><div><h2>Связанные материалы</h2><p>Другие статьи и документы по этой теме</p></div></div><span className="wiki-section-count">{relatedDocs.length}</span></div>
            <div className="related-document-list">{relatedDocs.map(related => <button key={related.id} className="related-document" type="button" onClick={() => onOpenRelated?.(related.id)}><FileText size={16}/><span><b>{related.title}</b><small>{jurisdictions[related.jurisdiction]?.short || related.jurisdiction} · {related.kind}</small></span><ArrowUpRight size={15}/></button>)}</div>
          </section>}

          {!doc.isDemo && <section className="detail-subsection wiki-files-section" id="wiki-files">
            <div className="wiki-section-heading"><div><Paperclip size={17}/><div><h2>Документы и вложения</h2><p>Оригиналы и дополнительные рабочие файлы</p></div></div><span className="wiki-section-count">{files.length}</span></div>
            {canUploadFiles && <div className="wiki-upload-panel">
              <input ref={attachmentInputRef} className="wiki-hidden-file-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onChange={handleAttachmentChange} />
              <div><b>Добавить оригинал или приложение</b><small>PDF, Word, Excel, CSV, TXT, PNG или JPG · до 30 МБ</small></div>
              <button type="button" className="secondary-button" onClick={() => attachmentInputRef.current?.click()} disabled={uploadingFile}><Paperclip size={14}/>{uploadingFile ? 'Загрузка…' : 'Прикрепить файл'}</button>
            </div>}
            {files.length ? <div className="attached-files">{files.map(file => <div className="attached-file" key={file.id}><span className="wiki-attached-file-icon"><FileText size={18}/></span><div className="attached-file-copy"><b>{file.originalName}</b><small>{formatBytes(file.sizeBytes)} · {file.uploadedBy || 'пользователь'} · {formatDate(file.uploadedAt)}</small><small className={'file-index-status file-index-' + (file.textExtractionStatus || 'NOT_INDEXED').toLowerCase()}>{fileIndexLabel(file)}</small>{file.textExtractionNote && <small className="file-index-note">{file.textExtractionNote}</small>}{canReindex && ['NOT_INDEXED', 'FAILED'].includes(file.textExtractionStatus || 'NOT_INDEXED') && <button type="button" className="secondary-button file-reindex-button" onClick={() => onReindexFile(file)} disabled={reindexingFileId === file.id}><RefreshCw size={13}/>{reindexingFileId === file.id ? 'Индексация…' : 'Индексировать файл'}</button>}</div><button type="button" className="icon-button" onClick={() => onDownload(file)} aria-label="Скачать файл"><Download size={16}/></button></div>)}</div>
              : <div className="wiki-empty-content compact"><Paperclip size={19}/><span>Вложения пока не добавлены.</span>{canUploadFiles && <small>Загрузите оригинал, чтобы он хранился рядом с карточкой.</small>}</div>}
          </section>}

          {!doc.isDemo && <section className="detail-subsection wiki-history-section" id="wiki-history">
            <div className="wiki-section-heading"><div><History size={17}/><div><h2>История редакций</h2><p>Кто и когда менял карточку</p></div></div><span className="wiki-section-count">{versions.length || 0}</span></div>
            {versions.length ? <div className="version-list">{versions.map(version => <div className="version-row" key={version.id}><span className="version-number">v{version.versionNumber}</span><div><b>{version.changeNote || 'Изменение карточки'}</b><small>{version.changedBy} · {formatDate(version.createdAt)} · {version.statusLabel || version.status}</small></div></div>)}</div>
              : <p className="subsection-empty">История появится после первого сохранения в серверной базе.</p>}
          </section>}
        </div>
      </div>
      {!API_ENABLED && !doc.isDemo && <p className="storage-note">Эта пользовательская карточка хранится только в локальном браузере и не видна другим сотрудникам.</p>}
    </article>
  </section>
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
}

function fileIndexLabel(file) {
  const count = Number(file.extractedCharacters || 0).toLocaleString('ru-RU')
  switch (file.textExtractionStatus) {
    case 'INDEXED': return 'Текст проиндексирован · ' + count + ' симв.'
    case 'OCR_INDEXED': return 'Текст распознан OCR · ' + count + ' симв.'
    case 'TRUNCATED': return 'Текст индексирован частично · ' + count + ' симв.'
    case 'EMPTY': return 'Текст не обнаружен'
    case 'NOT_SUPPORTED': return 'Формат не индексируется автоматически'
    case 'FAILED': return 'Не удалось извлечь текст'
    case 'PENDING': return 'Извлечение текста…'
    case 'NOT_INDEXED':
    default: return 'Текст не индексирован (старое вложение)'
  }
}

const knowledgeTemplates = {
  instruction: { kind: 'Инструкция', area: 'Работа в системе', description: 'Цель инструкции, для кого она предназначена и в каких случаях применяется.', content: 'Цель и область применения\n\nПеред началом:\n1. Проверьте права доступа и исходные данные.\n2. Убедитесь, что выбран правильный контур и организация.\n\nПорядок действий:\n1. \n2. \n3. \n\nОжидаемый результат:\n\nПроверка результата:\n\nТиповые ошибки и действия при их возникновении:\n\nИсточник / связанные документы:' },
  process: { kind: 'Бизнес-процесс', area: 'Рабочий процесс', description: 'Назначение процесса, участники и результат выполнения.', content: 'Цель процесса:\n\nВладелец процесса:\n\nУчастники и роли:\n\nВходные данные:\n\nОсновной порядок:\n1. Шаг / ответственный / результат.\n2. Шаг / ответственный / результат.\n3. Шаг / ответственный / результат.\n\nКонтрольные точки:\n\nИсключения и эскалация:\n\nВыходные документы / результат:\n\nСвязанные инструкции:' },
  error: { kind: 'Известная ошибка', area: 'Диагностика и поддержка', description: 'Точный текст ошибки, условия появления и влияние на работу.', content: 'Точный текст ошибки:\n\nГде возникает:\n\nУсловия воспроизведения:\n1. \n2. \n3. \n\nПричина (если подтверждена):\n\nКак диагностировать:\n\nПроверенное решение:\n1. \n2. \n3. \n\nВременный обходной путь (если разрешён):\n\nКогда передавать на эскалацию:\n\nСтатус решения: не проверено / проверено\n\nДата последней проверки и ответственный:\n\nСвязанные инциденты / документы:' },
  regulation: { kind: 'Нормативный акт', area: 'Нормативная база', description: 'Кратко опишите предмет регулирования и какие требования затрагивают работу оператора.', content: 'Предмет регулирования:\n\nКлючевые требования для оператора:\n\nК кому и к каким товарам применяется:\n\nДата вступления в силу / переходные сроки:\n\nПрактическое влияние на процессы:\n\nОфициальный источник и реквизиты:\n\nСвязанные акты:\n\nДата проверки актуальности / проверивший:' },
  template: { kind: 'Шаблон', area: 'Документы и коммуникации', description: 'Назначение шаблона, кто использует и когда его применять.', content: 'Когда использовать:\n\nКто заполняет / согласует:\n\nОбязательные поля:\n\nТекст / структура шаблона:\n\nПорядок согласования и отправки:\n\nСвязанные регламенты:' },
}
function CreateDocumentModal({ initialDoc, documents = [], onClose, onSubmit, apiEnabled, saving, error }) {
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryMessage, setAiSummaryMessage] = useState('')
  const [aiSummaryError, setAiSummaryError] = useState('')
  const [aiConsentOpen, setAiConsentOpen] = useState(false)
  const aiSummaryFormRef = useRef(null)

  const handleGenerateAiSummary = (event) => {
    const form = event.currentTarget.closest('form')
    if (!form) return
    if (!apiEnabled) {
      setAiSummaryMessage('ИИ доступен после подключения общей базы: задайте VITE_API_URL для frontend и GROQ_API_KEY в настройках backend. В демо-режиме запрос к ИИ не выполняется.')
      setAiSummaryError('')
      return
    }
    const fieldValue = name => String(form.elements.namedItem(name)?.value || '').trim()
    const file = form.elements.namedItem('file')?.files?.[0]
    const content = fieldValue('content')
    if (!file && !content) {
      setAiSummaryError('Сначала приложите документ или вставьте текст в поле «Содержание».')
      setAiSummaryMessage('')
      return
    }
    if (file && file.size > 30 * 1024 * 1024) {
      setAiSummaryError('Размер документа превышает 30 МБ.')
      setAiSummaryMessage('')
      return
    }
    aiSummaryFormRef.current = form
    setAiConsentOpen(true)
  }

  const runAiSummary = async () => {
    const form = aiSummaryFormRef.current
    if (!form) return
    const fieldValue = name => String(form.elements.namedItem(name)?.value || '').trim()
    const file = form.elements.namedItem('file')?.files?.[0]
    const requestBody = new FormData()
    ;['title', 'jurisdiction', 'kind', 'area', 'documentNumber', 'documentDate', 'effectiveFrom', 'effectiveUntil', 'sourceUrl', 'content'].forEach(name => {
      requestBody.append(name, fieldValue(name))
    })
    requestBody.append('language', 'ru')
    if (file) requestBody.append('file', file)
    setAiSummaryLoading(true)
    setAiSummaryError('')
    setAiSummaryMessage('')
    try {
      const result = await apiRequest('/api/ai/summarize', { method: 'POST', body: requestBody })
      const summary = String(result?.description || result?.summary || '').trim()
      if (!summary) throw new Error('ИИ не вернул краткое описание. Попробуйте другой документ или заполните описание вручную.')
      const descriptionField = form.elements.namedItem('description')
      if (descriptionField) descriptionField.value = summary
      setAiSummaryMessage('Черновик краткого описания подготовлен. Проверьте даты, номера и формулировки по оригиналу перед сохранением.')
    } catch (requestError) {
      const message = requestError?.message || ''
      if (/404|no static resource|not found|not_found/i.test(message)) {
        setAiSummaryMessage('Маршрут ИИ не найден на подключённом backend. Обновите/redeploy backend до актуальной версии и задайте GROQ_API_KEY в настройках сервера.')
        setAiSummaryError('')
      } else {
        setAiSummaryError(message || 'Не удалось подготовить описание. Попробуйте ещё раз или заполните его вручную.')
      }
    } finally {
      setAiSummaryLoading(false)
      aiSummaryFormRef.current = null
    }
  }
  
  const initialStatus = ['DRAFT','UNDER_REVIEW','ACTIVE','EXPIRED','ARCHIVED'].includes(initialDoc?.status) ? initialDoc.status : ''
  const applyTemplate = (event) => {
    const template = knowledgeTemplates[event.target.value]
    if (!template) return
    const form = event.currentTarget.form
    Object.entries(template).forEach(([name, value]) => {
      const field = form.elements.namedItem(name)
      if (field && !field.value.trim()) field.value = value
    })
    if (form.elements.namedItem('kind')) form.elements.namedItem('kind').value = template.kind
    if (form.elements.namedItem('area') && !form.elements.namedItem('area').value.trim()) form.elements.namedItem('area').value = template.area
  }
  return <>
  <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-document-title">
      <header className="modal-header"><div><div className="section-kicker">КАТАЛОГ / НОРМАТИВНЫЙ ФОНД</div><h2 id="create-document-title">{initialDoc ? 'Редактировать карточку' : 'Добавить документ'}</h2><p>Укажите реквизиты и официальный источник. Перед отметкой «Действует» проверьте документ вручную.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть" disabled={saving}><X size={20} /></button></header>
      <form onSubmit={onSubmit}>
        {!initialDoc && <label className="form-field full-field knowledge-template-picker"><span>Быстро создать по шаблону</span><select defaultValue="" onChange={applyTemplate}><option value="">Без шаблона – заполнить вручную</option><option value="instruction">Инструкция</option><option value="process">Бизнес-процесс</option><option value="error">Известная ошибка / решение</option><option value="regulation">Нормативный акт</option><option value="template">Шаблон документа</option></select><small className="form-help">Шаблон заполнит тип, область, описание и структуру содержания. Проверьте и замените все подсказки своими данными.</small></label>}
        <label className="form-field full-field"><span>Название документа *</span><input name="title" required maxLength="240" defaultValue={initialDoc?.title || ''} placeholder="Например, постановление или инструкция" /></label>
        <div className="form-grid">
          <label className="form-field"><span>Юрисдикция *</span><select name="jurisdiction" defaultValue={initialDoc?.jurisdiction || 'KG'} required><option value="KG">Кыргызская Республика</option><option value="RU">Российская Федерация</option><option value="EAEU">ЕАЭС</option></select></label>
          <label className="form-field"><span>Тип материала *</span><select name="kind" defaultValue={initialDoc?.kind || 'Нормативный акт'} required><option>Нормативный акт</option><option>Товарная группа</option><option>Инструкция</option><option>Техническая документация</option><option>Известная ошибка</option><option>Шаблон</option><option>Внутренний документ</option><option>Бизнес-процесс</option><option>Обзор</option></select></label>
          <label className="form-field"><span>Номер документа</span><input name="documentNumber" maxLength="120" defaultValue={initialDoc?.documentNumber || ''} placeholder="№ / реквизиты" /></label>
          <label className="form-field"><span>Дата документа</span><span className="date-input"><CalendarDays size={15} /><input name="documentDate" type="date" defaultValue={initialDoc?.documentDate || ''} /></span></label>
          <label className="form-field"><span>Вступает в силу</span><input name="effectiveFrom" type="date" defaultValue={initialDoc?.effectiveFrom || ''} /></label>
          <label className="form-field"><span>Действует по</span><input name="effectiveUntil" type="date" defaultValue={initialDoc?.effectiveUntil || ''} /></label>
          <label className="form-field full-field"><span>Тематическая область *</span><input name="area" required maxLength="120" defaultValue={initialDoc?.area || ''} placeholder="Например, товарные группы, заказ КМ, нанесение" /></label>
          <label className="form-field"><span>Товарная группа</span><input name="productGroup" maxLength="160" defaultValue={initialDoc?.productGroup || ''} placeholder="Например, обувь, косметика" /></label>
          <label className="form-field"><span>Ключевые слова</span><input name="keywords" maxLength="1000" defaultValue={initialDoc?.keywords || ''} placeholder="Через запятую" /></label>
          {apiEnabled && <label className="form-field full-field"><span>Связанные документы</span><select name="relatedDocumentIds" className="related-select" multiple defaultValue={initialDoc?.relatedDocumentIds || []}>{documents.map(item => <option key={item.id} value={item.id}>{jurisdictions[item.jurisdiction]?.short || item.jurisdiction} · {item.title}</option>)}</select><small className="form-help">Чтобы выбрать несколько документов, удерживай Ctrl (Windows) или Command (Mac).</small></label>}
          <label className="form-field full-field"><span>Ссылка на официальный источник</span><input name="sourceUrl" type="url" maxLength="2000" defaultValue={initialDoc?.sourceUrl || ''} placeholder="https://..." /></label>
          {apiEnabled && <label className="form-field"><span>Статус карточки</span><select name="status" defaultValue={initialStatus}><option value="">Автоматически: черновик / на проверку</option><option value="DRAFT">Черновик</option><option value="UNDER_REVIEW">На проверке</option><option value="ACTIVE">Действует</option><option value="EXPIRED">Срок действия истёк</option><option value="ARCHIVED">В архиве</option></select></label>}
          <div className="form-field full-field ai-summary-field">
            <div className="ai-summary-field-heading"><label htmlFor="document-description">Краткое описание *</label><button type="button" className="secondary-button ai-summary-button" onClick={handleGenerateAiSummary} disabled={aiSummaryLoading || saving}><Sparkles size={14}/>{aiSummaryLoading ? 'Готовим описание…' : 'Подготовить с ИИ'}</button></div>
            <textarea id="document-description" name="description" required rows="4" maxLength="3000" defaultValue={initialDoc?.description || ''} placeholder="Кратко: о чём документ, к кому относится и что важно сотруднику знать" />
            <small className="form-help">ИИ-описание – только черновик. Проверьте факты, номера, даты и область применения по исходному документу.</small>
            <small className="form-help ai-summary-privacy">Для генерации текст и выбранный файл отправляются в настроенный Groq API. Не отправляйте материалы с налоговой тайной или иной закрытой информацией без разрешения.</small>
            {aiSummaryMessage && <div className="ai-summary-message" role="status"><Sparkles size={14}/><span>{aiSummaryMessage}</span></div>}
            {aiSummaryError && <div className="feedback feedback-error ai-summary-feedback" role="alert"><CircleHelp size={14}/><span>{aiSummaryError}</span></div>}
          </div>
          <label className="form-field full-field"><span>Содержание / рабочая инструкция</span><textarea name="content" rows="8" maxLength="50000" defaultValue={initialDoc?.content || ''} placeholder="Добавьте текст инструкции, порядок действий, решение ошибки, выдержку или другие сведения для поиска..." /><small className="form-help">Текст будет доступен для поиска (до 50 000 символов). Текстовые PDF/Word/Excel/TXT/CSV индексируются автоматически; для сканов PDF и изображений используется OCR с пометкой результата.</small></label>
          {apiEnabled && <label className="form-field full-field"><span>Комментарий к редакции</span><input name="changeNote" maxLength="1000" placeholder="Например, обновлена дата вступления в силу" /></label>}
          <label className="form-field full-field upload-field"><span>Прикрепить файл к карточке (необязательно, до 30 МБ)</span><span className="file-input-wrap"><Paperclip size={16} /><input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" /></span><small className="form-help">{apiEnabled ? 'Файл сохранится в общей базе и будет доступен пользователям с правами.' : 'В демо-режиме файл сохранится в этом браузере через локальное хранилище. Для других сотрудников нужна общая база.'}</small></label>
        </div>
        {error && <div className="feedback feedback-error"><CircleHelp size={16} /><span>{error}</span></div>}
        <div className="form-note"><CircleHelp size={16} /><span>{apiEnabled ? 'Карточка сохраняется в общей базе. Файл хранится в серверном каталоге. Статус «Действует» означает, что сотрудник подтвердил источник, а не автоматическое юридическое заключение.' : 'Карточка пока сохраняется только в этом браузере. Для общей базы настройте VITE_API_URL и backend.'}</span></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Отмена</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <RefreshCw size={15} className="spin" /> : <FilePlus2 size={16} />} {saving ? 'Сохранение…' : initialDoc ? 'Сохранить изменения' : 'Сохранить карточку'}</button></div>
      </form>
    </section>
  </div>
  {aiConsentOpen && <ConfirmActionModal
    title="Передать материал в ИИ?"
    message="Для подготовки краткого описания текст и выбранный файл будут отправлены через сервер TEKSHER HUB в настроенный Groq API. Не продолжайте, если материал содержит налоговую тайну, персональные данные или иную закрытую информацию без разрешения организации."
    confirmLabel="Продолжить"
    tone="warning"
    onClose={() => setAiConsentOpen(false)}
    onConfirm={runAiSummary}
  />}
  </>
}


function DocumentImportModal({ onClose, onImport }) {
  const [fileName, setFileName] = useState('')
  const [records, setRecords] = useState([])
  const [localError, setLocalError] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    setResults(null)
    setRecords([])
    setLocalError('')
    setFileName(file?.name || '')
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setLocalError('CSV-файл должен быть не больше 5 МБ.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv') && file.type !== 'text/plain') {
      setLocalError('Выберите файл формата CSV.')
      return
    }
    try {
      const parsed = parseDocumentCsv(await file.text())
      setRecords(parsed)
    } catch (error) {
      setLocalError(error.message || 'Не удалось прочитать CSV-файл.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!records.length || loading || results) return
    setLoading(true)
    setLocalError('')
    try {
      setResults(await onImport(records))
    } catch (error) {
      setLocalError(error.message || 'Импорт не выполнен.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onClose() }}>
    <section className="create-modal csv-import-modal" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
      <header className="modal-header">
        <div><div className="section-kicker">БАЗА ЗНАНИЙ / МАССОВОЕ ДОБАВЛЕНИЕ</div><h2 id="csv-import-title">Импорт материалов из CSV</h2><p>Загрузите таблицу существующих инструкций, регламентов и других рабочих материалов.</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть" disabled={loading}><X size={20}/></button>
      </header>
      <div className="notice csv-import-notice"><ShieldCheck size={17}/><div><b>Импорт не подтверждает юридическую актуальность</b><span>Материалы с источником получат статус «На проверке», без источника – «Черновик». Статус «Действует» через CSV не устанавливается.</span></div></div>
      <form onSubmit={handleSubmit}>
        <div className="csv-import-file-row">
          <label className="form-field full-field"><span>CSV-файл, до 5 МБ *</span><span className="file-input-wrap"><Paperclip size={16}/><input type="file" accept=".csv,text/csv,text/plain" onChange={handleFileChange} disabled={loading}/></span></label>
          <button className="secondary-button csv-template-button" type="button" onClick={downloadCsvTemplate}><Download size={14}/> Скачать шаблон CSV</button>
        </div>
        {fileName && <div className="csv-import-file-name"><FileText size={14}/>{fileName}</div>}
        <div className="form-help csv-import-help">Обязательные столбцы: Название, Юрисдикция, Тип материала, Тематическая область и Описание. Даты указывайте как ГГГГ-ММ-ДД или ДД.ММ.ГГГГ. Юрисдикции: КР/KG, РФ/RU, ЕАЭС/EAEU. Максимум 100 строк за один импорт. CSV с разделителем «;» и «,» поддерживаются.</div>

        {records.length > 0 && !results && <section className="csv-import-preview">
          <div className="csv-import-section-title"><b>Предварительный просмотр</b><span>{records.length} строк готовы к отправке</span></div>
          <div className="csv-import-table-wrap"><table className="csv-import-table"><thead><tr><th>Строка</th><th>Название</th><th>Контур</th><th>Тип</th><th>Источник</th></tr></thead><tbody>
            {records.slice(0, 5).map((record, index) => <tr key={index}><td>{index + 2}</td><td>{record.title || 'Без названия'}</td><td>{jurisdictions[record.jurisdiction]?.short || record.jurisdiction || '–'}</td><td>{record.kind || '–'}</td><td>{record.sourceUrl ? 'Указан' : 'Не указан'}</td></tr>)}
          </tbody></table></div>
          {records.length > 5 && <small className="csv-import-more">Показаны первые 5 строк из {records.length}. Результат будет показан для каждой строки.</small>}
        </section>}

        {results && <section className="csv-import-results">
          <div className="csv-import-result-summary"><b>Импорт завершён</b><div><span className="csv-result-count success">{results.imported} добавлено</span><span className="csv-result-count failure">{results.rejected} отклонено</span></div></div>
          <div className="csv-import-result-list">
            {results.rows.slice(0, 15).map(row => <div className={'csv-import-result-row ' + (row.imported ? 'success' : 'failure')} key={row.rowNumber}>
              {row.imported ? <CheckCircle2 size={16}/> : <CircleHelp size={16}/>}
              <span><b>Строка {row.rowNumber}: {row.title || 'Без названия'}</b><small>{row.message}{row.statusLabel ? ' · Статус: ' + row.statusLabel : ''}</small></span>
            </div>)}
          </div>
          {results.rows.length > 15 && <div className="csv-import-more">Показаны первые 15 результатов из {results.rows.length}.</div>}
          {results.imported > 0 && <div className="form-note"><ShieldCheck size={16}/><span>Добавленные материалы доступны в общей базе и поиске. Проверьте официальные источники перед применением.</span></div>}
        </section>}

        {localError && <div className="feedback feedback-error"><CircleHelp size={16}/><span>{localError}</span></div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>{results ? 'Закрыть' : 'Отмена'}</button>
          {!results && <button type="submit" className="primary-button" disabled={!records.length || loading}>{loading ? <RefreshCw size={15} className="spin"/> : <FilePlus2 size={16}/>} {loading ? 'Импортирование…' : 'Импортировать ' + records.length + ' строк'}</button>}
        </div>
      </form>
    </section>
  </div>
}

function LoginScreen({ onSubmit, error, loading = false }) {
  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span className="brand-mark">T</span><span><b>TEKSHER<span>HUB</span></b><small>KNOWLEDGE PLATFORM</small></span></div>
      <div className="auth-kicker"><ShieldCheck size={15} /> ЗАЩИЩЁННЫЙ ДОСТУП</div>
      <h1>{loading ? 'Проверяем сессию' : 'Вход в рабочее пространство'}</h1>
      <p>{loading ? 'Подключаемся к TEKSHER HUB…' : 'Войдите под учётной записью, выданной администратором.'}</p>
      {loading ? <div className="auth-loading"><RefreshCw className="spin" size={20} /> Проверка доступа</div> : <form onSubmit={onSubmit} className="auth-form">
        <label className="form-field"><span>Логин</span><input name="username" autoComplete="username" required autoFocus maxLength="120" placeholder="Введите логин" /></label>
        <label className="form-field"><span>Пароль</span><input name="password" type="password" autoComplete="current-password" required maxLength="200" placeholder="Введите пароль" /></label>
        {error && <div className="feedback feedback-error"><CircleHelp size={16} /><span>{error}</span></div>}
        <button className="primary-button auth-submit" type="submit"><ShieldCheck size={16} /> Войти в систему</button>
      </form>}
      <div className="auth-footnote">Доступ предоставляется администратором. Самостоятельная регистрация отключена.</div>
    </section>
  </main>
}


function AiAssistantSection({ apiEnabled, onOpenDocument }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const suggestions = [
    'Что делать, если не заказываются коды маркировки?',
    'Как проверить актуальность документа?',
    'Найди инструкции по работе с карточкой товара',
    'Какие материалы относятся к ГАИС МТ в Кыргызстане?'
  ]

  const sendQuestion = async (value) => {
    const text = String(value || '').trim()
    if (!text || loading) return
    if (!apiEnabled) {
      setError('Для ИИ-помощника нужно подключить общую базу через VITE_API_URL и настроить GROQ_API_KEY на backend.')
      return
    }
    setQuestion('')
    setError('')
    setMessages(previous => [...previous, { role: 'user', answer: text }])
    setLoading(true)
    try {
      const result = await apiRequest('/api/ai/ask', { method: 'POST', body: { question: text } })
      setMessages(previous => [...previous, {
        role: 'assistant',
        answer: result.answer || 'Не удалось получить ответ.',
        sources: Array.isArray(result.sources) ? result.sources : [],
        insufficientEvidence: Boolean(result.insufficientEvidence)
      }])
    } catch (requestError) {
      setError(requestError.message || 'Не удалось получить ответ ИИ. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    sendQuestion(question)
  }

  return (
    <section className="assistant-page">
      <div className="page-heading">
        <div>
          <div className="section-kicker">TEKSHER HUB / ПОИСК ПО ЗНАНИЯМ</div>
          <h1>ИИ-помощник</h1>
          <p>Задайте вопрос обычным языком. Помощник найдёт релевантные материалы базы знаний и ответит со ссылками на источники.</p>
        </div>
      </div>
      <div className="assistant-layout">
        <aside className="assistant-info-panel">
          <div className="assistant-info-icon"><Bot size={25} /></div>
          <h2>Ответы с опорой на документы</h2>
          <p>Помощник сначала ищет совпадения в карточках и извлечённом тексте вложений, затем формирует ответ на основании найденных материалов.</p>
          <div className="assistant-info-point"><span><CheckCircle2 size={16}/></span><div><b>Ссылки на источники</b><small>Можно открыть исходную карточку и официальный источник.</small></div></div>
          <div className="assistant-info-point"><span><ShieldCheck size={16}/></span><div><b>Статус документа учитывается</b><small>Материалы на проверке или в архиве не должны выдаваться за действующие требования.</small></div></div>
          <div className="assistant-info-point"><span><CircleHelp size={16}/></span><div><b>Без найденного подтверждения</b><small>Если в базе недостаточно данных, помощник должен прямо об этом сообщить.</small></div></div>
          <div className="assistant-privacy-note">
            <b>Важно для внутренних материалов</b>
            <span>Для генерации ответа релевантный текст отправляется в Groq через backend. Не используйте помощника для закрытых сведений, налоговой тайны или персональных данных без разрешения организации.</span>
          </div>
          {!apiEnabled && <div className="assistant-unavailable"><CircleHelp size={15}/> Общая база и серверный ИИ не подключены в демо-режиме.</div>}
        </aside>

        <div className="assistant-chat-panel">
          <div className="assistant-chat-heading">
            <div className="assistant-chat-avatar"><Bot size={19}/></div>
            <div><b>TEKSHER AI</b><small>Помощник по базе знаний</small></div>
            <span className="assistant-online-dot">Поиск по источникам</span>
          </div>
          <div className="assistant-messages" aria-live="polite">
            {!messages.length && <div className="assistant-welcome">
              <div className="assistant-welcome-icon"><Sparkles size={23}/></div>
              <h2>Что нужно найти?</h2>
              <p>Опишите вопрос, ошибку или рабочую ситуацию. Начать можно с примеров ниже.</p>
              <div className="assistant-suggestions">
                {suggestions.map(item => <button type="button" key={item} onClick={() => sendQuestion(item)} disabled={loading || !apiEnabled}>{item}<ArrowUpRight size={14}/></button>)}
              </div>
            </div>}
            {messages.map((message, index) => <div className={'assistant-message assistant-message-' + message.role} key={index}>
              <div className="assistant-message-label">{message.role === 'user' ? 'Вы' : <><Bot size={14}/> TEKSHER AI</>}</div>
              <div className="assistant-message-bubble">
                <div className="assistant-answer-text">{message.answer}</div>
                {message.role === 'assistant' && message.insufficientEvidence && <div className="assistant-evidence-warning"><CircleHelp size={15}/> Ответ не удалось полностью подтвердить материалами базы.</div>}
              </div>
              {message.role === 'assistant' && message.sources?.length > 0 && <div className="assistant-sources">
                <div className="assistant-sources-heading"><BookOpen size={15}/> Источники в базе ({message.sources.length})</div>
                {message.sources.map(source => <article className="assistant-source-card" key={source.id}>
                  <div className="assistant-source-top"><span className="assistant-source-number">[{source.number}]</span><span className={'assistant-source-status assistant-status-' + String(source.status || '').toLowerCase()}>{source.statusLabel || 'Статус не указан'}</span></div>
                  <button type="button" className="assistant-source-title" onClick={() => onOpenDocument(source.id)}>{source.title}<ArrowUpRight size={14}/></button>
                  <div className="assistant-source-meta">{source.jurisdiction || 'Юрисдикция не указана'}{source.kind ? ' · ' + source.kind : ''}{source.effectiveFrom ? ' · с ' + source.effectiveFrom : ''}{source.effectiveUntil ? ' · по ' + source.effectiveUntil : ''}</div>
                  {source.excerpt && <p className="assistant-source-excerpt">{source.excerpt}</p>}
                  {source.sourceUrl && <a className="assistant-source-link" href={source.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Официальный источник</a>}
                  {source.checkedAt && <small className="assistant-source-checked">Последняя отметка проверки: {new Date(source.checkedAt).toLocaleDateString('ru-RU')}</small>}
                </article>)}
              </div>}
            </div>)}
            {loading && <div className="assistant-message assistant-message-assistant"><div className="assistant-message-label"><Bot size={14}/> TEKSHER AI</div><div className="assistant-typing"><span/><span/><span/> Ищу материалы и готовлю ответ…</div></div>}
            <div ref={messagesEndRef}/>
          </div>
          {error && <div className="assistant-error" role="alert"><CircleHelp size={15}/><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Закрыть сообщение"><X size={14}/></button></div>}
          <form className="assistant-composer" onSubmit={handleSubmit}>
            <textarea ref={inputRef} rows={2} maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSubmit(event) } }} placeholder="Напишите вопрос по маркировке, документам или рабочему процессу…" disabled={!apiEnabled || loading} aria-label="Ваш вопрос"/>
            <div className="assistant-composer-footer"><span>Enter – отправить · Shift + Enter – новая строка · до 2 000 символов</span><button type="submit" className="primary-button" disabled={!apiEnabled || loading || !question.trim()}><Send size={15}/>{loading ? 'Думаю…' : 'Спросить'}</button></div>
          </form>
        </div>
      </div>
    </section>
  )
}

function MonitorSection({ monitors, canManage, onAdd, onCheck, onDelete }) {
  return <section className="management-page">
    <div className="page-heading"><div><div className="section-kicker">КОНТРОЛЬ ИЗМЕНЕНИЙ / ИСТОЧНИКИ</div><h1>Мониторинг официальных источников</h1><p>Система периодически проверяет содержимое разрешённых официальных сайтов и фиксирует изменение контрольной суммы. Найденное изменение требует проверки специалистом и само по себе не означает изменения юридической силы документа.</p></div>{canManage && <button className="primary-button" onClick={onAdd}><FilePlus2 size={16} /> Добавить источник</button>}</div>
    <div className="notice"><ShieldCheck size={17} /><div><b>Защита исходящих запросов</b><span>Автоматическая проверка ограничена доменами в MONITOR_ALLOWED_HOSTS. Перенаправления отключены, локальные IP-адреса блокируются. Если официальный сайт не входит в список, администратор должен добавить его в allowlist после проверки.</span></div></div>
    {!monitors.length ? <div className="empty-state management-empty"><RefreshCw size={28} /><b>Источники ещё не добавлены</b><span>Добавь официальный портал, который нужно периодически перепроверять.</span>{canManage && <button className="primary-button" onClick={onAdd}>Добавить первый источник</button>}</div> :
      <div className="monitor-list">{monitors.map(monitor => <article className="monitor-card" key={monitor.id}>
        <div className="monitor-icon"><Globe2 size={19} /></div>
        <div className="monitor-main"><div className="monitor-title-row"><h3>{monitor.name}</h3><span className={`status-pill ${monitor.lastError ? 'draft-status' : monitor.lastChangeDetectedAt ? 'review-status' : monitor.lastCheckedAt ? 'source-status' : 'demo-status'}`}>{monitor.lastError ? 'Ошибка проверки' : monitor.lastChangeDetectedAt ? 'Обнаружено изменение' : monitor.lastCheckedAt ? 'Проверено' : 'Ожидает первой проверки'}</span></div>
          <div className="monitor-url">{monitor.sourceUrl}</div>
          <div className="monitor-meta"><span>{jurisdictions[monitor.jurisdiction]?.short || monitor.jurisdiction}</span><span>Интервал: {monitor.intervalHours} ч</span><span>HTTP: {monitor.lastHttpStatus || '–'}</span><span>Последняя проверка: {formatDateTime(monitor.lastCheckedAt)}</span></div>
          {monitor.lastError && <div className="monitor-error">{monitor.lastError}</div>}
          {monitor.lastChangeDetectedAt && <div className="monitor-change"><AlertTriangleIcon /> Изменение контрольной суммы: {formatDateTime(monitor.lastChangeDetectedAt)}. Проверьте источник вручную.</div>}
        </div>
        <div className="monitor-actions">{canManage && <button type="button" className="secondary-button" onClick={() => onCheck(monitor)}><RefreshCw size={14} /> Проверить</button>}{canManage && <button type="button" className="danger-button compact-danger" onClick={() => onDelete(monitor)}><Trash2 size={14} /> Удалить</button>}</div>
      </article>)}</div>}
  </section>
}

function AlertTriangleIcon() {
  return <CircleHelp size={14} />
}

function formatDateTime(value) {
  if (!value) return 'Ещё не выполнялась'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '–' : date.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

function MonitorModal({ onClose, onSubmit, saving, error }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
    <section className="create-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="monitor-modal-title">
      <header className="modal-header"><div><div className="section-kicker">МОНИТОРИНГ</div><h2 id="monitor-modal-title">Добавить официальный источник</h2><p>Адрес должен принадлежать разрешённому доверенному домену.</p></div><button className="icon-button" type="button" onClick={onClose} disabled={saving}><X size={20} /></button></header>
      <form onSubmit={onSubmit}><div className="form-grid">
        <label className="form-field full-field"><span>Название источника *</span><input name="name" required maxLength="180" placeholder="Например, официальный портал правовой информации" /></label>
        <label className="form-field"><span>Юрисдикция *</span><select name="jurisdiction" defaultValue="KG"><option value="KG">Кыргызская Республика</option><option value="RU">Российская Федерация</option><option value="EAEU">ЕАЭС</option></select></label>
        <label className="form-field"><span>Интервал проверки, ч</span><input name="intervalHours" type="number" min="1" max="720" defaultValue="24" required /></label>
        <label className="form-field full-field"><span>URL сайта или страницы *</span><input name="sourceUrl" type="url" required maxLength="2000" placeholder="https://official.gov.kg/..." /></label>
        <label className="monitor-enable"><input name="enabled" type="checkbox" defaultChecked /> Включить автоматическую проверку</label>
      </div>
        {error && <div className="feedback feedback-error"><CircleHelp size={16} /><span>{error}</span></div>}
        <div className="form-note"><CircleHelp size={16} /><span>Система сравнивает контрольную сумму ответа до 2 МБ. Динамическая вёрстка может вызывать ложные срабатывания. Изменение проверяет сотрудник.</span></div>
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить источник'}</button></div>
      </form>
    </section>
  </div>
}

function UsersSection({ users, onAdd, onToggle, onReset }) {
  return <section className="management-page">
    <div className="page-heading"><div><div className="section-kicker">АДМИНИСТРИРОВАНИЕ / ДОСТУП</div><h1>Пользователи</h1><p>Создавай учётные записи и назначай минимально необходимые права доступа.</p></div><button className="primary-button" onClick={onAdd}><UserPlus size={16} /> Добавить пользователя</button></div>
    <div className="notice"><ShieldCheck size={17} /><div><b>Принцип минимальных прав</b><span>ADMIN управляет пользователями и всеми карточками. EDITOR работает с документами и источниками. READER имеет доступ только на чтение.</span></div></div>
    {!users.length ? <div className="empty-state management-empty"><UsersRound size={28} /><b>Нет пользователей</b><span>Пользователи появятся после добавления учётных записей.</span></div> :
      <div className="user-table-wrap"><table className="user-table"><thead><tr><th>Пользователь</th><th>Логин</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.displayName}</td><td>{user.username}</td><td><span className="role-pill">{({ADMIN:'Администратор',EDITOR:'Редактор',READER:'Чтение'})[user.role] || user.role}</span></td><td><span className={`status-pill ${user.enabled ? 'source-status' : 'draft-status'}`}>{user.enabled ? 'Активен' : 'Отключён'}</span></td><td><div className="user-actions"><button className="secondary-button" onClick={() => onReset(user)}>Сменить пароль</button><button className="secondary-button" onClick={() => onToggle(user)}>{user.enabled ? 'Отключить' : 'Включить'}</button></div></td></tr>)}</tbody></table></div>}
  </section>
}

function UserModal({ onClose, onSubmit, saving, error }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
    <section className="create-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
      <header className="modal-header"><div><div className="section-kicker">УПРАВЛЕНИЕ ДОСТУПОМ</div><h2 id="user-modal-title">Новый пользователь</h2><p>Пароль должен содержать минимум 12 символов. Передай его сотруднику безопасным способом.</p></div><button className="icon-button" type="button" onClick={onClose} disabled={saving}><X size={20} /></button></header>
      <form onSubmit={onSubmit}><div className="form-grid">
        <label className="form-field full-field"><span>ФИО / отображаемое имя *</span><input name="displayName" required maxLength="180" /></label>
        <label className="form-field full-field"><span>Логин *</span><input name="username" required autoComplete="off" maxLength="120" /></label>
        <label className="form-field full-field"><span>Временный пароль *</span><input name="password" type="password" minLength="12" required autoComplete="new-password" maxLength="200" /></label>
        <label className="form-field full-field"><span>Роль *</span><select name="role" defaultValue="READER"><option value="READER">READER – чтение</option><option value="EDITOR">EDITOR – редактирование</option><option value="ADMIN">ADMIN – администратор</option></select></label>
      </div>
      {error && <div className="feedback feedback-error"><CircleHelp size={16} /><span>{error}</span></div>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Создание…' : 'Создать пользователя'}</button></div>
      </form>
    </section>
  </div>
}

function UserPasswordModal({ user, onClose, onSubmit, saving, error }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
    <section className="create-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="user-password-title">
      <header className="modal-header"><div><div className="section-kicker">УПРАВЛЕНИЕ ДОСТУПОМ</div><h2 id="user-password-title">Смена пароля</h2><p>Пользователь: {user.displayName} ({user.username}). Передай новый пароль безопасным способом.</p></div><button className="icon-button" type="button" onClick={onClose} disabled={saving}><X size={20} /></button></header>
      <form onSubmit={onSubmit}>
        <label className="form-field full-field"><span>Новый пароль *</span><input name="password" type="password" minLength="12" maxLength="200" autoComplete="new-password" required autoFocus /></label>
        {error && <div className="feedback feedback-error"><CircleHelp size={16} /><span>{error}</span></div>}
        <div className="form-note"><ShieldCheck size={16} /><span>Минимум 12 символов. Сохраняется только защищённый BCrypt-хеш.</span></div>
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Отмена</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Обновление…' : 'Обновить пароль'}</button></div>
      </form>
    </section>
  </div>
}

export default App
