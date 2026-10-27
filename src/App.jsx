import { useEffect, useMemo, useRef, useState } from 'react'
import { API_ENABLED, API_BASE, apiRequest, clearStoredToken, getStoredToken, storeToken } from './lib/api.js'
import { loadTnvedCatalog } from './data/tnved-catalog.js'
import {
  ArrowDownRight, ArrowUpRight, BookOpen, Boxes, CalendarDays, ChevronDown,
  CircleHelp, ExternalLink, FileCheck2, FilePlus2, FileText, Globe2, Home, Star,
  Landmark, Layers3, LibraryBig, Link2, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Bot, Send, Workflow, X, Pencil, Trash2, RefreshCw, UsersRound, LogOut, Paperclip, Download, History, CheckCircle2, UserPlus, Moon, Sun, Copy, ListTree, Clock3, Printer, ThumbsUp, ThumbsDown, Bell, MessageCircle
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
    { id: 'favorites', label: 'Избранное', icon: Star },
    { id: 'tasks', label: 'Задачи команды', icon: ListTree },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
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
    { id: 'audit', label: 'Журнал действий', icon: History },
  ]},
]

const STORAGE_KEY = 'teksher-hub-user-documents'
const THEME_STORAGE_KEY = 'teksher-hub-theme'
const FAVORITES_STORAGE_KEY = 'teksher-hub-favorite-documents'

function loadFavoriteDocumentIds() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? [...new Set(parsed.map(String))] : []
  } catch {
    return []
  }
}

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
  const [favoriteDocumentIds, setFavoriteDocumentIds] = useState(() => API_ENABLED ? [] : loadFavoriteDocumentIds())
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
      const key = String(event.key || '').toLocaleLowerCase('ru-RU')
      const isSearchShortcut = (event.metaKey || event.ctrlKey)
        && (event.code === 'KeyK' || key === 'k' || key === 'л')
      if (isSearchShortcut) {
        event.preventDefault()
        event.stopPropagation()
        setGlobalSearchQuery(''); setGlobalSearchActiveIndex(0); setGlobalSearchError(''); setShowGlobalSearch(true)
      } else if ((event.key === '/' || event.code === 'Slash') && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setGlobalSearchQuery(''); setGlobalSearchActiveIndex(0); setGlobalSearchError(''); setShowGlobalSearch(true)
      } else if (event.key === 'Escape') {
        setShowGlobalSearch(false)
      }
    }
    window.addEventListener('keydown', onShortcut, true)
    return () => window.removeEventListener('keydown', onShortcut, true)
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
      const matchesFavorites = active !== 'favorites' || favoriteDocumentIds.includes(String(doc.id))
      return matchesJurisdiction && matchesQuery && matchesFilter && matchesStatus && matchesSection && matchesFavorites
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
  }, [documents, apiSearchResults, apiSearchTerm, active, query, filter, statusFilter, sortBy, favoriteDocumentIds])

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
    if (!API_ENABLED) {
      try { window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteDocumentIds)) } catch { /* storage unavailable */ }
      return undefined
    }
    if (!currentUser) {
      setFavoriteDocumentIds([])
      return undefined
    }
    let cancelled = false
    apiRequest('/api/favorites')
      .then(rows => { if (!cancelled) setFavoriteDocumentIds(Array.isArray(rows) ? [...new Set(rows.map(String))] : []) })
      .catch(error => { if (!cancelled) setActionError(error.message || 'Не удалось загрузить избранные материалы.') })
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
    : jurisdictions[active]?.label || ({ assistant: 'ИИ-помощник', documents: 'Все документы', favorites: 'Избранные материалы', groups: 'Товарные группы', processes: 'Бизнес-процессы', knowledge: 'Инструкции и база знаний', monitoring: 'Мониторинг официальных источников', users: 'Управление пользователями', audit: 'Журнал действий', tasks: 'Задачи команды', notifications: 'Уведомления' }[active] || 'TEKSHER HUB')

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
    const knownSections = new Set([
      'home', 'RU', 'KG', 'EAEU', 'assistant', 'documents', 'favorites', 'groups',
      'processes', 'knowledge', 'monitoring', 'users', 'audit', 'tasks', 'notifications'
    ])

    const restoreRoute = () => {
      // history.state is not reliably preserved by browsers on refresh; the URL hash is.
      const hash = window.location.hash.replace(/^#/, '')
      const match = hash.match(/^([^/]+)(?:\/document\/(.*))?$/)
      const hashSection = match?.[1] || ''
      const section = knownSections.has(hashSection) ? hashSection : ''
      const docId = match?.[2] ? decodeURIComponent(match[2]) : null

      if (section) {
        setActive(section)
        const doc = docId ? documents.find(item => String(item.id) === String(docId)) : null
        setSelectedDoc(doc || null)
      } else {
        setActive('home')
        setSelectedDoc(null)
        if (!hash) syncRoute('home', null, true)
      }
      setActionError('')
      setSuccessMessage('')
    }

    restoreRoute()
    window.addEventListener('popstate', restoreRoute)
    window.addEventListener('hashchange', restoreRoute)
    return () => {
      window.removeEventListener('popstate', restoreRoute)
      window.removeEventListener('hashchange', restoreRoute)
    }
  }, [documents])

  const toggleFavoriteDocument = async doc => {
    if (!doc?.id) return
    const id = String(doc.id)
    const isFavorite = favoriteDocumentIds.includes(id)
    setActionError('')
    setSuccessMessage('')
    if (API_ENABLED) {
      if (!currentUser) {
        setActionError('Войдите в систему, чтобы сохранять избранные материалы в своей учётной записи.')
        return
      }
      if (doc.isDemo) {
        setActionError('Демонстрационную запись нельзя сохранить в серверном избранном.')
        return
      }
      try {
        await apiRequest('/api/favorites/' + encodeURIComponent(id), { method: isFavorite ? 'DELETE' : 'PUT' })
        setFavoriteDocumentIds(current => isFavorite ? current.filter(item => item !== id) : (current.includes(id) ? current : [id, ...current]))
        setSuccessMessage(isFavorite ? 'Материал удалён из избранного.' : 'Материал добавлен в избранное.')
      } catch (error) {
        setActionError(error.message || 'Не удалось изменить избранное.')
      }
      return
    }
    setFavoriteDocumentIds(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current]
      try { window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
    setSuccessMessage(isFavorite ? 'Материал удалён из избранного.' : 'Материал добавлен в избранное.')
  }

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

  const handleUploadAttachment = async (fileSelection) => {
    const selectedFiles = Array.from(fileSelection || []).filter(file => file instanceof File && file.name && file.size > 0)
    if (!selectedFiles.length || !selectedDoc || selectedDoc.isDemo) return

    const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg'])
    const invalidFiles = []
    const validFiles = []
    selectedFiles.forEach(file => {
      const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
      if (file.size > 30 * 1024 * 1024) invalidFiles.push(file.name + ': размер превышает 30 МБ.')
      else if (!allowedExtensions.has(extension)) invalidFiles.push(file.name + ': формат не поддерживается. Выберите PDF, Word, Excel, CSV, TXT, PNG или JPG.')
      else validFiles.push(file)
    })

    if (!API_ENABLED) {
      setIsUploadingAttachment(true)
      setActionError('')
      setSuccessMessage('')
      const failed = [...invalidFiles]
      let uploaded = 0
      try {
        for (const file of validFiles) {
          try {
            await saveLocalAttachment(selectedDoc.id, file)
            uploaded++
          } catch (error) {
            failed.push(file.name + ': ' + (error.message || 'не удалось сохранить файл в браузере.'))
          }
        }
        setLocalAttachmentFiles(await loadLocalAttachments(selectedDoc.id))
        if (uploaded) setSuccessMessage('Прикреплено файлов: ' + uploaded + '. В демо-режиме они сохранены только в этом браузере.')
        if (failed.length) setActionError('Не все файлы удалось прикрепить:\n' + failed.join('\n'))
        if (!uploaded && !failed.length) setActionError('Выберите файлы для загрузки.')
      } catch (error) {
        setActionError(error.message || 'Не удалось обновить список вложений.')
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
    const failed = [...invalidFiles]
    let uploaded = 0
    try {
      for (const file of validFiles) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          await apiRequest('/api/documents/' + selectedDoc.id + '/files', { method: 'POST', body: formData })
          uploaded++
        } catch (error) {
          failed.push(file.name + ': ' + (error.message || 'не удалось загрузить файл.'))
        }
      }
      const [updatedFiles] = await Promise.all([
        apiRequest('/api/documents/' + selectedDoc.id + '/files'),
        refreshDocuments()
      ])
      setApiFiles(updatedFiles)
      if (uploaded) setSuccessMessage('Прикреплено файлов: ' + uploaded + '. Текст PDF, Word и Excel будет доступен в поиске после обработки.')
      if (failed.length) setActionError('Не все файлы удалось прикрепить:\n' + failed.join('\n'))
      if (!uploaded && !failed.length) setActionError('Выберите файлы для загрузки.')
    } catch (error) {
      setActionError(error.message || 'Не удалось обновить список вложений.')
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
    const uploads = data.getAll('file').filter(file => file instanceof File && file.name && file.size > 0)
    const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg'])
    const invalidUploads = uploads.filter(file => {
      const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
      return file.size > 30 * 1024 * 1024 || !allowedExtensions.has(extension)
    })
    if (invalidUploads.length) {
      setActionError(invalidUploads.map(file => {
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
        return file.name + ': ' + (file.size > 30 * 1024 * 1024
          ? 'размер превышает 30 МБ.'
          : 'формат не поддерживается. Выберите PDF, Word, Excel, CSV, TXT, PNG или JPG.')
      }).join('\n'))
      return
    }
    setIsSaving(true); setActionError(''); setSuccessMessage('')
    try {
      let doc
      if (API_ENABLED) {
        doc = await apiRequest(editingDoc ? '/api/documents/' + editingDoc.id : '/api/documents', {
          method: editingDoc ? 'PUT' : 'POST', body: payload
        })
        const uploadFailures = []
        let uploadedCount = 0
        for (const upload of uploads) {
          try {
            const formData = new FormData()
            formData.append('file', upload)
            await apiRequest('/api/documents/' + doc.id + '/files', { method: 'POST', body: formData })
            uploadedCount++
          } catch (error) {
            uploadFailures.push(upload.name + ': ' + (error.message || 'не удалось прикрепить файл.'))
          }
        }
        await refreshDocuments()
        setSuccessMessage((editingDoc ? 'Карточка и история редакций обновлены.' : 'Карточка добавлена в общую базу.')
          + (uploads.length ? ' Прикреплено файлов: ' + uploadedCount + ' из ' + uploads.length + '.' : ''))
        if (uploadFailures.length) setActionError('Карточка сохранена, но не все файлы удалось прикрепить:\n' + uploadFailures.join('\n'))
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
        const uploadFailures = []
        let uploadedCount = 0
        for (const upload of uploads) {
          try {
            await saveLocalAttachment(doc.id, upload)
            uploadedCount++
          } catch (error) {
            uploadFailures.push(upload.name + ': ' + (error.message || 'не удалось сохранить файл в браузере.'))
          }
        }
        setSuccessMessage('Карточка сохранена в текущем браузере.'
          + (uploads.length ? ' Прикреплено файлов: ' + uploadedCount + ' из ' + uploads.length + '.' : '')
          + ' Для общей базы подключите API.')
        if (uploadFailures.length) setActionError('Карточка сохранена, но не все файлы удалось прикрепить:\n' + uploadFailures.join('\n'))
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
            if (!API_ENABLED && ['monitoring', 'users', 'tasks', 'notifications'].includes(item.id)) return false
            if (item.id === 'users' && currentUser?.role !== 'ADMIN') return false
            if (item.id === 'audit' && (!API_ENABLED || currentUser?.role !== 'ADMIN')) return false
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

            <section className="home-shortcuts" aria-label="Быстрые рабочие действия">
              <div className="section-title-row compact">
                <div><div className="section-kicker">БЫСТРЫЕ ДЕЙСТВИЯ</div><h2>Продолжить работу</h2><p>Переход к частым задачам платформы.</p></div>
              </div>
              <div className="home-shortcuts-grid">
                <button type="button" className="home-shortcut-card" onClick={() => openSection('processes')}>
                  <span className="home-shortcut-icon"><Workflow size={19} /></span>
                  <span><b>Бизнес-процессы</b><small>Открыть инструкции и чек-листы</small></span>
                  <ArrowUpRight size={16} />
                </button>
                <button type="button" className="home-shortcut-card" onClick={() => openSection('assistant')}>
                  <span className="home-shortcut-icon"><Bot size={19} /></span>
                  <span><b>Спросить ИИ-помощника</b><small>Найти сведения по маркировке</small></span>
                  <ArrowUpRight size={16} />
                </button>
                <button type="button" className="home-shortcut-card" onClick={() => openSection('monitoring')}>
                  <span className="home-shortcut-icon"><RefreshCw size={19} /></span>
                  <span><b>Источники и проверки</b><small>Перейти к контролю источников</small></span>
                  <ArrowUpRight size={16} />
                </button>
                <button type="button" className="home-shortcut-card" onClick={() => openSection('groups')}>
                  <span className="home-shortcut-icon"><Boxes size={19} /></span>
                  <span><b>Товарные группы</b><small>Найти группу и рабочий контур</small></span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </section>

            {API_ENABLED && <MyTasksPanel currentUser={currentUser} canAssign={['ADMIN','EDITOR'].includes(currentUser?.role)} />}
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
              <div className="home-favorites-panel workbench-panel">
                <div className="workbench-panel-title"><span className="workbench-panel-icon"><Star size={17}/></span><div><b>Избранные материалы</b><small>{favoriteDocumentIds.length ? 'Личные закладки для быстрого доступа' : 'Сохраняйте важные документы'}</small></div></div>
                {documents.filter(doc => favoriteDocumentIds.includes(String(doc.id))).length ? documents.filter(doc => favoriteDocumentIds.includes(String(doc.id))).slice(0, 5).map(doc => (
                  <div className="favorite-document-row" key={doc.id}>
                    <button type="button" className="recent-document favorite-document-open" onClick={() => { setActive('documents'); setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы'); syncRoute('documents', doc.id); setSelectedDoc(doc) }}>
                      <span className={'recent-jurisdiction ' + (isMzkmCatalogDocument(doc) ? 'ru' : (jurisdictions[doc.jurisdiction]?.className || ''))}>{isMzkmCatalogDocument(doc) ? 'МЗКМ' : (jurisdictions[doc.jurisdiction]?.short || 'НПА')}</span>
                      <span className="recent-copy"><b>{doc.title}</b><small>{doc.documentNumber ? '№ ' + doc.documentNumber + ' · ' : ''}{doc.kind || 'Материал'} · {doc.statusLabel || doc.status || 'Без статуса'}</small></span>
                    </button>
                    <button type="button" className="favorite-remove-button" onClick={() => toggleFavoriteDocument(doc)} aria-label={'Убрать из избранного: ' + doc.title} title="Убрать из избранного"><Star size={15} fill="currentColor"/></button>
                  </div>
                )) : <div className="workbench-empty">Откройте материал и нажмите «В избранное», чтобы закрепить его здесь.</div>}
              </div>
              {!API_ENABLED && <div className="workbench-demo-note"><CircleHelp size={14}/> Сейчас показан демонстрационный режим. Счётчики юридической проверки появятся после подключения API и загрузки общей базы.</div>}
            </section>

            <div className="section-title-row"><div><div className="section-kicker">БЫСТРЫЙ ДОСТУП</div><h2>Выберите направление</h2><p>Каждый контур – отдельная нормативная область</p></div><span className="muted-count">03 направления</span></div>
            <section className="jurisdiction-grid">
              <JurisdictionCard code="RU" title="МЗКМ" subtitle="Российская Федерация" description="Законы РФ, нормативные акты и материалы системы «Честный ЗНАК»." count="Нормативная база РФ" onClick={() => openSection('RU')} />
              <JurisdictionCard code="KG" title="ГАИС МТ" subtitle="Кыргызская Республика" description="Национальное законодательство, положения и внутренние документы оператора." count="Нормативная база КР" onClick={() => openSection('KG')} />
              <JurisdictionCard code="EAEU" title="ЕАЭС" subtitle="Наднациональное регулирование" description="Соглашения, решения ЕЭК и документы для трансграничных процессов." count="Общие правила" onClick={() => openSection('EAEU')} />
            </section>

            <div className="section-title-row compact">
              <div><div className="section-kicker">НАВИГАЦИЯ</div><h2>Рабочие системы</h2><p>Быстрый переход к рабочим сервисам, тестовым контурам и внутренним инструментам.</p></div>
              <span className="muted-count">12 ссылок</span>
            </div>
            <section className="system-grid" aria-label="Ссылки на рабочие системы">
              <a className="system-card" href="https://label.teksher.kg" target="_blank" rel="noopener noreferrer"><span className="system-icon blue"><ExternalLink size={20} /></span><span className="system-copy"><b>МЗКМ «Текшер»</b><small>Внешний контур · РФ</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://main.teksher.kg" target="_blank" rel="noopener noreferrer"><span className="system-icon green"><ExternalLink size={20} /></span><span className="system-copy"><b>ГАИС МТ</b><small>Внутренний контур · КР</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://admin-nc2.teksher.kg/auth" target="_blank" rel="noopener noreferrer"><span className="system-icon blue"><ExternalLink size={20} /></span><span className="system-copy"><b>Нац-каталог</b><small>Административный интерфейс</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://dex.teksher.kg/" target="_blank" rel="noopener noreferrer"><span className="system-icon green"><ExternalLink size={20} /></span><span className="system-copy"><b>Цифровой акциз</b><small>Система цифрового акциза</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="http://mzkm-front.mzkm-test.megacom.local/sign-in" target="_blank" rel="noopener noreferrer"><span className="system-icon blue"><ExternalLink size={20} /></span><span className="system-copy"><b>Тест МЗКМ</b><small>Тестовый контур · МЗКМ</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://markirovka-stage02.teksher.kg/login-kep" target="_blank" rel="noopener noreferrer"><span className="system-icon green"><ExternalLink size={20} /></span><span className="system-copy"><b>Тест ГАИС</b><small>Тестовый контур · ГАИС МТ</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="http://teksher-web-new.megacom.local/sign-in" target="_blank" rel="noopener noreferrer"><span className="system-icon blue"><ExternalLink size={20} /></span><span className="system-copy"><b>Биллинг</b><small>Учёт и расчёты</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://uchkun.atlassian.net/jira/software/projects/KAN/list?jql=project%20%3D%20KAN%20ORDER%20BY%20cf%5B10019%5D%20ASC" target="_blank" rel="noopener noreferrer"><span className="system-icon green"><ExternalLink size={20} /></span><span className="system-copy"><b>Jira</b><small>Задачи проекта KAN</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://esf.salyk.kg/esf/view/user/login.xhtml?faces-redirect=true" target="_blank" rel="noopener noreferrer"><span className="system-icon blue"><ExternalLink size={20} /></span><span className="system-copy"><b>ЭСФ</b><small>Электронные счета-фактуры</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="https://infodocs.srs.kg/login" target="_blank" rel="noopener noreferrer"><span className="system-icon green"><ExternalLink size={20} /></span><span className="system-copy"><b>СЭД</b><small>Система электронного документооборота</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="http://10.242.17.100:8800/admin/master/console/#/crm_prod_realm/users" target="_blank" rel="noopener noreferrer"><span className="system-icon blue"><ExternalLink size={20} /></span><span className="system-copy"><b>Админка</b><small>Управление пользователями · CRM</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
              <a className="system-card" href="http://10.242.17.232:8090/login.action" target="_blank" rel="noopener noreferrer"><span className="system-icon green"><ExternalLink size={20} /></span><span className="system-copy"><b>Конфа</b><small>Внутренняя корпоративная система</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
            </section>
          </> : selectedDoc ? <DocumentDetail doc={selectedDoc} onBack={() => { if (window.history.state?.app === 'teksher-hub') window.history.back(); else { setSelectedDoc(null); syncRoute(active, null, true) } }}
              isFavorite={favoriteDocumentIds.includes(String(selectedDoc.id))} onToggleFavorite={() => toggleFavoriteDocument(selectedDoc)}
              onEdit={() => { setEditingDoc(selectedDoc); setShowCreateModal(true) }}
              onDelete={() => handleDeleteDocument(selectedDoc)}
              canEdit={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)}
              canDelete={!API_ENABLED || currentUser?.role === 'ADMIN'}
              canReview={API_ENABLED && ['ADMIN','EDITOR'].includes(currentUser?.role)}
              files={API_ENABLED ? apiFiles : localAttachmentFiles} versions={documentVersions} documents={documents} onOpenRelated={docId => { const related = documents.find(item => item.id === docId); if (related) openDocument(related) }} onDownload={handleDownloadFile} onUploadFile={handleUploadAttachment} uploadingFile={isUploadingAttachment} canUploadFiles={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)} onReview={handleReviewDocument} canReindex={API_ENABLED && ['ADMIN','EDITOR'].includes(currentUser?.role)} onReindexFile={handleReindexFile} reindexingFileId={reindexingFileId} />
            : active === 'assistant' ? <AiAssistantSection apiEnabled={API_ENABLED} isAdmin={currentUser?.role === 'ADMIN'} onOpenDocument={docId => { const target = documents.find(item => String(item.id) === String(docId)); if (target) { setActive('documents'); setSelectedDoc(target); setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы'); syncRoute('documents', target.id) } }} />
            : active === 'knowledge' ? <KnowledgeCenterSection documents={documents} onSelectKind={(kind) => { setActive('documents'); setSelectedDoc(null); setQuery(''); setFilter(kind); setStatusFilter('Все статусы'); syncRoute('documents') }} onOpenAll={() => openSection('documents')} onAdd={openNewDocumentModal} canAdd={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)} />
            : active === 'groups' ? <ProductGroupsSection onOpen={openSection} onSearchGroup={searchProductGroupMaterials} canManage={!API_ENABLED || ["ADMIN", "EDITOR"].includes(currentUser?.role)} />
            : active === 'processes' ? <ProcessGuidesSection key={currentUser?.username || 'local'} progressStorageKey={API_ENABLED ? PROCESS_PROGRESS_KEY + ':' + (currentUser?.username || 'anonymous') : PROCESS_PROGRESS_KEY} onSearchMaterials={searchProductGroupMaterials} canEdit={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)} canDelete={!API_ENABLED || currentUser?.role === 'ADMIN'} />
            : active === 'monitoring' ? <MonitorSection monitors={monitors} canManage={['ADMIN','EDITOR'].includes(currentUser?.role)}
                onAdd={() => { setActionError(''); setMonitorModalOpen(true) }} onCheck={handleCheckMonitor} onDelete={handleDeleteMonitor} />
            : active === 'users' ? <UsersSection users={users} onAdd={() => { setActionError(''); setUserModalOpen(true) }} onToggle={handleToggleUser} onReset={user => { setActionError(''); setPasswordResetTarget(user) }} />
            : active === 'audit' && currentUser?.role === 'ADMIN' ? <AuditLogSection />
            : active === 'tasks' ? <MyTasksPanel currentUser={currentUser} canAssign={['ADMIN','EDITOR'].includes(currentUser?.role)} />
            : active === 'notifications' ? <NotificationsSection onOpenTasks={() => openSection('tasks')} />
            : <>
            <div className="page-heading">
              <div><div className="section-kicker">{active === 'favorites' ? 'ЛИЧНАЯ ПОДБОРКА' : 'БАЗА ЗНАНИЙ / ' + (active === 'RU' ? 'МЗКМ' : active === 'KG' ? 'ГАИС МТ · КР' : (jurisdictions[active]?.short || 'TEKSHER HUB'))}</div><h1>{pageTitle}</h1><p>{active === 'RU' ? 'Материалы МЗКМ, инструкции оператора и нормативные источники для маркировки товаров при обороте в РФ. Исходная юрисдикция каждого источника указана в карточке.' : active === 'KG' ? 'Национальные документы Кыргызской Республики и материалы ГАИС МТ. Карточки, классифицированные как МЗКМ, вынесены в отдельный каталог.' : active === 'favorites' ? 'Сохранённые вами нормативные акты, инструкции и рабочие материалы. Нажмите звезду в карточке документа, чтобы добавить его в эту подборку.' : jurisdictions[active] ? `Документы и материалы: ${jurisdictions[active].label}. ` : 'Поиск по нормативным актам и рабочим материалам платформы.'}{API_ENABLED ? ' Проверяйте реквизиты и статус каждого документа перед применением.' : ' Демонстрационные записи не являются официальной нормативной базой.'}</p></div>
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
            <div className="document-list">{filteredDocuments.length ? filteredDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} onClick={() => openDocument(doc)} canEdit={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)} onEdit={() => { setEditingDoc(doc); setActionError(''); setShowCreateModal(true) }} />) : <div className="empty-state"><Search size={28} /><b>{active === 'groups' ? 'Справочник товарных групп пока пуст' : active === 'processes' ? 'Бизнес-процессы ещё не добавлены' : 'Ничего не найдено'}</b><span>{['groups', 'processes'].includes(active) ? 'Добавь первую карточку через форму. Она сохранится в этом браузере.' : 'Измени поисковый запрос или фильтр.'}</span>{['groups', 'processes'].includes(active) && (!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)) && <button className="secondary-button" onClick={openNewDocumentModal}>Добавить первую запись</button>}</div>}</div>
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

const COSMETICS_TNVED_GROUP = 'Косметика, бытовая химия и товары личной гигиены'
const normalizeTnvedGroup = groupName => groupName === 'Бритвы' ? COSMETICS_TNVED_GROUP : groupName

function normalizeTnvedSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
}

const TNVED_SEARCH_SYNONYMS = [
  { group: 'Обувные товары', scope: 'MZKM', terms: ['обувь', 'кроссовки', 'ботинки', 'туфли', 'сапоги', 'сандалии', 'сланцы', 'кеды'] },
  { group: 'Белье постельное, столовое, туалетное и кухонное', scope: 'MZKM', terms: ['постельное белье', 'постельное бельё', 'простыни', 'наволочки', 'полотенца', 'кухонный текстиль', 'скатерти', 'белье'] },
  { group: 'Предметы одежды', scope: 'MZKM', terms: ['одежда', 'футболка', 'футболки', 'рубашка', 'рубашки', 'брюки', 'джинсы', 'куртка', 'платье', 'трикотаж'] },
  { group: 'Духи и туалетная вода', scope: 'MZKM', terms: ['духи', 'парфюм', 'парфюмерия', 'туалетная вода', 'одеколон'] },
  { group: 'Фотокамеры (кроме кинокамер), фотовспышки и лампы-вспышки', scope: 'MZKM', terms: ['камера', 'фотоаппарат', 'фотокамера', 'фотовспышка', 'фотооборудование'] },
  { group: 'Молочная продукция', scope: 'MZKM', terms: ['молоко', 'сыр', 'йогурт', 'кефир', 'сливки', 'творог', 'молочка', 'молочная продукция'] },
  { group: 'Продукты, используемые для кормления животных', scope: 'MZKM', terms: ['корм', 'корма', 'корм для кошек', 'корм для собак', 'корм для животных', 'зоокорм', 'питание животных'] },
  { group: COSMETICS_TNVED_GROUP, scope: 'MZKM', terms: ['косметика', 'шампунь', 'шампуни', 'бальзам', 'мыло', 'зубная паста', 'дезодорант', 'крем для лица', 'средство гигиены', 'бытовая химия', 'моющее средство', 'средство для мытья'] },
  { group: COSMETICS_TNVED_GROUP, scope: 'MZKM', matchGroup: false, sourceGroup: 'Бритвы', terms: ['бритва', 'бритвы', 'бритье', 'бритья', 'лезвие', 'лезвия', 'лезвие для бритья', 'бритвенный станок', 'станок для бритья'] },
  { group: 'Моторные масла, смазочные материалы, тормозные жидкости и антифризы', scope: 'MZKM', terms: ['моторное масло', 'масло моторное', 'антифриз', 'смазка', 'тормозная жидкость', 'техническая жидкость'] },
  { group: 'Игры и игрушки для детей', scope: 'MZKM', terms: ['игрушка', 'игрушки', 'кукла', 'конструктор', 'пазл', 'настольная игра', 'детская игрушка'] },
  { group: 'Алкоголь', scope: 'INTERNAL', terms: ['алкоголь', 'водка', 'вино', 'пиво', 'спиртные напитки'] },
  { group: 'Табак', scope: 'INTERNAL', terms: ['табак', 'сигареты', 'табачная продукция', 'табачные изделия'] },
]

const PRODUCT_GROUPS_STORAGE_KEY = 'teksher-hub-product-groups-v1'
const DEFAULT_MZKM_GROUPS = ['Обувные товары', 'Белье постельное, столовое, туалетное и кухонное', 'Предметы одежды', 'Духи и туалетная вода', 'Фотокамеры (кроме кинокамер), фотовспышки и лампы-вспышки', 'Молочная продукция', 'Продукты, используемые для кормления животных', 'Косметика, бытовая химия и товары личной гигиены', 'Моторные масла, смазочные материалы, тормозные жидкости и антифризы', 'Игры и игрушки для детей']
const DEFAULT_INTERNAL_GROUPS = [
 { name: 'Алкоголь', description: 'Национальная внутренняя маркировка Кыргызской Республики. Применимость и способ маркировки проверять по действующим актам КР и официальным методическим правилам.', source: 'https://main.teksher.kg/internal-marking.html' },
 { name: 'Табак', description: 'Национальная внутренняя маркировка Кыргызской Республики. Для конкретного вида продукции проверять действующие требования и методические правила.', source: 'https://main.teksher.kg/internal-marking.html' }
]
function loadProductGroups() {
 try {
  const saved = JSON.parse(window.localStorage.getItem(PRODUCT_GROUPS_STORAGE_KEY) || 'null')
  if (saved && Array.isArray(saved.mzkmGroups) && Array.isArray(saved.internalGroups)) {
   return { ...saved, mzkmDetails: saved.mzkmDetails && typeof saved.mzkmDetails === 'object' ? saved.mzkmDetails : {} }
  }
 } catch { /* defaults */ }
 return { mzkmGroups: DEFAULT_MZKM_GROUPS, internalGroups: DEFAULT_INTERNAL_GROUPS, mzkmDetails: {} }
}
function ProductGroupsSection({ onOpen, onSearchGroup, canManage = false }) {
 const [groupData, setGroupData] = useState(loadProductGroups)
 const [editingGroup, setEditingGroup] = useState(null)
 const [groupDraft, setGroupDraft] = useState({ name: '', description: '', source: '' })
 const [catalogReady, setCatalogReady] = useState(!API_ENABLED)
 const [catalogLoadOk, setCatalogLoadOk] = useState(!API_ENABLED)
 const [catalogSaveState, setCatalogSaveState] = useState('')
 const mzkmGroups = groupData.mzkmGroups
 const internalGroups = groupData.internalGroups
 useEffect(() => {
  if (!API_ENABLED) return
  let cancelled = false
  apiRequest('/api/product-groups').then(result => {
   if (cancelled) return
   if (result?.payload && Array.isArray(result.payload.mzkmGroups) && Array.isArray(result.payload.internalGroups)) {
    setGroupData({ mzkmGroups: result.payload.mzkmGroups, internalGroups: result.payload.internalGroups, mzkmDetails: result.payload.mzkmDetails || {} })
   }
   setCatalogLoadOk(true)
  }).catch(error => {
   if (!cancelled) setCatalogSaveState('Не удалось загрузить общий каталог: ' + error.message)
  }).finally(() => { if (!cancelled) setCatalogReady(true) })
  return () => { cancelled = true }
 }, [])
 useEffect(() => {
  if (!catalogReady) return
  try { window.localStorage.setItem(PRODUCT_GROUPS_STORAGE_KEY, JSON.stringify(groupData)) } catch { /* storage unavailable */ }
  if (!API_ENABLED || !canManage || !catalogLoadOk) return
  let cancelled = false
  setCatalogSaveState('Сохранение…')
  apiRequest('/api/product-groups', { method: 'PUT', body: groupData }).then(() => {
   if (!cancelled) setCatalogSaveState('Сохранено в общей базе')
  }).catch(error => {
   if (!cancelled) setCatalogSaveState('Ошибка сохранения: ' + error.message)
  })
  return () => { cancelled = true }
 }, [groupData, catalogReady, catalogLoadOk, canManage])
 const openGroupEditor = (scope, index = -1) => {
  const existing = scope === 'MZKM' ? mzkmGroups[index] : internalGroups[index]
  const detail = scope === 'MZKM' && existing ? (groupData.mzkmDetails?.[existing] || {}) : {}
  setEditingGroup({ scope, index })
  setGroupDraft(scope === 'MZKM'
   ? { name: existing || '', description: detail.description || '', source: detail.source || '' }
   : existing ? { ...existing } : { name: '', description: 'Национальная внутренняя маркировка Кыргызской Республики. Требования проверять по действующим нормативным актам.', source: 'https://main.teksher.kg/internal-marking.html' })
 }
 const saveGroup = event => {
  event.preventDefault()
  const name = groupDraft.name.trim()
  if (!name || !editingGroup) return
  setGroupData(previous => {
   if (editingGroup.scope === 'MZKM') {
    const next = [...previous.mzkmGroups]
    const oldName = editingGroup.index < 0 ? '' : next[editingGroup.index]
    if (editingGroup.index < 0) next.push(name); else next[editingGroup.index] = name
    const details = { ...(previous.mzkmDetails || {}) }
    const item = { description: groupDraft.description.trim(), source: groupDraft.source.trim() }
    if (oldName && oldName !== name) delete details[oldName]
    if (item.description || item.source) details[name] = item
    else delete details[name]
    return { ...previous, mzkmGroups: next, mzkmDetails: details }
   }
   const next = [...previous.internalGroups]
   const item = { name, description: groupDraft.description.trim(), source: groupDraft.source.trim() }
   if (editingGroup.index < 0) next.push(item); else next[editingGroup.index] = item
   return { ...previous, internalGroups: next }
  })
  setEditingGroup(null)
 }
 const deleteGroup = (scope, index) => {
  if (!window.confirm('Удалить эту товарную группу?')) return
  setGroupData(previous => scope === 'MZKM' ? { ...previous, mzkmGroups: previous.mzkmGroups.filter((_, i) => i !== index) } : { ...previous, internalGroups: previous.internalGroups.filter((_, i) => i !== index) })
 }

  const [tnvedCatalog, setTnvedCatalog] = useState([])
  const [tnvedLoading, setTnvedLoading] = useState(true)
  const [tnvedLoadError, setTnvedLoadError] = useState('')
  const [tnvedMode, setTnvedMode] = useState('code')
  const [tnvedScope, setTnvedScope] = useState('ALL')
  const [tnvedInput, setTnvedInput] = useState('')
  const [tnvedSubmitted, setTnvedSubmitted] = useState(null)
  const [tnvedSuggestionsOpen, setTnvedSuggestionsOpen] = useState(false)
  const [tnvedSuggestionIndex, setTnvedSuggestionIndex] = useState(-1)
  const tnvedAutocompleteRef = useRef(null)
  const [tnvedGroupFilter, setTnvedGroupFilter] = useState('')
  const [tnvedValidation, setTnvedValidation] = useState('')
  const [tnvedPage, setTnvedPage] = useState(0)
  const [showInternalGskp, setShowInternalGskp] = useState('')
  const [tnvedCopyMessage, setTnvedCopyMessage] = useState('')

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

  useEffect(() => {
    const handleOutsideClick = event => {
      if (!tnvedAutocompleteRef.current?.contains(event.target)) {
        setTnvedSuggestionsOpen(false)
        setTnvedSuggestionIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const tnvedGroupCounts = useMemo(() => {
    const counts = new Map()
    tnvedCatalog.forEach(row => {
      const key = row.t + '|' + normalizeTnvedGroup(row.g)
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [tnvedCatalog])

  const tnvedCodePrefix = tnvedInput.replace(/[.\s-]/g, '')
  const tnvedSuggestionMatches = useMemo(() => {
    if (tnvedMode !== 'code' || !/^\d+$/.test(tnvedCodePrefix) || !tnvedCodePrefix || tnvedLoading || tnvedLoadError) return []
    const matches = tnvedCatalog.filter(row => {
      if (tnvedScope === 'MZKM' && row.t !== 'MZKM') return false
      if (tnvedScope === 'INTERNAL' && row.t !== 'INTERNAL') return false
      return String(row.c || '').startsWith(tnvedCodePrefix)
    })
    const unique = new Map()
    matches.forEach(row => {
      const key = [row.t, row.c, row.n, row.g].join('|')
      if (!unique.has(key)) unique.set(key, row)
    })
    return Array.from(unique.values()).sort((a, b) =>
      String(a.c).localeCompare(String(b.c)) ||
      String(a.n).localeCompare(String(b.n), 'ru') ||
      String(a.g).localeCompare(String(b.g), 'ru')
    )
  }, [tnvedCatalog, tnvedCodePrefix, tnvedMode, tnvedScope, tnvedLoading, tnvedLoadError])
  const tnvedSuggestions = tnvedSuggestionMatches.slice(0, 8)

  const chooseTnvedSuggestion = row => {
    const code = String(row?.c || '')
    if (!code) return
    setTnvedMode('code')
    setTnvedInput(code)
    setTnvedSubmitted(code)
    setTnvedGroupFilter('')
    setTnvedValidation('')
    setTnvedPage(0)
    setShowInternalGskp('')
    setTnvedSuggestionsOpen(false)
    setTnvedSuggestionIndex(-1)
  }

  const handleTnvedInputKeyDown = event => {
    if (tnvedMode !== 'code' || !tnvedSuggestionsOpen) {
      if (event.key === 'Escape') setTnvedSuggestionsOpen(false)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setTnvedSuggestionsOpen(false)
      setTnvedSuggestionIndex(-1)
    } else if (event.key === 'ArrowDown' && tnvedSuggestions.length) {
      event.preventDefault()
      setTnvedSuggestionIndex(index => Math.min(tnvedSuggestions.length - 1, index + 1))
    } else if (event.key === 'ArrowUp' && tnvedSuggestions.length) {
      event.preventDefault()
      setTnvedSuggestionIndex(index => Math.max(-1, index - 1))
    } else if (event.key === 'Enter' && tnvedSuggestionIndex >= 0 && tnvedSuggestions[tnvedSuggestionIndex]) {
      event.preventDefault()
      chooseTnvedSuggestion(tnvedSuggestions[tnvedSuggestionIndex])
    }
  }

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
    setTnvedSuggestionsOpen(false)
    setTnvedSuggestionIndex(-1)
  }

  const copyTnvedCode = async code => {
    try {
      const value = String(code || '')
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const field = document.createElement('textarea')
        field.value = value
        field.setAttribute('readonly', '')
        field.style.position = 'fixed'
        field.style.opacity = '0'
        document.body.appendChild(field)
        field.select()
        const copied = document.execCommand('copy')
        field.remove()
        if (!copied) throw new Error('Копирование недоступно в этом браузере.')
      }
      setTnvedCopyMessage('Код ' + value + ' скопирован')
      window.setTimeout(() => setTnvedCopyMessage(''), 2200)
    } catch {
      setTnvedCopyMessage('Не удалось скопировать код. Выделите его и скопируйте вручную.')
    }
  }

  const exportTnvedResults = () => {
    if (!tnvedResults.length) return
    const headers = ['Код ТН ВЭД', 'Наименование товара', 'Товарная группа', 'Список', 'Код ГСКП', 'Наименование ГСКП']
    const safeCell = value => {
      const raw = String(value ?? '')
      const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw
      return '"' + safe.replace(/"/g, '""') + '"'
    }
    const lines = [headers, ...tnvedResults.map(row => [
      row.c, row.n, normalizeTnvedGroup(row.g), row.t === 'INTERNAL' ? 'Внутренняя маркировка КР' : 'МЗКМ', row.gc || '', row.gn || ''
    ])].map(row => row.map(safeCell).join(';')).join('\r\n')
    const blob = new Blob(['\uFEFF', lines], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tnved-results-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const tnvedResults = useMemo(() => {
    if (!tnvedCatalog.length || tnvedSubmitted === null) return []
    const query = normalizeTnvedSearchText(tnvedSubmitted === '__GROUP__' ? '' : tnvedSubmitted)
    const synonymMatches = tnvedMode === 'name' && query.length >= 2
      ? TNVED_SEARCH_SYNONYMS.filter(item => item.terms.some(term => {
          const normalized = normalizeTnvedSearchText(term)
          return normalized === query || (query.length >= 3 && (normalized.startsWith(query) || normalized.includes(query)))
        }))
      : []
    const matchRank = row => {
      if (tnvedScope === 'MZKM' && row.t !== 'MZKM') return -1
      if (tnvedScope === 'INTERNAL' && row.t !== 'INTERNAL') return -1
      if (tnvedGroupFilter && normalizeTnvedGroup(row.g) !== tnvedGroupFilter) return -1
      if (tnvedSubmitted === '__GROUP__') return 0
      if (tnvedMode === 'code') return String(row.c || '').startsWith(query.replace(/\s/g, '')) ? 0 : -1

      const haystack = normalizeTnvedSearchText([
        row.n, row.g, normalizeTnvedGroup(row.g), row.c, row.p, row.gc, row.gn
      ].filter(Boolean).join(' '))
      if (haystack.includes(query)) return 0

      const rowScopeMatches = item => !item.scope || (item.scope === 'INTERNAL' ? row.t === 'INTERNAL' : row.t === 'MZKM')
      const synonymSpecificRowMatch = synonymMatches.some(item =>
        item.matchGroup === false
        && normalizeTnvedSearchText(item.sourceGroup || '') === normalizeTnvedSearchText(row.g)
        && rowScopeMatches(item)
      )
      if (synonymSpecificRowMatch) return 1

      const synonymGroupMatch = synonymMatches.some(item =>
        item.matchGroup !== false
        && normalizeTnvedGroup(row.g) === item.group
        && rowScopeMatches(item)
      )
      return synonymGroupMatch ? 2 : -1
    }

    return tnvedCatalog
      .map(row => ({ row, rank: matchRank(row) }))
      .filter(item => item.rank >= 0)
      .sort((a, b) => a.rank - b.rank
        || String(a.row.c).localeCompare(String(b.row.c))
        || String(a.row.g).localeCompare(String(b.row.g), 'ru'))
      .map(item => item.row)
  }, [tnvedCatalog, tnvedSubmitted, tnvedMode, tnvedScope, tnvedGroupFilter])

  const tnvedPageSize = 25
  const tnvedPageCount = Math.max(1, Math.ceil(tnvedResults.length / tnvedPageSize))
  const tnvedVisibleResults = tnvedResults.slice(tnvedPage * tnvedPageSize, (tnvedPage + 1) * tnvedPageSize)
  const getCount = (group, scope) => tnvedGroupCounts.get(scope + '|' + group) || 0

  return <div className="product-groups-page">
    {editingGroup && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditingGroup(null) }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="product-group-editor-title"><div className="modal-header"><h2 id="product-group-editor-title">{editingGroup.index < 0 ? 'Добавить товарную группу' : 'Редактировать товарную группу'}</h2><button type="button" className="icon-button" onClick={() => setEditingGroup(null)} aria-label="Закрыть"><X size={18}/></button></div><form onSubmit={saveGroup}><label>Название группы<input required maxLength={240} value={groupDraft.name} onChange={event => setGroupDraft(draft => ({ ...draft, name: event.target.value }))}/></label><label>Описание<textarea rows={4} value={groupDraft.description} onChange={event => setGroupDraft(draft => ({ ...draft, description: event.target.value }))} placeholder="Добавьте описание товарной группы"/></label><label>Ссылка на источник<input type="url" value={groupDraft.source} onChange={event => setGroupDraft(draft => ({ ...draft, source: event.target.value }))} placeholder="https://..."/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditingGroup(null)}>Отмена</button><button type="submit" className="primary-button">Сохранить</button></div></form></section></div>}
    {API_ENABLED && catalogSaveState && <div className="notice" role="status"><div>{catalogSaveState}</div></div>}
    <div className="page-heading">
      <div>
        <div className="section-kicker">СПРАВОЧНИК / МАРКИРОВКА ТОВАРОВ</div>
        <h1>Товарные группы</h1>
        <p>Единые группы МЗКМ, национальные товарные группы КР и поиск кодов ТН ВЭД по предоставленному перечню.</p>
      </div>
      <div className="record-count">{mzkmGroups.length} групп МЗКМ · {internalGroups.length} внутренних</div>
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
          <div className="tnved-input-autocomplete" ref={tnvedAutocompleteRef}>
            <input
              id="tnved-search-input"
              value={tnvedInput}
              onChange={event => {
                const nextValue = event.target.value
                setTnvedInput(nextValue)
                setTnvedSubmitted(null)
                setTnvedGroupFilter('')
                setTnvedValidation('')
                setTnvedSuggestionIndex(-1)
                setTnvedSuggestionsOpen(tnvedMode === 'code')
              }}
              onFocus={() => {
                if (tnvedMode === 'code' && /^\d+$/.test(tnvedCodePrefix) && tnvedCodePrefix) {
                  setTnvedSuggestionsOpen(true)
                }
              }}
              onKeyDown={handleTnvedInputKeyDown}
              placeholder={tnvedMode === 'code' ? 'Например, 950300 или 9503005500' : 'Например, шампунь, обувь, детская игрушка'}
              inputMode={tnvedMode === 'code' ? 'numeric' : 'search'}
              maxLength={tnvedMode === 'code' ? 15 : 160}
              aria-invalid={Boolean(tnvedValidation)}
              autoComplete="off"
              role={tnvedMode === 'code' ? 'combobox' : undefined}
              aria-autocomplete={tnvedMode === 'code' ? 'list' : undefined}
              aria-expanded={tnvedMode === 'code' && tnvedSuggestionsOpen && Boolean(tnvedCodePrefix)}
              aria-controls={tnvedMode === 'code' ? 'tnved-suggestions-list' : undefined}
              aria-activedescendant={tnvedSuggestionIndex >= 0 ? 'tnved-suggestion-' + tnvedSuggestionIndex : undefined}
            />
            {tnvedMode === 'code' && tnvedSuggestionsOpen && tnvedCodePrefix && /^\d+$/.test(tnvedCodePrefix) && !tnvedLoading && !tnvedLoadError && (
              <div className="tnved-suggestions" id="tnved-suggestions-list" role="listbox" aria-label="Подсказки кодов ТН ВЭД">
                <div className="tnved-suggestions-summary">
                  {tnvedSuggestionMatches.length
                    ? (tnvedSuggestionMatches.length > 8
                      ? 'Найдено вариантов: ' + tnvedSuggestionMatches.length.toLocaleString('ru-RU') + ' · показаны первые 8'
                      : 'Подходящие коды: ' + tnvedSuggestionMatches.length)
                    : 'Совпадений по этому началу кода нет'}
                </div>
                {tnvedSuggestions.length
                  ? tnvedSuggestions.map((row, index) => (
                    <button
                      key={[row.t, row.c, row.n, row.g].join('|')}
                      type="button"
                      id={'tnved-suggestion-' + index}
                      role="option"
                      aria-selected={tnvedSuggestionIndex === index}
                      className={'tnved-suggestion' + (tnvedSuggestionIndex === index ? ' active' : '')}
                      onMouseEnter={() => setTnvedSuggestionIndex(index)}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => chooseTnvedSuggestion(row)}
                    >
                      <span className="tnved-suggestion-main">
                        <strong>{row.c}</strong>
                        <span>{row.n}</span>
                      </span>
                      <span className="tnved-suggestion-meta">
                        <span>{normalizeTnvedGroup(row.g)}</span>
                        <small>{row.t === 'INTERNAL' ? 'Внутренняя КР' : 'МЗКМ'}</small>
                      </span>
                    </button>
                  ))
                  : <div className="tnved-suggestions-empty">В справочнике нет кодов с таким началом. Попробуйте изменить цифры или выбрать «Все списки».</div>}
              </div>
            )}
          </div>
          <button type="submit" className="primary-button" disabled={tnvedLoading}><Search size={16}/> Проверить</button>
        </div>
        {tnvedValidation && <div className="tnved-validation" role="alert">{tnvedValidation}</div>}
        {tnvedMode === 'code'
          ? <p className="tnved-input-help">Допускается ввод от 4 до 10 цифр. Поиск выполняется по началу кода.</p>
          : <p className="tnved-input-help">Поиск учитывает наименования, распространённые синонимы и соответствующие товарные группы. Например: «бритва», «кроссовки», «шампунь», «корм для кошек».</p>}
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
            {tnvedResults.length > 0 && <button type="button" className="tnved-export-button" onClick={exportTnvedResults}><Download size={14}/> Excel (CSV)</button>}
            <button type="button" className="tnved-clear-button" onClick={clearTnvedFilters}><X size={14}/> Сбросить</button>
          </div>
        </div>
        {tnvedCopyMessage && <div className="tnved-copy-feedback" role="status">{tnvedCopyMessage}</div>}

        {tnvedResults.length === 0
          ? <div className="tnved-empty"><Search size={22}/><b>Совпадений не найдено</b><span>Код или название не встретились в выбранном перечне Excel. Это не означает, что товар не подлежит маркировке.</span></div>
          : <>
            <div className="tnved-table-wrap">
              <table className="tnved-table">
                <thead><tr><th>Код ТН ВЭД</th><th>Наименование товара</th><th>Товарная группа</th><th>Список</th><th>ГСКП</th></tr></thead>
                <tbody>
                  {tnvedVisibleResults.map((row, index) => <tr key={row.t + '|' + row.c + '|' + row.g + '|' + row.r + '|' + index}>
                    <td><div className="tnved-code-actions"><button type="button" className="tnved-code-link" title="Показать все коды с этим началом" onClick={() => { setTnvedMode('code'); setTnvedInput(row.c); setTnvedSubmitted(row.c); setTnvedGroupFilter(''); setTnvedPage(0) }}>{row.c}</button><button type="button" className="tnved-copy-button" onClick={() => copyTnvedCode(row.c)} title="Копировать код ТН ВЭД" aria-label={'Копировать код ' + row.c}><Copy size={13}/></button></div></td>
                    <td className="tnved-product-name">{row.n}</td>
                    <td>{normalizeTnvedGroup(row.g)}</td>
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

    </section>

    <section className="mzkm-product-group-section">
      <div className="mzkm-section-heading">
        <div className="mzkm-section-icon"><Boxes size={19}/></div>
        <div>
          <div className="section-kicker">РУКОВОДСТВО МЗКМ v2.1 · 09.10.2026</div>
          <h2>Товарные группы МЗКМ</h2>
          <p>Единый список с титульной страницы руководства. Нажмите «Коды ТН ВЭД», чтобы открыть соответствующие строки из Excel.</p>
        </div>
        <span className="record-count">{mzkmGroups.length} групп</span>{canManage && <button type="button" className="secondary-button" onClick={() => openGroupEditor("MZKM")}>＋ Добавить группу</button>}
      </div>
      <section className="mzkm-groups-grid" aria-label="Единый список товарных групп МЗКМ v2.1">
        {mzkmGroups.map((name, index) => <article className="mzkm-group-card mzkm-group-card-interactive" key={name + index}>
          <div className="mzkm-group-number">{String(index + 1).padStart(2, '0')}</div>
          <div className="mzkm-group-copy">
            <h3>{name}</h3>
            <p>{getCount(name, 'MZKM')} кодов из Excel · МЗКМ v2.1</p>{groupData.mzkmDetails?.[name]?.description && <p>{groupData.mzkmDetails[name].description}</p>}{groupData.mzkmDetails?.[name]?.source && <a href={groupData.mzkmDetails[name].source} target="_blank" rel="noreferrer">Официальный источник <ExternalLink size={13}/></a>}{canManage && <div className="tnved-group-actions"><button type="button" className="tnved-group-button" onClick={() => openGroupEditor('MZKM', index)}><Pencil size={13}/> Изменить</button><button type="button" className="tnved-group-button" onClick={() => deleteGroup('MZKM', index)}><Trash2 size={13}/> Удалить</button></div>}
            <div className="tnved-group-actions">
              <button type="button" className="tnved-group-button primary" onClick={() => selectTnvedGroup(name, 'MZKM')}>Коды ТН ВЭД ({getCount(name, 'MZKM')})</button>
              <button type="button" className="tnved-group-button" onClick={() => onSearchGroup(name)}>Материалы</button>
            </div>
          </div>
        </article>)}
      </section>
    </section>

    <section className="internal-product-group-section">
      <div className="mzkm-section-heading">
        <div className="mzkm-section-icon internal"><ShieldCheck size={19}/></div>
        <div>
          <div className="section-kicker">КЫРГЫЗСКАЯ РЕСПУБЛИКА · НАЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ</div>
          <h2>Товарные группы внутренней маркировки</h2>
          <p>По официальному перечню и приложенному Excel внутренние коды представлены для алкоголя и табака.</p>
        </div>
        <span className="record-count">{internalGroups.length} групп</span>{canManage && <button type="button" className="secondary-button" onClick={() => openGroupEditor("INTERNAL")}>＋ Добавить группу</button>}
      </div>
      <section className="internal-groups-grid" aria-label="Товарные группы внутренней маркировки Кыргызстана">
        {internalGroups.map((group, index) => <article className="internal-group-card" key={group.name}>
          <div className="internal-group-badge">{String(index + 1).padStart(2, '0')}</div>
          <div className="internal-group-copy">
            <h3>{group.name}</h3>
            <p>{group.description}</p>{canManage && <div className="internal-group-actions"><button type="button" className="internal-group-find" onClick={() => openGroupEditor("INTERNAL", index)}><Pencil size={13}/> Изменить</button><button type="button" className="internal-group-find" onClick={() => deleteGroup("INTERNAL", index)}><Trash2 size={13}/> Удалить</button></div>}
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


const PROCESS_PROGRESS_KEY = 'teksher-hub-process-guide-progress-v1'
const PROCESS_GUIDES_STORAGE_KEY = 'teksher-hub-custom-process-guides-v1'

const PROCESS_GUIDES = [
  {
    id: 'registration',
    category: 'Доступ и участник',
    title: 'Регистрация участника и доступ',
    summary: 'Подготовить регистрацию, проверить реквизиты и безопасно получить доступ к рабочему контуру.',
    scope: 'МЗКМ / Текшер',
    time: '10–20 мин на проверку',
    searchTerm: 'регистрация',
    sources: [
      { label: 'Официальная страница регистрации', url: 'https://main.teksher.kg/register-mzkm.html' },
      { label: 'Портал «Текшер»', url: 'https://main.teksher.kg/' },
    ],
    steps: [
      { title: 'Открой актуальную страницу регистрации', detail: 'Проверь действующий порядок и форму обращения на официальном портале. Если порядок или ссылка изменились, используй текущую версию сайта.' },
      { title: 'Подготовь документы по своему типу участника', detail: 'Сверь необходимый пакет и требования к полномочиям представителя с актуальным списком оператора. Не полагайся на старую копию списка без перепроверки.' },
      { title: 'Проверь регистрационные реквизиты', detail: 'Сверь наименование организации или ИП, ИНН, контактную почту и данные ответственного лица. Ошибки в исходных данных могут затруднить регистрацию и поддержку.' },
      { title: 'Отправь заявление через официальный канал', detail: 'Сохрани подтверждение отправки, номер обращения и переписку с оператором. Не передавай пароль через письмо или мессенджер.' },
      { title: 'После подтверждения проверь доступ', detail: 'Войди по официальному адресу, проверь профиль участника, доступные товарные группы и условия договора. Пароль храни отдельно и не вводи его на сторонних страницах.' },
    ],
  },
  {
    id: 'product-card',
    category: 'Карточка товара',
    title: 'Создание и проверка карточки товара',
    summary: 'До заказа кодов убедиться, что выбран правильный товар, идентификатор и набор атрибутов.',
    scope: 'Карточка товара',
    time: '5 контрольных шагов',
    searchTerm: 'карточка товара',
    sources: [
      { label: 'Портал «Текшер»', url: 'https://main.teksher.kg/' },
      { label: 'Новости оператора и разъяснения', url: 'https://main.teksher.kg/news.html' },
    ],
    steps: [
      { title: 'Определи рабочую систему и товарную группу', detail: 'Проверь, в каком контуре выполняется операция, и выбери группу по характеристикам товара и актуальной инструкции. Не определяй обязательность маркировки только по названию группы.' },
      { title: 'Сверь код ТН ВЭД и описание товара', detail: 'Проверь полный код, описание, страну/сценарий оборота и применимые исключения. Поиск в справочнике помогает найти позицию, но не заменяет классификацию и проверку действующих правил.' },
      { title: 'Проверь GTIN и отсутствие дубликата', detail: 'Сверь идентификатор с упаковкой и данными производителя/поставщика. Не создавай повторную карточку только ради обхода ошибки уже существующей записи.' },
      { title: 'Заполни обязательные атрибуты выбранной группы', detail: 'Наименование, бренд, модель, состав, размер, объём и другие поля заполняй по фактическим сведениям о товаре и требованиям формы выбранной группы.' },
      { title: 'Проверь результат до публикации', detail: 'Перечитай карточку, проверь соответствие идентификаторов и атрибутов первичным документам, отправь её на предусмотренную системой проверку и дождись подходящего статуса перед следующим действием.' },
    ],
  },
  {
    id: 'order-codes',
    category: 'Заказ кодов',
    title: 'Заказ кодов маркировки',
    summary: 'Проверить готовность карточки, объём заказа, баланс и результат обработки заказа.',
    scope: 'Заказ КМ',
    time: '5 контрольных шагов',
    searchTerm: 'заказ',
    sources: [
      { label: 'Портал «Текшер»', url: 'https://main.teksher.kg/' },
      { label: 'Новости оператора', url: 'https://main.teksher.kg/news.html' },
    ],
    steps: [
      { title: 'Убедись, что карточка готова к заказу', detail: 'Проверь статус карточки, выбранную товарную группу, GTIN и необходимые атрибуты. Если карточка на проверке или отклонена, сначала устрани причину в установленном порядке.' },
      { title: 'Рассчитай нужное количество кодов', detail: 'Сверь планируемый объём партии, упаковку и тип операции. Не заказывай запас кода без понятной потребности и не превышай лимиты, которые показывает текущий интерфейс.' },
      { title: 'Проверь баланс и стоимость', detail: 'Перед подтверждением проверь доступный баланс, стоимость, валюту/конвертацию и правила списания в текущем интерфейсе и договоре. При сомнении не отправляй повторный заказ.' },
      { title: 'Отправь заказ и сохрани его реквизиты', detail: 'Запиши номер/идентификатор заказа, дату, количество и статус. Если система показала ошибку, сначала проверь, был ли заказ фактически создан.' },
      { title: 'Проверь готовность полученных кодов', detail: 'Убедись, что количество и статус соответствуют заказу. Загружай и храни файл кодов в рабочем защищённом месте; не редактируй сами значения DataMatrix.' },
    ],
  },
  {
    id: 'print-apply',
    category: 'Печать и нанесение',
    title: 'Печать, нанесение и контроль DataMatrix',
    summary: 'Проверить читаемость маркировки, соответствие упаковке и количество кодов до завершения партии.',
    scope: 'Печать и нанесение',
    time: '5 контрольных шагов',
    searchTerm: 'DataMatrix',
    sources: [
      { label: 'Портал «Текшер»', url: 'https://main.teksher.kg/' },
      { label: 'Новости оператора', url: 'https://main.teksher.kg/news.html' },
    ],
    steps: [
      { title: 'Подготовь коды и настройки печати', detail: 'Используй файл и формат, предусмотренные рабочим процессом. Не теряй управляющие разделители GS1 и не преобразуй строку DataMatrix обычным текстовым редактором.' },
      { title: 'Распечатай тестовую этикетку', detail: 'Проверь, что код не обрезан, не растянут и имеет достаточный контраст и свободное поле вокруг символа. Просканируй образец до запуска всей партии.' },
      { title: 'Сопоставь этикетку с конкретным товаром', detail: 'Убедись, что код относится к правильной карточке/GTIN и наносится на соответствующую единицу или упаковку согласно выбранной схеме маркировки.' },
      { title: 'Нанеси код и проверь сканированием', detail: 'После нанесения повторно считай DataMatrix с фактической поверхности. Проверь, что код читается, данные не обрезаны, а скан не распознаётся как дубликат.' },
      { title: 'Сверь итоги партии', detail: 'Сравни количество подготовленных, нанесённых, отбракованных и оставшихся этикеток. Отдельно зафиксируй нечитаемые или повреждённые коды и действуй по инструкции системы для их дальнейшей обработки.' },
    ],
  },
  {
    id: 'circulation',
    category: 'Статус товара',
    title: 'Проверка перед вводом в оборот',
    summary: 'Перед подтверждением операции убедиться, что товар, коды и документы согласованы.',
    scope: 'Ввод в оборот',
    time: '5 контрольных шагов',
    searchTerm: 'оборот',
    sources: [
      { label: 'Портал «Текшер»', url: 'https://main.teksher.kg/' },
      { label: 'Новости оператора', url: 'https://main.teksher.kg/news.html' },
    ],
    steps: [
      { title: 'Уточни применимый процесс и страну оборота', detail: 'Определи, какие правила и система применяются к конкретной операции. Не переноси автоматически порядок из РФ, КР или ЕАЭС на другой контур.' },
      { title: 'Проверь готовность товара и документов', detail: 'Сверь карточку, GTIN, фактическую партию, необходимые сопроводительные документы и выбранный вид операции.' },
      { title: 'Проверь коды до отправки события', detail: 'Считай коды с товара/упаковки, проверь количество, читаемость и отсутствие дублей. Используй текущие статусы и ограничения, показываемые системой.' },
      { title: 'Отправь предусмотренную операцию', detail: 'Заполняй документ в соответствующей системе по текущей инструкции. Перед подтверждением повторно сверь реквизиты участника, дату, партию и количество.' },
      { title: 'Убедись в принятии результата', detail: 'Не считай операцию завершённой только после нажатия кнопки. Проверь конечный статус, запиши идентификатор документа и разберись с отклонёнными строками по тексту ошибки.' },
    ],
  },
  {
    id: 'dispatch',
    category: 'Отгрузка и перемещение',
    title: 'Отгрузка и движение кодов',
    summary: 'Проверить состав отгрузки, корректность кодов и подтверждение со стороны системы/получателя.',
    scope: 'Отгрузка / перемещение',
    time: '5 контрольных шагов',
    searchTerm: 'отгрузка',
    sources: [
      { label: 'Портал «Текшер»', url: 'https://main.teksher.kg/' },
      { label: 'Новости оператора', url: 'https://main.teksher.kg/news.html' },
    ],
    steps: [
      { title: 'Подготовь список фактически отгружаемых товаров', detail: 'Сверь состав партии с документами и фактическим количеством упаковок. Не включай в отправку код, который не относится к отгружаемому товару.' },
      { title: 'Собери и проверь коды партии', detail: 'Отсканируй коды или импортируй предусмотренный файл. Проверь дубликаты, пропуски и соответствие количества товаросопроводительным документам.' },
      { title: 'Заполни документ перемещения/отгрузки', detail: 'Выбери предусмотренный для этого сценария тип документа, проверь реквизиты отправителя и получателя, дату и состав партии.' },
      { title: 'Подтверди передачу по правилам системы', detail: 'Выполни требуемые действия отправителя и получателя в соответствующем контуре. Не считай передачу завершённой без подтверждённого статуса.' },
      { title: 'Проверь результат и сохрани подтверждения', detail: 'Проверь статус документа, ошибки по отдельным кодам и финальный состав отгрузки. Сохрани идентификатор/подтверждение и передай ответственному сотруднику ошибки, которые требуют разбора.' },
    ],
  },
]

function loadProcessGuideProgress(storageKey = PROCESS_PROGRESS_KEY) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function loadProcessExecutionState(storageKey = PROCESS_PROGRESS_KEY) {
  try {
    const raw = window.localStorage.getItem(storageKey + ':execution')
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return { steps: {}, answers: {}, finished: {} }
    return {
      steps: parsed.steps && typeof parsed.steps === 'object' ? parsed.steps : {},
      answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      finished: parsed.finished && typeof parsed.finished === 'object' ? parsed.finished : {},
    }
  } catch {
    return { steps: {}, answers: {}, finished: {} }
  }
}

function loadLocalProcessGuides() {
  try {
    const raw = window.localStorage.getItem(PROCESS_GUIDES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : PROCESS_GUIDES
  } catch {
    return PROCESS_GUIDES
  }
}

function ProcessGuidesSection({ onSearchMaterials, canEdit = false, canDelete = false, progressStorageKey = PROCESS_PROGRESS_KEY }) {
  const [guides, setGuides] = useState(loadLocalProcessGuides)
  const [selectedGuideId, setSelectedGuideId] = useState(PROCESS_GUIDES[0].id)
  const [progress, setProgress] = useState(() => loadProcessGuideProgress(progressStorageKey))
  const [executionStepByGuide, setExecutionStepByGuide] = useState(() => loadProcessExecutionState(progressStorageKey).steps)
  const [executionAnswersByGuide, setExecutionAnswersByGuide] = useState(() => loadProcessExecutionState(progressStorageKey).answers)
  const [executionFinishedByGuide, setExecutionFinishedByGuide] = useState(() => loadProcessExecutionState(progressStorageKey).finished)
  const [guidesLoading, setGuidesLoading] = useState(API_ENABLED)
  const [guideLoadError, setGuideLoadError] = useState('')
  const [guideMessage, setGuideMessage] = useState('')
  const [editingGuide, setEditingGuide] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [savingGuide, setSavingGuide] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [deletingGuideId, setDeletingGuideId] = useState('')
  const [versionHistory, setVersionHistory] = useState([])
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState(0)

  useEffect(() => {
    if (!API_ENABLED) {
      setGuides(loadLocalProcessGuides())
      setGuidesLoading(false)
      return undefined
    }
    let cancelled = false
    setGuidesLoading(true)
    setGuideLoadError('')
    apiRequest('/api/business-processes')
      .then(rows => {
        if (cancelled) return
        const loaded = Array.isArray(rows) ? rows : []
        setGuides(loaded)
        setSelectedGuideId(current => loaded.some(item => item.id === current) ? current : (loaded[0]?.id || ''))
      })
      .catch(error => {
        if (!cancelled) {
          setGuideLoadError(error.message || 'Не удалось загрузить бизнес-процессы с сервера.')
          setGuidesLoading(false)
        }
      })
      .finally(() => {
        if (!cancelled) setGuidesLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const guide = guides.find(item => item.id === selectedGuideId) || guides[0] || PROCESS_GUIDES[0]
  const completed = Array.isArray(progress[guide.id])
    ? progress[guide.id].filter(index => Number.isInteger(index) && index >= 0 && index < guide.steps.length)
    : []
  const executionStep = Number.isInteger(executionStepByGuide[guide.id]) ? executionStepByGuide[guide.id] : null
  const executionAnswers = executionAnswersByGuide[guide.id] || {}
  const executionFinished = Boolean(executionFinishedByGuide[guide.id])
  const guideDone = completed.length
  const totalCompleted = guides.reduce((total, item) => {
    const steps = Array.isArray(progress[item.id]) ? progress[item.id] : []
    return total + steps.filter(index => Number.isInteger(index) && index >= 0 && index < item.steps.length).length
  }, 0)
  const totalSteps = guides.reduce((total, item) => total + item.steps.length, 0)
  const percent = guide.steps.length ? Math.round(guideDone / guide.steps.length * 100) : 0
  const canManageGuides = canEdit && (!API_ENABLED || !guideLoadError)
  const localOnly = !API_ENABLED
  const executionRoute = (() => {
    const route = []
    const seen = new Set()
    let cursor = 0
    while (Number.isInteger(cursor) && cursor >= 0 && cursor < guide.steps.length && !seen.has(cursor) && route.length <= guide.steps.length) {
      route.push(cursor)
      seen.add(cursor)
      const step = guide.steps[cursor]
      const answer = executionAnswers[cursor]
      if (step?.decision && !answer) break
      let target = null
      if (step?.decision && answer) {
        const targetValue = answer === 'yes' ? step.yesStepIndex : step.noStepIndex
        target = Number.isInteger(targetValue) && targetValue >= 0 && targetValue < guide.steps.length
          ? targetValue
          : cursor + 1 < guide.steps.length ? cursor + 1 : null
      } else {
        target = cursor + 1 < guide.steps.length ? cursor + 1 : null
      }
      if (target === null) break
      cursor = target
    }
    return new Set(route)
  })()

  useEffect(() => {
    try { window.localStorage.setItem(progressStorageKey, JSON.stringify(progress)) } catch { /* storage unavailable */ }
  }, [progress, progressStorageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(progressStorageKey + ':execution', JSON.stringify({
        steps: executionStepByGuide,
        answers: executionAnswersByGuide,
        finished: executionFinishedByGuide,
      }))
    } catch { /* storage unavailable */ }
  }, [executionStepByGuide, executionAnswersByGuide, executionFinishedByGuide, progressStorageKey])

  useEffect(() => {
    if (!API_ENABLED) return undefined
    let cancelled = false
    apiRequest('/api/business-process-progress')
      .then(rows => {
        if (cancelled || !rows || typeof rows !== 'object') return
        const serverProgress = {}
        Object.entries(rows).forEach(([processId, values]) => {
          serverProgress[processId] = Array.isArray(values)
            ? values.map(value => Number(value)).filter(value => Number.isInteger(value) && value >= 0)
            : []
        })
        setProgress(current => ({ ...current, ...serverProgress }))
      })
      .catch(error => {
        if (!cancelled) setGuideMessage('Не удалось загрузить прогресс с сервера. Локальная копия сохранена.')
      })
    return () => { cancelled = true }
  }, [])

  const persistProgress = (processId, steps) => {
    if (!API_ENABLED || !processId || processId.startsWith('local-')) return
    apiRequest('/api/business-process-progress/' + encodeURIComponent(processId), {
      method: 'PUT',
      body: steps.map(String),
    }).catch(() => setGuideMessage('Изменения сохранены в браузере, но не удалось синхронизировать прогресс с сервером.'))
  }

  const toggleStep = index => {
    const currentSteps = Array.isArray(progress[guide.id]) ? progress[guide.id] : []
    const next = currentSteps.includes(index)
      ? currentSteps.filter(step => step !== index)
      : [...currentSteps.filter(step => Number.isInteger(step) && step >= 0 && step < guide.steps.length), index]
    setProgress(current => ({ ...current, [guide.id]: next }))
    persistProgress(guide.id, next)
  }

  const startExecution = () => {
    setExecutionStepByGuide(current => ({ ...current, [guide.id]: 0 }))
    setExecutionAnswersByGuide(current => ({ ...current, [guide.id]: {} }))
    setExecutionFinishedByGuide(current => ({ ...current, [guide.id]: false }))
    setGuideMessage('Прохождение процесса начато. Выполняй текущий шаг и выбирай результат контрольных вопросов.')
  }

  const chooseExecutionAnswer = (index, answer) => {
    const step = guide.steps[index]
    if (!step) return
    const targetValue = answer === 'yes' ? step.yesStepIndex : step.noStepIndex
    const target = Number.isInteger(targetValue) && targetValue >= 0 && targetValue < guide.steps.length
      ? targetValue
      : index + 1 < guide.steps.length ? index + 1 : null
    const currentAnswers = executionAnswersByGuide[guide.id] || {}
    setExecutionAnswersByGuide(current => ({ ...current, [guide.id]: { ...(current[guide.id] || {}), [index]: answer } }))
    const currentSteps = Array.isArray(progress[guide.id]) ? progress[guide.id] : []
    const nextProgress = currentSteps.includes(index) ? currentSteps : [...currentSteps, index]
    setProgress(current => ({ ...current, [guide.id]: nextProgress }))
    persistProgress(guide.id, nextProgress)
    if (target === null) {
      setExecutionStepByGuide(current => ({ ...current, [guide.id]: null }))
      setExecutionFinishedByGuide(current => ({ ...current, [guide.id]: true }))
      setGuideMessage('Процесс завершён. Проверь итог и при необходимости открой историю изменений.')
    } else {
      setExecutionStepByGuide(current => ({ ...current, [guide.id]: target }))
      setGuideMessage('Ответ сохранён. Следующий шаг: ' + (target + 1) + '. ' + guide.steps[target].title)
    }
  }

  const resetGuide = () => {
    setExecutionStepByGuide(current => ({ ...current, [guide.id]: null }))
    setExecutionAnswersByGuide(current => ({ ...current, [guide.id]: {} }))
    setExecutionFinishedByGuide(current => ({ ...current, [guide.id]: false }))
    setProgress(current => ({ ...current, [guide.id]: [] }))
    if (API_ENABLED && !guide.id.startsWith('local-')) {
      apiRequest('/api/business-process-progress/' + encodeURIComponent(guide.id), { method: 'DELETE' })
        .catch(() => setGuideMessage('Прогресс сброшен локально, но сервер не подтвердил сброс.'))
    }
  }

  const openNewGuideEditor = () => {
    setEditingGuide(null)
    setEditorError('')
    setEditorOpen(true)
    setGuideMessage('')
  }

  const openGuideEditor = item => {
    setEditingGuide({
      ...item,
      sources: (item.sources || []).map(source => ({ ...source })),
      steps: (item.steps || []).map(step => ({ ...step })),
    })
    setEditorError('')
    setEditorOpen(true)
    setGuideMessage('')
  }

  const saveGuide = async draft => {
    const editingId = editingGuide?.id || ''
    const cleanedSources = (draft.sources || [])
      .filter(source => String(source.label || '').trim() && String(source.url || '').trim())
      .map(source => ({ label: source.label.trim(), url: source.url.trim() }))
    const body = {
      category: String(draft.category || '').trim(),
      title: String(draft.title || '').trim(),
      summary: String(draft.summary || '').trim(),
      scope: String(draft.scope || '').trim(),
      time: String(draft.time || '').trim(),
      searchTerm: String(draft.searchTerm || '').trim() || String(draft.title || '').trim(),
      sources: cleanedSources,
      steps: (draft.steps || []).map(step => ({
        title: String(step.title || '').trim(),
        detail: String(step.detail || '').trim(),
        responsible: String(step.responsible || '').trim(),
        documents: String(step.documents || '').trim(),
        decision: String(step.decision || '').trim(),
        yesOutcome: String(step.yesOutcome || '').trim(),
        noOutcome: String(step.noOutcome || '').trim(),
        yesStepIndex: step.yesStepIndex === '' || step.yesStepIndex == null ? null : Number(step.yesStepIndex),
        noStepIndex: step.noStepIndex === '' || step.noStepIndex == null ? null : Number(step.noStepIndex),
      })),
      orderIndex: Number.isInteger(draft.orderIndex) ? draft.orderIndex : (guides.length + 1),
    }
    if (!body.steps.length || body.steps.some(step => !step.title || !step.detail)) {
      setEditorError('У каждого шага должны быть заполнены название и описание.')
      return
    }
    const invalidTransition = body.steps.findIndex((step, index) => {
      const targets = [step.yesStepIndex, step.noStepIndex].filter(target => target !== null)
      if (targets.some(target => !Number.isInteger(target) || target < 0 || target >= body.steps.length)) return true
      const hasBranch = targets.length > 0
      return hasBranch && !step.decision
    })
    if (invalidTransition !== -1) {
      const step = body.steps[invalidTransition]
      const hasBranch = step.yesStepIndex !== null || step.noStepIndex !== null
      setEditorError(hasBranch && !step.decision
        ? `В шаге ${invalidTransition + 1} укажи контрольный вопрос для ветвления.`
        : `В шаге ${invalidTransition + 1} выбран несуществующий переход. Проверь номера шагов.`)
      return
    }
    setSavingGuide(true)
    setEditorError('')
    setGuideMessage('')
    let progressResetFailed = false
    try {
      let saved
      if (API_ENABLED) {
        saved = await apiRequest(
          editingId ? '/api/business-processes/' + encodeURIComponent(editingId) : '/api/business-processes',
          { method: editingId ? 'PUT' : 'POST', body }
        )
      } else {
        const id = editingId || ('local-' + (window.crypto?.randomUUID?.() || Date.now().toString(36)))
        saved = {
          ...body,
          id,
          sources: body.sources,
          steps: body.steps,
          createdBy: editingGuide?.createdBy || 'Локальный пользователь',
          updatedBy: 'Локальный пользователь',
          updatedAt: new Date().toISOString(),
        }
      }
      const next = editingId
        ? guides.map(item => item.id === editingId ? saved : item)
        : [...guides, saved]
      if (!API_ENABLED) {
        try { window.localStorage.setItem(PROCESS_GUIDES_STORAGE_KEY, JSON.stringify(next)) } catch {
          throw new Error('Не удалось сохранить изменения в браузере. Проверь доступное место в хранилище.')
        }
      }
      setGuides(next)
      if (editingId) {
        const previous = guides.find(item => item.id === editingId)
        if (JSON.stringify(previous?.steps || []) !== JSON.stringify(saved.steps || [])) {
          setProgress(current => ({ ...current, [saved.id]: [] }))
          if (API_ENABLED) {
            try {
              await apiRequest('/api/business-process-progress/' + encodeURIComponent(saved.id), { method: 'DELETE' })
            } catch {
              progressResetFailed = true
            }
          }
        }
      }
      setSelectedGuideId(saved.id)
      setEditorOpen(false)
      setEditingGuide(null)
      setGuideLoadError('')
      setGuideMessage(progressResetFailed
        ? 'Инструкция «' + saved.title + '» сохранена, но прогресс шагов не удалось сбросить на сервере. Обнови страницу и проверь прогресс.'
        : 'Инструкция «' + saved.title + '» сохранена.')
    } catch (error) {
      setEditorError(error.message || 'Не удалось сохранить инструкцию.')
    } finally {
      setSavingGuide(false)
    }
  }

  const openVersionHistory = async item => {
    if (!API_ENABLED || String(item.id).startsWith('local-')) {
      setGuideMessage('История версий доступна для процессов, сохранённых на сервере.')
      return
    }
    setVersionHistoryOpen(true)
    setVersionHistoryLoading(true)
    setVersionHistory([])
    setGuideMessage('')
    try {
      const rows = await apiRequest('/api/business-processes/' + encodeURIComponent(item.id) + '/versions')
      setVersionHistory(Array.isArray(rows) ? rows : [])
    } catch (error) {
      setVersionHistoryOpen(false)
      setGuideMessage(error.message || 'Не удалось загрузить историю версий.')
    } finally {
      setVersionHistoryLoading(false)
    }
  }

  const restoreGuideVersion = async version => {
    if (!canManageGuides || !guide?.id || !version?.versionNumber || restoringVersion) return
    const confirmed = window.confirm('Восстановить версию ' + version.versionNumber + ' инструкции «' + guide.title + '»? Текущая редакция сохранится в истории.')
    if (!confirmed) return
    setRestoringVersion(version.versionNumber)
    setGuideMessage('')
    try {
      const saved = await apiRequest('/api/business-processes/' + encodeURIComponent(guide.id)
        + '/versions/' + version.versionNumber + '/restore', { method: 'POST' })
      setGuides(current => current.map(item => item.id === saved.id ? saved : item))
      setProgress(current => ({ ...current, [saved.id]: [] }))
      let progressResetFailed = false
      try {
        await apiRequest('/api/business-process-progress/' + encodeURIComponent(saved.id), { method: 'DELETE' })
      } catch {
        progressResetFailed = true
      }
      const rows = await apiRequest('/api/business-processes/' + encodeURIComponent(saved.id) + '/versions')
      setVersionHistory(Array.isArray(rows) ? rows : [])
      setGuideMessage(progressResetFailed
        ? 'Версия восстановлена, но сервер не подтвердил сброс прогресса. Обнови страницу и проверь отмеченные шаги.'
        : 'Восстановлена версия ' + version.versionNumber + '. Предыдущая редакция сохранена в истории.')
      setVersionHistoryOpen(false)
    } catch (error) {
      setGuideMessage(error.message || 'Не удалось восстановить версию инструкции.')
    } finally {
      setRestoringVersion(0)
    }
  }

  const deleteGuide = async item => {
    if (!canDelete) return
    const confirmed = window.confirm('Удалить бизнес-процесс «' + item.title + '»? Это действие нельзя отменить.')
    if (!confirmed) return
    setDeletingGuideId(item.id)
    setGuideMessage('')
    try {
      if (API_ENABLED) {
        await apiRequest('/api/business-processes/' + encodeURIComponent(item.id), { method: 'DELETE' })
      }
      const next = guides.filter(guideItem => guideItem.id !== item.id)
      if (!API_ENABLED) {
        try { window.localStorage.setItem(PROCESS_GUIDES_STORAGE_KEY, JSON.stringify(next)) } catch {
          throw new Error('Не удалось сохранить удаление в браузере. Проверь доступное место в хранилище.')
        }
      }
      setGuides(next)
      setProgress(current => {
        const nextProgress = { ...current }
        delete nextProgress[item.id]
        return nextProgress
      })
      if (selectedGuideId === item.id) setSelectedGuideId(next[0]?.id || '')
      setGuideMessage('Бизнес-процесс удалён.')
    } catch (error) {
      setGuideMessage(error.message || 'Не удалось удалить бизнес-процесс.')
    } finally {
      setDeletingGuideId('')
    }
  }

  return <section className="process-guides-page">
    <div className="page-heading process-page-heading">
      <div>
        <div className="section-kicker">РАБОЧИЕ СЦЕНАРИИ / ПОШАГОВЫЕ ИНСТРУКЦИИ</div>
        <h1>Интерактивные инструкции</h1>
        <p>Выбери процесс, проходи контрольные шаги и отмечай выполненное. Сохранённые инструкции доступны всей команде.</p>
      </div>
      <div className="process-heading-actions">
        <div className="process-overall-progress"><strong>{totalCompleted} / {totalSteps}</strong><span>шагов выполнено</span></div>
        {canManageGuides && <button type="button" className="primary-button process-create-guide-button" onClick={openNewGuideEditor}><FilePlus2 size={15}/> Новая инструкция</button>}
      </div>
    </div>

    <div className="process-notice"><CircleHelp size={17}/><span>Это рабочие чек-листы для самопроверки. Точные названия операций, статусы, лимиты и обязательные действия зависят от страны, товарной группы и текущих правил соответствующей системы. При расхождении следуй актуальной инструкции оператора и нормативным требованиям.</span></div>
    {localOnly && <div className="process-edit-mode-note"><Pencil size={14}/> Сейчас изменения сохраняются только в этом браузере. После подключения сервера они будут доступны всей команде.</div>}
    {guideLoadError && <div className="feedback feedback-error process-edit-feedback" role="alert"><CircleHelp size={15}/><span>Не удалось загрузить редакцию с сервера: {guideLoadError}. Редактирование отключено, чтобы не перезаписать сохранённые данные.</span></div>}
    {guideMessage && <div className={'feedback process-edit-feedback ' + (guideMessage.startsWith('Не удалось') || guideMessage.startsWith('У каждого') ? 'feedback-error' : 'feedback-success')} role="status"><span>{guideMessage}</span><button type="button" onClick={() => setGuideMessage('')} aria-label="Закрыть сообщение"><X size={14}/></button></div>}

    {guidesLoading
      ? <div className="empty-state"><RefreshCw size={24} className="spin"/><b>Загружаем бизнес-процессы…</b><span>Получаем сохранённые инструкции из общей базы.</span></div>
      : !guides.length
        ? <div className="empty-state"><Workflow size={28}/><b>Бизнес-процессы ещё не добавлены</b><span>Создай первую инструкцию, чтобы команда могла пользоваться пошаговым сценарием.</span>{canManageGuides && <button type="button" className="primary-button" onClick={openNewGuideEditor}><FilePlus2 size={15}/> Создать инструкцию</button>}</div>
        : <div className="process-guides-layout">
          <nav className="process-guide-list" aria-label="Выбор инструкции">
            <div className="process-list-title"><span className="section-kicker">ВЫБЕРИТЕ ПРОЦЕСС</span><span>{guides.length} сценариев</span></div>
            {guides.map((item, index) => {
              const itemSteps = Array.isArray(item.steps) ? item.steps : []
              const itemDone = (Array.isArray(progress[item.id]) ? progress[item.id] : [])
                .filter(step => Number.isInteger(step) && step >= 0 && step < itemSteps.length).length
              const itemPercent = itemSteps.length ? Math.round(itemDone / itemSteps.length * 100) : 0
              return <button type="button" key={item.id} className={'process-guide-choice' + (item.id === guide.id ? ' active' : '')} onClick={() => setSelectedGuideId(item.id)}>
                <span className="process-guide-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="process-guide-choice-copy"><small>{item.category}</small><strong>{item.title}</strong><span>{itemDone} из {itemSteps.length} шагов</span><i><em style={{ width: itemPercent + '%' }}/></i></span>
                <ArrowUpRight size={15}/>
              </button>
            })}
          </nav>

          <article className="process-guide-detail">
            <header className="process-guide-detail-header">
              <div className="process-guide-detail-icon"><Workflow size={22}/></div>
              <div className="process-guide-detail-heading">
                <span className="section-kicker">{guide.scope}</span>
                <h2>{guide.title}</h2>
                <p>{guide.summary}</p>
              </div>
              <div className="process-guide-detail-actions">
                <span className="process-guide-progress-pill">{guideDone}/{guide.steps.length}</span>
                {API_ENABLED && !String(guide.id).startsWith('local-') && <button type="button" className="secondary-button process-history-button" onClick={() => openVersionHistory(guide)}><History size={14}/> История</button>}
                {canManageGuides && <button type="button" className="secondary-button process-edit-guide-button" onClick={() => openGuideEditor(guide)}><Pencil size={14}/> Редактировать</button>}
                {canDelete && <button type="button" className="danger-button process-delete-guide-button" onClick={() => deleteGuide(guide)} disabled={deletingGuideId === guide.id}>{deletingGuideId === guide.id ? <RefreshCw size={14} className="spin"/> : <Trash2 size={14}/>} Удалить</button>}
              </div>
            </header>

            <div className="process-progress-track" aria-label={'Выполнено ' + percent + '%'}>
              <span style={{ width: percent + '%' }}/>
            </div>
            <div className="process-progress-caption"><span>{percent === 100 ? 'Все шаги отмечены' : 'Выполнено ' + percent + '%'}</span><button type="button" className="tnved-clear-button" onClick={resetGuide}>Сбросить отметки</button></div>

            <section className="process-execution-panel" aria-label="Прохождение бизнес-процесса">
              <div className="process-execution-heading"><div><span className="section-kicker">РЕЖИМ ВЫПОЛНЕНИЯ</span><strong>Проведение по шагам</strong><p>Запускай процесс, отмечай результат проверки и переходи к следующему шагу по выбранной ветке.</p></div>
                {executionStep === null ? <button type="button" className="primary-button" onClick={startExecution}><Workflow size={15}/> Начать процесс</button> : <button type="button" className="secondary-button" onClick={resetGuide}>Начать заново</button>}
              </div>
              {executionStep !== null && guide.steps[executionStep] && <div className="process-execution-current"><span className="process-execution-step-number">Шаг {executionStep + 1} из {guide.steps.length}</span><h3>{guide.steps[executionStep].title}</h3><p>{guide.steps[executionStep].detail}</p>
                {guide.steps[executionStep].responsible && <p><b>Ответственный:</b> {guide.steps[executionStep].responsible}</p>}
                {guide.steps[executionStep].documents && <p><b>Документы и условия:</b> {guide.steps[executionStep].documents}</p>}
                {guide.steps[executionStep].decision ? <><div className="process-execution-question"><b>Контрольный вопрос:</b> {guide.steps[executionStep].decision}</div><div className="process-execution-choices"><button type="button" className="primary-button" onClick={() => chooseExecutionAnswer(executionStep, 'yes')}><CheckCircle2 size={15}/> Да{guide.steps[executionStep].yesOutcome ? ': ' + guide.steps[executionStep].yesOutcome : ''}</button><button type="button" className="secondary-button" onClick={() => chooseExecutionAnswer(executionStep, 'no')}><X size={15}/> Нет{guide.steps[executionStep].noOutcome ? ': ' + guide.steps[executionStep].noOutcome : ''}</button></div></> : <button type="button" className="primary-button" onClick={() => { const next = executionStep + 1; const currentSteps = Array.isArray(progress[guide.id]) ? progress[guide.id] : []; const nextProgress = currentSteps.includes(executionStep) ? currentSteps : [...currentSteps, executionStep]; setProgress(current => ({ ...current, [guide.id]: nextProgress })); persistProgress(guide.id, nextProgress); if (next < guide.steps.length) setExecutionStepByGuide(current => ({ ...current, [guide.id]: next })); else { setExecutionStepByGuide(current => ({ ...current, [guide.id]: null })); setExecutionFinishedByGuide(current => ({ ...current, [guide.id]: true })); setGuideMessage('Процесс завершён. Все шаги пройдены.'); } }}><CheckCircle2 size={15}/> Шаг выполнен, далее</button>}
              </div>}
              {executionStep === null && executionFinished && <p className="process-execution-finished"><CheckCircle2 size={15}/> Прохождение завершено. Можно начать процесс заново.</p>}
            </section>

            <section className="process-flow-preview" aria-label="Схема бизнес-процесса">
              <div className="process-flow-preview-heading">
                <div><span className="section-kicker">СХЕМА ПРОЦЕССА</span><strong>Последовательность действий</strong></div>
                <span>{guide.steps.length} этапов</span>
              </div>
              <div className="process-flow-track">
                {guide.steps.map((step, index) => {
                  const isDone = completed.includes(index)
                  const isCurrent = executionStep === index
                  const isOnRoute = executionRoute.has(index)
                  const answer = executionAnswers[index]
                  const status = isCurrent ? 'Текущий шаг' : answer ? (answer === 'yes' ? 'Ответ: Да' : 'Ответ: Нет') : isDone ? 'Выполнено' : executionStep !== null && !isOnRoute ? 'Вне выбранного маршрута' : 'Ожидает выполнения'
                  return <div className={'process-flow-item' + (isDone ? ' completed' : '') + (isCurrent ? ' current' : '') + (executionStep !== null && !isOnRoute ? ' skipped' : '')} key={'flow-' + guide.id + '-' + index}>
                    <div className="process-flow-node">
                      <span className="process-flow-number">{isDone ? <CheckCircle2 size={17}/> : String(index + 1).padStart(2, '0')}</span>
                      <div className="process-flow-copy"><strong>{step.title}</strong><span>{status}</span>{step.decision && <small>Контрольный вопрос: {step.decision}</small>}</div>
                    </div>
                    {step.decision && <div className="process-flow-branch-labels"><span className={answer === 'yes' ? 'selected' : ''}>Да{Number.isInteger(step.yesStepIndex) ? ' → шаг ' + (step.yesStepIndex + 1) : ''}</span><span className={answer === 'no' ? 'selected' : ''}>Нет{Number.isInteger(step.noStepIndex) ? ' → шаг ' + (step.noStepIndex + 1) : ''}</span></div>}
                    {index < guide.steps.length - 1 && <div className="process-flow-connector" aria-hidden="true"><ArrowDownRight size={16}/></div>}
                  </div>
                })}
              </div>
            </section>

            <div className="process-step-list">
              {guide.steps.map((step, index) => {
                const isDone = completed.includes(index)
                return <label className={'process-step' + (isDone ? ' completed' : '')} key={step.title + '-' + index}>
                  <input type="checkbox" checked={isDone} onChange={() => toggleStep(index)} />
                  <span className="process-step-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="process-step-content"><strong>{step.title}</strong><span>{step.detail}</span>
                    {step.responsible && <span className="process-step-meta"><b>Ответственный:</b> {step.responsible}</span>}
                    {step.documents && <span className="process-step-meta"><b>Документы и условия:</b> {step.documents}</span>}
                    {step.decision && <span className="process-step-branch"><b>Контрольный вопрос:</b> {step.decision}<span><b>Да:</b> {step.yesOutcome || 'Продолжить по инструкции'}{Number.isInteger(step.yesStepIndex) && guide.steps[step.yesStepIndex] ? ' → Шаг ' + (step.yesStepIndex + 1) + ': ' + guide.steps[step.yesStepIndex].title : ''}</span><span><b>Нет:</b> {step.noOutcome || 'Устранить причину и повторить проверку'}{Number.isInteger(step.noStepIndex) && guide.steps[step.noStepIndex] ? ' → Шаг ' + (step.noStepIndex + 1) + ': ' + guide.steps[step.noStepIndex].title : ''}</span></span>}
                  </span>
                  {isDone && <CheckCircle2 className="process-step-check" size={18}/>}
                </label>
              })}
            </div>

            <div className="process-guide-footer">
              <div className="process-guide-sources">
                <strong><BookOpen size={15}/> Полезные ссылки</strong>
                {(guide.sources || []).map((source, index) => <a href={source.url} key={source.url || index} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={13}/></a>)}
                {!(guide.sources || []).length && <span className="process-no-sources">Ссылки не добавлены.</span>}
              </div>
              <button type="button" className="primary-button process-materials-button" onClick={() => onSearchMaterials(guide.searchTerm || guide.title)}><Search size={15}/> Найти материалы в базе</button>
            </div>
            <p className="process-local-note">{API_ENABLED ? 'Прогресс сохраняется на сервере в вашей учётной записи и доступен при следующем входе. У каждого участника свой прогресс.' : 'Отметки выполненных шагов хранятся локально в текущем браузере и не синхронизируются между пользователями.'}</p>
          </article>
        </div>
    }

    {versionHistoryOpen && <div className="modal-backdrop process-guide-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !restoringVersion) setVersionHistoryOpen(false) }}>
      <section className="create-modal process-guide-editor-modal process-version-history-modal" role="dialog" aria-modal="true" aria-labelledby="process-version-history-title">
        <div className="modal-header">
          <div><div className="section-kicker">ИСТОРИЯ ИЗМЕНЕНИЙ</div><h2 id="process-version-history-title">{guide.title}</h2><p>Каждая сохранённая редакция остаётся доступной для восстановления.</p></div>
          <button type="button" className="icon-button" onClick={() => setVersionHistoryOpen(false)} aria-label="Закрыть историю"><X size={18}/></button>
        </div>
        {versionHistoryLoading
          ? <div className="empty-state"><RefreshCw size={20} className="spin"/><span>Загружаем историю…</span></div>
          : versionHistory.length
            ? <div className="process-version-list">{versionHistory.map(version => <article className="process-version-row" key={version.versionNumber}>
                <div className="process-version-number"><History size={15}/><b>v{version.versionNumber}</b></div>
                <div className="process-version-copy"><strong>{version.title}</strong><span>{({ CREATE: 'Создание', UPDATE: 'Изменение', RESTORE: 'Восстановление' }[version.action] || version.action)} · {version.changedBy}</span><small>{version.changedAt ? new Date(version.changedAt).toLocaleString('ru-RU') : 'Дата не указана'}</small><small>{Number.isFinite(version.stepCount) ? version.stepCount + ' шагов' : 'Количество шагов не указано'} · {Number.isFinite(version.branchCount) ? version.branchCount + ' ветвлений' : 'Ветвления не указаны'}</small></div>
                {canManageGuides && <button type="button" className="secondary-button" disabled={restoringVersion !== 0} onClick={() => restoreGuideVersion(version)}>{restoringVersion === version.versionNumber ? <RefreshCw size={13} className="spin"/> : <History size={13}/>} Восстановить</button>}
              </article>)}</div>
            : <div className="empty-state"><History size={22}/><b>История пока пуста</b><span>Новая версия появится после сохранения инструкции.</span></div>}
      </section>
    </div>}
    {editorOpen && <ProcessGuideEditorModal
      key={editingGuide?.id || 'new-business-process'}
      guide={editingGuide}
      saving={savingGuide}
      error={editorError}
      onClose={() => { if (!savingGuide) { setEditorOpen(false); setEditingGuide(null); setEditorError('') } }}
      onSave={saveGuide}
    />}
  </section>
}

function ProcessGuideEditorModal({ guide, saving, error, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    category: guide?.category || '',
    title: guide?.title || '',
    summary: guide?.summary || '',
    scope: guide?.scope || '',
    time: guide?.time || '',
    searchTerm: guide?.searchTerm || '',
    orderIndex: guide?.orderIndex,
    sources: (guide?.sources || []).map(source => ({ ...source })),
    steps: (guide?.steps || [{ title: '', detail: '', responsible: '', documents: '', decision: '', yesOutcome: '', noOutcome: '', yesStepIndex: '', noStepIndex: '' }]).map(step => ({ responsible: '', documents: '', decision: '', yesOutcome: '', noOutcome: '', yesStepIndex: '', noStepIndex: '', ...step })),
  }))
  const [formError, setFormError] = useState('')
  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }))
  const updateSource = (index, field, value) => setForm(current => ({
    ...current,
    sources: current.sources.map((source, i) => i === index ? { ...source, [field]: value } : source),
  }))
  const removeSource = index => setForm(current => ({ ...current, sources: current.sources.filter((_, i) => i !== index) }))
  const updateStep = (index, field, value) => setForm(current => ({
    ...current,
    steps: current.steps.map((step, i) => i === index ? { ...step, [field]: value } : step),
  }))
  const removeStep = index => setForm(current => {
    if (current.steps.length <= 1) return current
    const steps = current.steps.filter((_, i) => i !== index).map(step => ({
      ...step,
      yesStepIndex: step.yesStepIndex === index ? '' : Number.isInteger(step.yesStepIndex) && step.yesStepIndex > index ? step.yesStepIndex - 1 : step.yesStepIndex,
      noStepIndex: step.noStepIndex === index ? '' : Number.isInteger(step.noStepIndex) && step.noStepIndex > index ? step.noStepIndex - 1 : step.noStepIndex,
    }))
    return { ...current, steps }
  })
  const moveStep = (index, direction) => setForm(current => {
    const target = index + direction
    if (target < 0 || target >= current.steps.length) return current
    const remapTarget = value => value === index ? target : value === target ? index : value
    const steps = [...current.steps]
    ;[steps[index], steps[target]] = [steps[target], steps[index]]
    return { ...current, steps: steps.map(step => ({
      ...step,
      yesStepIndex: Number.isInteger(step.yesStepIndex) ? remapTarget(step.yesStepIndex) : step.yesStepIndex,
      noStepIndex: Number.isInteger(step.noStepIndex) ? remapTarget(step.noStepIndex) : step.noStepIndex,
    })) }
  })
  const addStep = () => setForm(current => current.steps.length >= 30
    ? current
    : ({ ...current, steps: [...current.steps, { title: '', detail: '', responsible: '', documents: '', decision: '', yesOutcome: '', noOutcome: '', yesStepIndex: '', noStepIndex: '' }] }))
  const addSource = () => setForm(current => current.sources.length >= 10
    ? current
    : ({ ...current, sources: [...current.sources, { label: '', url: '' }] }))

  const handleSubmit = event => {
    event.preventDefault()
    setFormError('')
    if (!form.steps.length) {
      setFormError('В инструкции должен оставаться хотя бы один шаг.')
      return
    }
    if (form.steps.some(step => !step.title.trim() || !step.detail.trim())) {
      setFormError('Заполни название и описание каждого шага.')
      return
    }
    if (form.sources.some(source => (source.label.trim() || source.url.trim()) && (!source.label.trim() || !source.url.trim()))) {
      setFormError('У каждой добавленной ссылки должны быть и название, и URL. Или удали пустую строку.')
      return
    }
    onSave({ ...form, id: guide?.id })
  }

  return <div className="modal-backdrop process-guide-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="create-modal process-guide-editor-modal" role="dialog" aria-modal="true" aria-labelledby="process-guide-editor-title">
      <header className="modal-header">
        <div>
          <div className="section-kicker">УПРАВЛЕНИЕ БИЗНЕС-ПРОЦЕССОМ</div>
          <h2 id="process-guide-editor-title">{guide ? 'Редактировать инструкцию' : 'Новая инструкция'}</h2>
          <p>Изменения сохраняются в общей базе и становятся доступны другим пользователям.</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Закрыть редактор"><X size={20}/></button>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="process-guide-edit-fields">
          <label className="form-field"><span>Категория *</span><input required maxLength={120} value={form.category} onChange={event => updateField('category', event.target.value)} placeholder="Например, Заказ кодов"/></label>
          <label className="form-field"><span>Рабочий контур *</span><input required maxLength={160} value={form.scope} onChange={event => updateField('scope', event.target.value)} placeholder="Например, МЗКМ / Текшер"/></label>
          <label className="form-field full-field"><span>Название инструкции *</span><input required maxLength={240} value={form.title} onChange={event => updateField('title', event.target.value)} placeholder="Короткое и понятное название"/></label>
          <label className="form-field full-field"><span>Краткое описание *</span><textarea required maxLength={1500} rows={2} value={form.summary} onChange={event => updateField('summary', event.target.value)} placeholder="Что пользователь должен сделать по этой инструкции"/></label>
          <label className="form-field"><span>Оценка времени *</span><input required maxLength={120} value={form.time} onChange={event => updateField('time', event.target.value)} placeholder="Например, 5 контрольных шагов"/></label>
          <label className="form-field"><span>Поисковый запрос *</span><input required maxLength={200} value={form.searchTerm} onChange={event => updateField('searchTerm', event.target.value)} placeholder="Ключевое слово для поиска материалов"/></label>
        </div>

        <section className="process-editor-section">
          <div className="process-editor-section-heading"><div><b>Шаги инструкции</b><span>Название и подробное описание для каждого действия</span></div><button type="button" className="secondary-button" onClick={addStep} disabled={form.steps.length >= 30}><FilePlus2 size={14}/> Добавить шаг</button></div>
          <div className="process-editor-repeat-list">
            {form.steps.map((step, index) => <article className="process-editor-repeat-card" key={index}>
              <div className="process-editor-repeat-heading">
                <strong>Шаг {index + 1}</strong>
                <div className="process-editor-step-actions">
                  <button type="button" className="secondary-button" onClick={() => moveStep(index, -1)} disabled={index === 0 || saving} aria-label={`Переместить шаг ${index + 1} вверх`}>↑ Вверх</button>
                  <button type="button" className="secondary-button" onClick={() => moveStep(index, 1)} disabled={index === form.steps.length - 1 || saving} aria-label={`Переместить шаг ${index + 1} вниз`}>↓ Вниз</button>
                  <button type="button" className="process-editor-remove" onClick={() => removeStep(index)} disabled={form.steps.length <= 1 || saving} title="Удалить шаг"><Trash2 size={14}/><span>Удалить</span></button>
                </div>
              </div>
              <label className="form-field"><span>Название шага *</span><input required maxLength={200} value={step.title} onChange={event => updateStep(index, 'title', event.target.value)} placeholder="Например, Проверь код ТН ВЭД"/></label>
              <label className="form-field"><span>Описание *</span><textarea required maxLength={4000} rows={3} value={step.detail} onChange={event => updateStep(index, 'detail', event.target.value)} placeholder="Что именно нужно проверить или выполнить"/></label>
              <label className="form-field"><span>Ответственный</span><input maxLength={160} value={step.responsible || ''} onChange={event => updateStep(index, 'responsible', event.target.value)} placeholder="Например, участник маркировки или оператор"/></label>
              <label className="form-field"><span>Документы и условия выполнения</span><textarea maxLength={2000} rows={2} value={step.documents || ''} onChange={event => updateStep(index, 'documents', event.target.value)} placeholder="Какие документы нужны и что должно быть выполнено перед началом шага"/></label>
              <div className="process-editor-decision-fields">
                <label className="form-field"><span>Контрольный вопрос</span><input maxLength={500} value={step.decision || ''} onChange={event => updateStep(index, 'decision', event.target.value)} placeholder="Например, Карточка товара опубликована?"/></label>
                <label className="form-field"><span>Если «Да»</span><input maxLength={500} value={step.yesOutcome || ''} onChange={event => updateStep(index, 'yesOutcome', event.target.value)} placeholder="Следующее действие при положительном ответе"/></label>
                <label className="form-field"><span>Если «Нет»</span><input maxLength={500} value={step.noOutcome || ''} onChange={event => updateStep(index, 'noOutcome', event.target.value)} placeholder="Что исправить или куда вернуться"/></label>
                <label className="form-field"><span>Перейти при «Да»</span><select value={step.yesStepIndex ?? ''} onChange={event => updateStep(index, 'yesStepIndex', event.target.value === '' ? '' : Number(event.target.value))}><option value="">Следующий шаг по порядку</option>{form.steps.map((target, targetIndex) => targetIndex !== index && <option key={'yes-target-' + targetIndex} value={targetIndex}>{'Шаг ' + (targetIndex + 1) + ': ' + (target.title.trim() || 'Без названия')}</option>)}</select></label>
                <label className="form-field"><span>Перейти при «Нет»</span><select value={step.noStepIndex ?? ''} onChange={event => updateStep(index, 'noStepIndex', event.target.value === '' ? '' : Number(event.target.value))}><option value="">Следующий шаг по порядку</option>{form.steps.map((target, targetIndex) => targetIndex !== index && <option key={'no-target-' + targetIndex} value={targetIndex}>{'Шаг ' + (targetIndex + 1) + ': ' + (target.title.trim() || 'Без названия')}</option>)}</select></label>
              </div>

            </article>)}
          </div>
        </section>

        <section className="process-editor-section">
          <div className="process-editor-section-heading"><div><b>Полезные ссылки</b><span>До 10 ссылок на сайты и материалы</span></div><button type="button" className="secondary-button" onClick={addSource} disabled={form.sources.length >= 10}><Link2 size={14}/> Добавить ссылку</button></div>
          {!form.sources.length && <div className="process-editor-empty-links">Пока ссылок нет. Их можно добавить или оставить список пустым.</div>}
          <div className="process-editor-repeat-list">
            {form.sources.map((source, index) => <article className="process-editor-repeat-card process-editor-source-card" key={index}>
              <div className="process-editor-repeat-heading"><strong>Ссылка {index + 1}</strong><button type="button" className="process-editor-remove" onClick={() => removeSource(index)}><Trash2 size={14}/><span>Удалить</span></button></div>
              <label className="form-field"><span>Название *</span><input required value={source.label} onChange={event => updateSource(index, 'label', event.target.value)} maxLength={200} placeholder="Официальный портал"/></label>
              <label className="form-field"><span>URL *</span><input required type="url" pattern="https?://.+" value={source.url} onChange={event => updateSource(index, 'url', event.target.value)} maxLength={2000} placeholder="https://example.gov.kg"/></label>
            </article>)}
          </div>
        </section>

        {formError && <div className="feedback feedback-error" role="alert"><CircleHelp size={15}/><span>{formError}</span></div>}
        {error && <div className="feedback feedback-error" role="alert"><CircleHelp size={15}/><span>{error}</span></div>}
        <div className="modal-actions process-editor-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Отмена</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? <><RefreshCw size={15} className="spin"/> Сохранение…</> : <><CheckCircle2 size={15}/> Сохранить инструкцию</>}</button>
        </div>
      </form>
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

function DocumentRow({ doc, onClick, onEdit, canEdit = false }) {
  const jurisdiction = jurisdictions[doc.jurisdiction] || jurisdictions.EAEU
  const isMzkm = isMzkmCatalogDocument(doc)
  const catalogLabel = isMzkm ? 'МЗКМ' : jurisdiction.short
  const catalogClass = isMzkm ? 'ru' : jurisdiction.className
  const handleKeyDown = event => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }
  return <div className="document-row" role="button" tabIndex={0} onClick={onClick} onKeyDown={handleKeyDown}>
    <span className={`doc-icon ${catalogClass}`}><FileText size={20} /></span>
    <span className="doc-main"><b>{doc.title}</b><span>{doc.description}</span>{doc.matchedInAttachment && <span className="search-match-origin"><Paperclip size={12}/>Найдено в приложенном файле</span>}<small><span className={`tag ${catalogClass}`}>{catalogLabel}</span>{doc.documentNumber && <span>№ {doc.documentNumber}</span>}<span>{doc.kind}</span><span>·</span><span>{doc.area}</span></small></span>
    <span className={`doc-status ${statusClass(doc)}`}>{doc.statusLabel || doc.status}</span>
    {canEdit && !doc.isDemo && <button type="button" className="icon-button document-row-edit" aria-label={'Редактировать карточку: ' + doc.title} title="Редактировать карточку" onClick={event => { event.stopPropagation(); onEdit?.() }}><Pencil size={15}/></button>}
    <ArrowDownRight size={17} className="doc-arrow" />
  </div>
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

function DocumentDetail({ doc, onBack, onEdit, onDelete, canEdit, canDelete, canReview, canReindex, canUploadFiles, files = [], versions = [], documents = [], onOpenRelated, onDownload, onUploadFile, uploadingFile, onReview, onReindexFile, reindexingFileId, isFavorite = false, onToggleFavorite }) {
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
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length && onUploadFile) await onUploadFile(files)
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
          {onToggleFavorite && <button type="button" className="secondary-button wiki-favorite-button" onClick={onToggleFavorite}><Star size={14} fill={isFavorite ? 'currentColor' : 'none'}/>{isFavorite ? 'В избранном' : 'В избранное'}</button>}
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
              <input ref={attachmentInputRef} className="wiki-hidden-file-input" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onChange={handleAttachmentChange} />
              <div><b>Добавить оригиналы или приложения</b><small>Можно выбрать несколько файлов за раз · PDF, Word, Excel, CSV, TXT, PNG или JPG · до 30 МБ на файл</small></div>
              <button type="button" className="secondary-button" onClick={() => attachmentInputRef.current?.click()} disabled={uploadingFile}><Paperclip size={14}/>{uploadingFile ? 'Загрузка…' : 'Прикрепить файлы'}</button>
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
          <label className="form-field full-field upload-field"><span>Прикрепить файлы к карточке (необязательно, до 30 МБ каждый)</span><span className="file-input-wrap"><Paperclip size={16} /><input name="file" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" /></span><small className="form-help">{apiEnabled ? 'Выбранные файлы сохранятся в общей базе и будут доступны пользователям с правами.' : 'В демо-режиме файлы сохранятся в этом браузере через локальное хранилище. Для других сотрудников нужна общая база.'}</small></label>
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


function AiAssistantSection({ apiEnabled, isAdmin, onOpenDocument }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feedbackSummary, setFeedbackSummary] = useState(null)
  const [feedbackSummaryLoading, setFeedbackSummaryLoading] = useState(false)
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false)
  const [feedbackReasonTarget, setFeedbackReasonTarget] = useState(null)
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  useEffect(() => {
    if (!apiEnabled || !isAdmin) return
    let cancelled = false
    apiRequest('/api/ai/feedback/summary')
      .then(summary => { if (!cancelled) setFeedbackSummary(summary) })
      .catch(() => { if (!cancelled) setFeedbackSummary(null) })
    return () => { cancelled = true }
  }, [apiEnabled, isAdmin])

  const refreshFeedbackSummary = async () => {
    if (!apiEnabled || !isAdmin) return
    setFeedbackSummaryLoading(true)
    try {
      setFeedbackSummary(await apiRequest('/api/ai/feedback/summary'))
    } catch {
      setFeedbackSummary(null)
    } finally {
      setFeedbackSummaryLoading(false)
    }
  }

  const submitFeedback = async (messageIndex, rating, category = 'answer') => {
    const message = messages[messageIndex]
    if (!message || message.role !== 'assistant' || message.feedbackSent) return
    try {
      await apiRequest('/api/ai/feedback', {
        method: 'POST',
        body: {
          rating,
          category,
          question: message.question || '',
          answer: message.answer || '',
          sourceTitles: (message.sources || []).map(source => source.title).filter(Boolean).slice(0, 6)
        }
      })
      setMessages(previous => previous.map((item, i) => i === messageIndex ? { ...item, feedbackSent: rating, feedbackCategory: category } : item))
      setFeedbackReasonTarget(null)
      if (isAdmin) refreshFeedbackSummary()
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить оценку')
    }
  }

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
      const result = await apiRequest('/api/ai/ask', { method: 'POST', body: { question: text, history: messages.slice(-8).map(message => ({ role: message.role, content: message.answer })) } })
      setMessages(previous => [...previous, {
        role: 'assistant',
        answer: result.answer || 'Не удалось получить ответ.',
        question: text,
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
            <span>Для генерации ответа релевантный текст отправляется в Groq через backend. Если вы оцениваете ответ, вопрос, ответ, названия источников и ваш логин сохраняются в базе для контроля качества и доступны администраторам. Не используйте помощника для закрытых сведений, налоговой тайны или персональных данных без разрешения организации.</span>
          </div>
          {!apiEnabled && <div className="assistant-unavailable"><CircleHelp size={15}/> Общая база и серверный ИИ не подключены в демо-режиме.</div>}
        </aside>

        <div className="assistant-chat-panel">
          <div className="assistant-chat-heading">
            <div className="assistant-chat-avatar"><Bot size={19}/></div>
            <div><b>TEKSHER AI</b><small>Помощник по базе знаний</small></div>
            {isAdmin && apiEnabled && <button type="button" className="assistant-feedback-toggle" aria-expanded={feedbackPanelOpen} onClick={() => setFeedbackPanelOpen(open => !open)}><ChevronDown size={14} className={feedbackPanelOpen ? 'assistant-feedback-toggle-icon is-open' : 'assistant-feedback-toggle-icon'}/>{feedbackPanelOpen ? 'Скрыть' : 'Контроль качества'}</button>}
            <span className="assistant-online-dot">Поиск по источникам</span>
          </div>
          {isAdmin && apiEnabled && feedbackPanelOpen && <section className="assistant-feedback-admin">
            <div className="assistant-feedback-admin-heading">
              <div><b>Контроль качества ответов</b><small>Сохранённые оценки пользователей</small></div>
              <button type="button" className="secondary-button" onClick={refreshFeedbackSummary} disabled={feedbackSummaryLoading}>{feedbackSummaryLoading ? 'Обновление…' : 'Обновить'}</button>
            </div>
            {feedbackSummary ? <>
              <div className="assistant-feedback-stats">
                <div><span>Всего оценок</span><b>{feedbackSummary.total}</b></div>
                <div><span>Полезные</span><b>{feedbackSummary.positive}</b></div>
                <div><span>Неполезные</span><b>{feedbackSummary.negative}</b></div>
                <div><span>Доля полезных</span><b>{feedbackSummary.positiveRate ?? 0}%</b></div>
              </div>
              {feedbackSummary.negativeCategories?.length > 0 && <div className="assistant-feedback-categories">
                <b>Причины отрицательных оценок</b>
                {feedbackSummary.negativeCategories.map(item => <div className="assistant-feedback-category" key={item.category}>
                  <div><span>{({ incorrect: 'Неточность', no_source: 'Нет источника', outdated: 'Устаревшие сведения', unclear: 'Непонятный ответ', other: 'Другое', answer: 'Ответ' })[item.category] || item.category}</span><strong>{item.count}</strong></div>
                  <i><em style={{ width: (item.count * 100 / Math.max(1, ...feedbackSummary.negativeCategories.map(category => category.count))) + '%' }}/></i>
                </div>)}
              </div>}
              {feedbackSummary.recentNegative?.length > 0 ? <div className="assistant-feedback-review-list">
                <b>Последние отрицательные оценки</b>
                {feedbackSummary.recentNegative.map(item => <article className="assistant-feedback-review-item" key={item.id}>
                  <div className="assistant-feedback-review-meta"><span>{item.username || 'Пользователь'} · {({ incorrect: 'Неточность', no_source: 'Нет источника', outdated: 'Устаревшие сведения', unclear: 'Непонятный ответ', other: 'Другое', answer: 'Ответ' })[item.category] || item.category || 'Причина не указана'}</span><span>{item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : ''}</span></div>
                  <div><strong>Вопрос:</strong> {item.question || 'Вопрос не сохранён'}</div>
                  <div><strong>Ответ:</strong> {item.answer || 'Ответ не сохранён'}</div>
                  {item.sourceTitles && <small><strong>Источники:</strong> {item.sourceTitles.split('\\n').filter(Boolean).join(' · ')}</small>}
                </article>)}
              </div> : <p className="assistant-feedback-empty">Отрицательных оценок пока нет.</p>}
            </> : <p className="assistant-feedback-empty">Не удалось загрузить оценки. Нажмите «Обновить».</p>}
          </section>}
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
              {message.role === 'assistant' && !message.feedbackSent && <div className="assistant-feedback-actions"><span>Полезен ли ответ?</span><button type="button" title="Полезный ответ" onClick={() => submitFeedback(index, 'positive')}><ThumbsUp size={14}/> Да</button><button type="button" title="Неполезный ответ" onClick={() => setFeedbackReasonTarget(index)}><ThumbsDown size={14}/> Нет</button></div>}
              {message.role === 'assistant' && !message.feedbackSent && feedbackReasonTarget === index && <div className="assistant-feedback-reasons">
                <span>Что следует исправить?</span>
                <button type="button" onClick={() => submitFeedback(index, 'negative', 'incorrect')}>Неточность</button>
                <button type="button" onClick={() => submitFeedback(index, 'negative', 'no_source')}>Нет источника</button>
                <button type="button" onClick={() => submitFeedback(index, 'negative', 'outdated')}>Устаревшие сведения</button>
                <button type="button" onClick={() => submitFeedback(index, 'negative', 'unclear')}>Непонятный ответ</button>
                <button type="button" onClick={() => submitFeedback(index, 'negative', 'other')}>Другое</button>
                <button type="button" className="assistant-feedback-reason-cancel" onClick={() => setFeedbackReasonTarget(null)}>Отмена</button>
              </div>}
              {message.role === 'assistant' && message.feedbackSent && <div className="assistant-feedback-actions">Спасибо за оценку!</div>}
              {message.role === 'assistant' && message.sources?.length > 0 && <div className="assistant-sources">
                <div className="assistant-sources-heading"><BookOpen size={15}/> Использованные источники ({message.sources.length})</div>
                {message.sources.map(source => <article className="assistant-source-card" key={source.id}>
                  <div className="assistant-source-top"><span className="assistant-source-number">[{source.number}]</span><span className={'assistant-source-status assistant-status-' + String(source.status || '').toLowerCase()}>{source.statusLabel || 'Статус не указан'}</span></div>
                  {source.sourceType === 'BUSINESS_PROCESS' || source.sourceType === 'WEB'
                    ? <div className="assistant-source-title">{source.title}</div>
                    : <button type="button" className="assistant-source-title" onClick={() => onOpenDocument(source.id)}>{source.title}<ArrowUpRight size={14}/></button>}
                  <div className="assistant-source-meta">{source.sourceType === 'BUSINESS_PROCESS' ? 'Бизнес-процесс · внутренняя база' : source.sourceType === 'WEB' ? 'Интернет · официальный сайт' : (source.jurisdiction || 'Юрисдикция не указана')}{source.kind ? ' · ' + source.kind : ''}{source.effectiveFrom ? ' · с ' + source.effectiveFrom : ''}{source.effectiveUntil ? ' · по ' + source.effectiveUntil : ''}</div>
                  {source.excerpt && <p className="assistant-source-excerpt">{source.excerpt}</p>}
                  {source.sourceUrl && <a className="assistant-source-link" href={source.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/> {source.sourceType === 'BUSINESS_PROCESS' ? 'Связанная ссылка' : source.sourceType === 'WEB' ? 'Открыть официальный источник' : 'Официальный источник'}</a>}
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

function NotificationsSection({ onOpenTasks }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest('/api/notifications')
      setRows(Array.isArray(result) ? result : [])
    } catch (exception) {
      setError(exception.message || 'Не удалось загрузить уведомления.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  const unreadCount = rows.filter(row => !row.readAt).length

  const markRead = async row => {
    if (row.readAt || savingId) return
    setSavingId(row.id)
    setError('')
    try {
      await apiRequest('/api/notifications/' + row.id + '/read', { method: 'PATCH' })
      setRows(current => current.map(item => item.id === row.id ? { ...item, readAt: new Date().toISOString() } : item))
    } catch (exception) {
      setError(exception.message || 'Не удалось отметить уведомление прочитанным.')
    } finally {
      setSavingId(null)
    }
  }

  const markAllRead = async () => {
    setSavingId('all')
    setError('')
    setMessage('')
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' })
      const now = new Date().toISOString()
      setRows(current => current.map(item => item.readAt ? item : { ...item, readAt: now }))
      setMessage('Все уведомления отмечены прочитанными.')
    } catch (exception) {
      setError(exception.message || 'Не удалось обновить уведомления.')
    } finally {
      setSavingId(null)
    }
  }

  return <section className="management-page notifications-page">
    <div className="page-heading">
      <div><div className="section-kicker">ЛИЧНЫЙ ЦЕНТР / СОБЫТИЯ</div><h1>Уведомления</h1><p>Новые поручения, комментарии и изменения статусов задач, назначенные вам.</p></div>
      <div className="heading-actions">
        <span className="record-count">{unreadCount} непрочитано</span>
        <button type="button" className="secondary-button" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''}/> Обновить</button>
        <button type="button" className="primary-button" onClick={markAllRead} disabled={!unreadCount || Boolean(savingId)}>{savingId === 'all' ? <RefreshCw size={14} className="spin"/> : <CheckCircle2 size={14}/>} Прочитать все</button>
      </div>
    </div>
    {error && <div className="feedback feedback-error" role="alert"><CircleHelp size={15}/><span>{error}</span></div>}
    {message && <div className="feedback feedback-success" role="status"><CheckCircle2 size={15}/><span>{message}</span></div>}
    {loading ? <div className="empty-state"><RefreshCw size={22} className="spin"/><b>Загружаем уведомления…</b></div>
      : rows.length ? <div className="notification-list">{rows.map(row => <article className={'notification-card' + (row.readAt ? ' is-read' : ' is-unread')} key={row.id}>
        <span className="notification-icon"><Bell size={17}/></span>
        <div className="notification-copy"><div className="notification-title-row"><b>{row.title}</b><time>{formatDateTime(row.createdAt)}</time></div><p>{row.message}</p>
          {row.taskId && <button type="button" className="text-button" onClick={onOpenTasks}>Открыть задачи <ArrowUpRight size={14}/></button>}
        </div>
        {!row.readAt && <button type="button" className="secondary-button notification-read-button" onClick={() => markRead(row)} disabled={Boolean(savingId)}>{savingId === row.id ? 'Сохраняем…' : 'Прочитано'}</button>}
      </article>)}</div>
      : <div className="empty-state"><Bell size={24}/><b>Уведомлений пока нет</b><span>Когда вам назначат задачу или коллега ответит в обсуждении, событие появится здесь.</span></div>}
  </section>
}

function MyTasksPanel({ currentUser, canAssign }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [assignedTo, setAssignedTo] = useState('')
  const [commentsOpenFor, setCommentsOpenFor] = useState(null)
  const [commentsByTask, setCommentsByTask] = useState({})
  const [commentDrafts, setCommentDrafts] = useState({})
  const [commentsLoadingFor, setCommentsLoadingFor] = useState(null)
  const [commentSavingFor, setCommentSavingFor] = useState(null)

  const loadTasks = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await apiRequest('/api/tasks')
      setTasks(Array.isArray(rows) ? rows : [])
    } catch (exception) {
      setError(exception.message || 'Не удалось загрузить задачи.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTasks() }, [])

  const createTask = async event => {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const created = await apiRequest('/api/tasks', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim(),
          dueDate: dueDate || null,
          priority,
          assignedTo: canAssign ? (assignedTo.trim() || currentUser?.username) : currentUser?.username,
        },
      })
      setTasks(rows => [created, ...rows.filter(row => row.id !== created.id)])
      setTitle('')
      setDescription('')
      setDueDate('')
      setPriority('NORMAL')
      setAssignedTo('')
      setNotice('Задача создана.')
    } catch (exception) {
      setError(exception.message || 'Не удалось создать задачу.')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (task, status) => {
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest('/api/tasks/' + task.id, { method: 'PATCH', body: { status } })
      setTasks(rows => rows.map(row => row.id === updated.id ? updated : row))
    } catch (exception) {
      setError(exception.message || 'Не удалось изменить статус задачи.')
    }
  }

  const toggleTaskComments = async task => {
    if (commentsOpenFor === task.id) {
      setCommentsOpenFor(null)
      return
    }
    setCommentsOpenFor(task.id)
    if (Array.isArray(commentsByTask[task.id])) return
    setCommentsLoadingFor(task.id)
    setError('')
    try {
      const rows = await apiRequest('/api/tasks/' + task.id + '/comments')
      setCommentsByTask(current => ({ ...current, [task.id]: Array.isArray(rows) ? rows : [] }))
    } catch (exception) {
      setError(exception.message || 'Не удалось загрузить комментарии к задаче.')
    } finally {
      setCommentsLoadingFor(null)
    }
  }

  const addTaskComment = async (event, task) => {
    event.preventDefault()
    const body = String(commentDrafts[task.id] || '').trim()
    if (!body || commentSavingFor) return
    setCommentSavingFor(task.id)
    setError('')
    setNotice('')
    try {
      const created = await apiRequest('/api/tasks/' + task.id + '/comments', { method: 'POST', body: { body } })
      setCommentsByTask(current => ({ ...current, [task.id]: [...(current[task.id] || []), created] }))
      setCommentDrafts(current => ({ ...current, [task.id]: '' }))
      setNotice('Комментарий добавлен.')
    } catch (exception) {
      setError(exception.message || 'Не удалось добавить комментарий.')
    } finally {
      setCommentSavingFor(null)
    }
  }

  const deleteTask = async task => {
    if (!window.confirm('Удалить задачу «' + task.title + '»?')) return
    setError('')
    try {
      await apiRequest('/api/tasks/' + task.id, { method: 'DELETE' })
      setTasks(rows => rows.filter(row => row.id !== task.id))
      setNotice('Задача удалена.')
    } catch (exception) {
      setError(exception.message || 'Не удалось удалить задачу.')
    }
  }

  const statusLabels = { TODO: 'К выполнению', IN_PROGRESS: 'В работе', DONE: 'Выполнено' }
  const priorityLabels = { LOW: 'Низкий', NORMAL: 'Обычный', HIGH: 'Высокий' }
  const openCount = tasks.filter(task => task.status !== 'DONE').length

  return <section className="home-tasks-panel" aria-label="Рабочие задачи">
    <div className="home-tasks-heading"><div><div className="section-kicker">КОМАНДНАЯ РАБОТА</div><h2>Задачи</h2><p>Личные задачи и поручения команды, сохраняемые на сервере.</p></div>
      <div className="home-task-count"><strong>{openCount}</strong><span>активных</span><button type="button" className="icon-button" onClick={loadTasks} aria-label="Обновить задачи" disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/></button></div>
    </div>
    <form className="home-task-form" onSubmit={createTask}>
      <div className="home-task-form-main">
        <label className="form-field"><span>Название задачи *</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={240} required placeholder="Например, проверить новую редакцию инструкции"/></label>
        <label className="form-field"><span>Описание</span><input value={description} onChange={event => setDescription(event.target.value)} maxLength={1500} placeholder="Что нужно сделать"/></label>
      </div>
      <div className="home-task-form-options">
        <label className="form-field"><span>Срок</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></label>
        <label className="form-field"><span>Приоритет</span><select value={priority} onChange={event => setPriority(event.target.value)}><option value="LOW">Низкий</option><option value="NORMAL">Обычный</option><option value="HIGH">Высокий</option></select></label>
        {canAssign && <label className="form-field"><span>Исполнитель (логин)</span><input value={assignedTo} onChange={event => setAssignedTo(event.target.value)} maxLength={120} placeholder={currentUser?.username || 'Логин коллеги'}/></label>}
        <button className="primary-button home-task-create" type="submit" disabled={saving || !title.trim()}>{saving ? <RefreshCw size={14} className="spin"/> : <FilePlus2 size={14}/>} Добавить</button>
      </div>
    </form>
    {error && <div className="feedback feedback-error" role="alert"><CircleHelp size={14}/><span>{error}</span></div>}
    {notice && <div className="feedback feedback-success" role="status"><CheckCircle2 size={14}/><span>{notice}</span></div>}
    {loading ? <div className="home-tasks-empty"><RefreshCw size={18} className="spin"/> Загружаем задачи…</div>
      : tasks.length ? <div className="home-task-list">{tasks.map(task => <article className={'home-task-card task-status-' + task.status.toLowerCase()} key={task.id}>
        <div className="home-task-card-main"><div className="home-task-title-row"><strong>{task.title}</strong>{task.priority === 'HIGH' && <span className="task-priority-high">Высокий приоритет</span>}</div>
          {task.description && <p>{task.description}</p>}
          <div className="home-task-meta"><span><UsersRound size={12}/> {task.assignedTo === currentUser?.username ? 'Вы исполнитель' : task.assignedTo}</span><span><CalendarDays size={12}/> {task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString('ru-RU') : 'Без срока'}</span><span>Автор: {task.createdBy}</span></div>
        </div>
        <div className="home-task-actions"><label className="sr-only" htmlFor={'task-status-' + task.id}>Статус задачи</label><select id={'task-status-' + task.id} value={task.status} onChange={event => changeStatus(task, event.target.value)} aria-label={'Статус задачи ' + task.title}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button type="button" className="secondary-button home-task-comments-trigger" onClick={() => toggleTaskComments(task)}><MessageCircle size={14}/> Комментарии</button>
          {(currentUser?.role === 'ADMIN' || task.createdBy?.toLowerCase() === currentUser?.username?.toLowerCase()) && <button type="button" className="icon-button" onClick={() => deleteTask(task)} aria-label={'Удалить задачу ' + task.title}><Trash2 size={14}/></button>}
        </div>
        {commentsOpenFor === task.id && <div className="home-task-comments">
          <div className="home-task-comments-heading"><b>Обсуждение</b><span>{(commentsByTask[task.id] || []).length} комментариев</span></div>
          {commentsLoadingFor === task.id ? <div className="home-tasks-empty"><RefreshCw size={15} className="spin"/> Загружаем комментарии…</div>
            : (commentsByTask[task.id] || []).length ? <div className="home-task-comment-list">{commentsByTask[task.id].map(comment => <article className="home-task-comment" key={comment.id}><div><b>{comment.username}</b><time>{formatDateTime(comment.createdAt)}</time></div><p>{comment.body}</p></article>)}</div>
            : <p className="home-task-comments-empty">Комментариев пока нет. Добавьте контекст или результат проверки.</p>}
          <form className="home-task-comment-form" onSubmit={event => addTaskComment(event, task)}><label className="sr-only" htmlFor={'task-comment-' + task.id}>Комментарий к задаче</label><textarea id={'task-comment-' + task.id} value={commentDrafts[task.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [task.id]: event.target.value }))} maxLength={1500} rows={2} placeholder="Напишите комментарий…" required/><button type="submit" className="primary-button" disabled={commentSavingFor === task.id || !(commentDrafts[task.id] || '').trim()}>{commentSavingFor === task.id ? 'Отправка…' : 'Отправить'}</button></form>
        </div>}
      </article>)}</div>
      : <div className="home-tasks-empty"><ListTree size={20}/><span>Задач пока нет. Создай первую задачу в форме выше.</span></div>}
  </section>
}

function AuditLogSection() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest('/api/audit-log?limit=250')
      setRows(Array.isArray(result) ? result : [])
    } catch (exception) {
      setError(exception.message || 'Не удалось загрузить журнал действий.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  const filtered = rows.filter(row => [row.username, row.action, row.entityType, row.entityId, row.entityLabel, row.details].join(' ').toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')))
  const actionLabels = {
    CREATE: 'Создание', UPDATE: 'Изменение', DELETE: 'Удаление', RESTORE: 'Восстановление версии',
    UPDATE_PROGRESS: 'Сохранение прогресса', RESET_PROGRESS: 'Сброс прогресса', COMMENT: 'Комментарий к задаче',
    CREATE_USER: 'Создание пользователя', RESET_PASSWORD: 'Сброс пароля',
    ENABLE_USER: 'Включение пользователя', DISABLE_USER: 'Отключение пользователя',
    REVIEW: 'Проверка актуальности', CHECK_SOURCE: 'Проверка источника'
  }

  return <section className="management-page">
    <div className="page-heading"><div><div className="section-kicker">АДМИНИСТРИРОВАНИЕ / ПРОЗРАЧНОСТЬ</div><h1>Журнал действий</h1><p>Последние действия пользователей в системе. Журнал доступен только администраторам.</p></div>
      <button type="button" className="secondary-button" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''}/> Обновить</button>
    </div>
    <div className="search-panel audit-search-panel"><div className="search-input-wrap"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по пользователю, действию или объекту…"/></div><span className="record-count">{filtered.length} записей</span></div>
    {error && <div className="feedback feedback-error" role="alert"><CircleHelp size={15}/><span>{error}</span></div>}
    {loading ? <div className="empty-state"><RefreshCw size={22} className="spin"/><b>Загружаем журнал…</b></div>
      : filtered.length ? <div className="user-table-wrap audit-table-wrap"><table className="user-table audit-table">
        <thead><tr><th>Дата и время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>Подробности</th></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}><td>{formatDateTime(row.createdAt)}</td><td>{row.username}</td><td><span className="role-pill">{actionLabels[row.action] || row.action}</span></td><td><strong>{row.entityLabel || row.entityId || '–'}</strong><small className="audit-entity-type">{row.entityType}</small></td><td>{row.details || '–'}</td></tr>)}</tbody>
      </table></div>
      : <div className="empty-state"><History size={24}/><b>{query.trim() ? 'Совпадений нет' : 'Записей пока нет'}</b><span>{query.trim() ? 'Измени поисковый запрос.' : 'Действия будут появляться здесь по мере работы пользователей.'}</span></div>}
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
