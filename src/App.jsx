import { useEffect, useMemo, useState } from 'react'
import { API_ENABLED, API_BASE, apiRequest, clearStoredToken, getStoredToken, storeToken } from './lib/api.js'
import {
  ArrowDownRight, ArrowUpRight, BookOpen, Boxes, CalendarDays, ChevronDown,
  CircleHelp, ExternalLink, FileCheck2, FilePlus2, FileText, Globe2, Home,
  Landmark, Layers3, LibraryBig, Link2, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Workflow, X, Pencil, Trash2, RefreshCw, UsersRound, LogOut, Paperclip, Download, History, CheckCircle2, UserPlus
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

const navGroups = [
  { title: 'ПЛАТФОРМА', items: [
    { id: 'home', label: 'Главная', icon: Home },
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

function loadUserDocuments() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function App() {
  const [active, setActive] = useState('home')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Все типы')
  const [statusFilter, setStatusFilter] = useState('Все статусы')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [userDocuments, setUserDocuments] = useState(loadUserDocuments)
  const [apiDocuments, setApiDocuments] = useState([])
  const [apiFiles, setApiFiles] = useState([])
  const [documentVersions, setDocumentVersions] = useState([])
  const [monitors, setMonitors] = useState([])
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [authInitializing, setAuthInitializing] = useState(API_ENABLED)
  const [loginError, setLoginError] = useState('')
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [monitorModalOpen, setMonitorModalOpen] = useState(false)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [passwordResetTarget, setPasswordResetTarget] = useState(null)

  const documents = useMemo(() => API_ENABLED ? apiDocuments : [...userDocuments, ...demoDocuments], [apiDocuments, userDocuments])

  const filteredDocuments = useMemo(() => documents.filter((doc) => {
    const matchesJurisdiction = ['RU', 'KG', 'EAEU'].includes(active) ? doc.jurisdiction === active : true
    const matchesQuery = [doc.title, doc.description, doc.area, doc.kind, doc.productGroup || '', doc.keywords || '', doc.documentNumber || ''].join(' ').toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'Все типы' || doc.kind === filter
    const displayStatus = doc.statusLabel || doc.status
    const matchesStatus = statusFilter === 'Все статусы' || displayStatus === statusFilter
    const matchesSection = active === 'groups' ? (doc.kind === 'Товарная группа' || doc.area === 'Товарные группы')
      : active === 'processes' ? doc.kind === 'Бизнес-процесс'
      : active === 'knowledge' ? ['Инструкция', 'Внутренний документ', 'Техническая документация', 'Известная ошибка', 'Шаблон'].includes(doc.kind)
      : true
    return matchesJurisdiction && matchesQuery && matchesFilter && matchesStatus && matchesSection
  }), [documents, active, query, filter, statusFilter])

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
    : jurisdictions[active]?.label || ({ documents: 'Все документы', groups: 'Товарные группы', processes: 'Бизнес-процессы', knowledge: 'Инструкции и база знаний', monitoring: 'Мониторинг официальных источников', users: 'Управление пользователями' }[active] || 'TEKSHER HUB')

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

  const openDocument = (doc) => {
    syncRoute(active, doc.id)
    setSelectedDoc(doc)
    setActionError(''); setSuccessMessage('')
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
    if (API_ENABLED) setApiDocuments(await apiRequest('/api/documents'))
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
    setApiFiles([])
    setDocumentVersions([])
    setSelectedDoc(null)
    setActive('home')
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
      status: String(data.get('status') || ''),
      changeNote: String(data.get('changeNote') || '').trim() || (editingDoc ? 'Редактирование карточки' : 'Создание карточки'),
    }
    const upload = data.get('file')
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
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDocuments)) } catch { /* local storage unavailable */ }
        setSuccessMessage('Карточка сохранена в текущем браузере. Для общей базы подключи API.')
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

  const handleDeleteDocument = async (doc) => {
    if (doc.isDemo || !window.confirm('Удалить карточку «' + doc.title + '»?')) return
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
    } catch (error) { setActionError(error.message || 'Не удалось удалить карточку.') }
  }

  const handleReviewDocument = async (status) => {
    if (!selectedDoc || !API_ENABLED) return
    const note = window.prompt('Комментарий проверки источника (необязательно):', 'Проверено вручную')
    if (note === null) return
    try {
      const updated = await apiRequest('/api/documents/' + selectedDoc.id + '/review', {
        method: 'POST', body: { status, note }
      })
      setSelectedDoc(updated)
      await refreshDocuments()
      setSuccessMessage('Статус проверки обновлён.')
      setActionError('')
    } catch (error) { setActionError(error.message || 'Не удалось обновить статус.') }
  }

  const handleDownloadFile = async (file) => {
    try {
      const blob = await apiRequest(file.downloadPath, { responseType: 'blob' })
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

  const handleDeleteMonitor = async (monitor) => {
    if (!window.confirm('Удалить источник «' + monitor.name + '» из мониторинга?')) return
    try {
      await apiRequest('/api/monitors/' + monitor.id, { method: 'DELETE' })
      await refreshMonitors()
    } catch (error) { setActionError(error.message || 'Не удалось удалить источник.') }
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
          <div className="topbar-right"><span className="internal-badge"><ShieldCheck size={14} /> {API_ENABLED ? currentUser?.role || 'Пользователь' : 'Демо-режим'}</span><div className="avatar">{currentUser?.displayName ? currentUser.displayName.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase() : 'ОП'}</div>{API_ENABLED && <button className="logout-button" onClick={handleLogout} title="Выйти"><LogOut size={15} /><span>Выход</span></button>}</div>
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
              files={apiFiles} versions={documentVersions} documents={documents} onOpenRelated={docId => { const related = documents.find(item => item.id === docId); if (related) openDocument(related) }} onDownload={handleDownloadFile} onReview={handleReviewDocument} />
            : active === 'groups' ? <ProductGroupsSection onOpen={openSection} />
            : active === 'monitoring' ? <MonitorSection monitors={monitors} canManage={['ADMIN','EDITOR'].includes(currentUser?.role)}
                onAdd={() => { setActionError(''); setMonitorModalOpen(true) }} onCheck={handleCheckMonitor} onDelete={handleDeleteMonitor} />
            : active === 'users' ? <UsersSection users={users} onAdd={() => { setActionError(''); setUserModalOpen(true) }} onToggle={handleToggleUser} onReset={user => { setActionError(''); setPasswordResetTarget(user) }} />
            : <>
            <div className="page-heading">
              <div><div className="section-kicker">БАЗА ЗНАНИЙ / {jurisdictions[active]?.short || 'TEKSHER HUB'}</div><h1>{pageTitle}</h1><p>{jurisdictions[active] ? `Документы и материалы: ${jurisdictions[active].label}. ` : 'Поиск по нормативным актам и рабочим материалам платформы.'}{API_ENABLED ? ' Проверяйте реквизиты и статус каждого документа перед применением.' : ' Демонстрационные записи не являются официальной нормативной базой.'}</p></div>
              <div className="heading-actions"><span className="record-count">{filteredDocuments.length} записей</span>{(!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)) && <button className="primary-button" onClick={openNewDocumentModal}><FilePlus2 size={16} /> Добавить запись</button>}</div>
            </div>
            <div className="search-panel">
              <div className="search-input-wrap"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию, номеру или содержанию..." /></div>
              <div className="filter-wrap"><SlidersHorizontal size={16} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>Все типы</option><option>Обзор</option><option>Нормативный акт</option><option>Товарная группа</option><option>Инструкция</option><option>Техническая документация</option><option>Известная ошибка</option><option>Шаблон</option><option>Внутренний документ</option><option>Бизнес-процесс</option></select><ChevronDown size={14} /></div>
              <div className="filter-wrap status-select"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Все статусы</option><option>Демонстрационная запись</option><option>Черновик</option><option>Источник указан</option><option>На проверке</option><option>Действует</option><option>Срок действия истёк</option><option>В архиве</option></select><ChevronDown size={14} /></div>
            </div>
            <div className="notice"><CircleHelp size={17} /><div><b>{API_ENABLED ? 'Единая база документов' : 'Локальный демонстрационный режим'}</b><span>{API_ENABLED ? 'Данные загружаются из PostgreSQL через защищённый API. Перед публикацией проверяйте официальный источник и дату действия.' : 'Карточки сохраняются только в этом браузере. Чтобы включить общую базу, вход по ролям, версии и загрузку файлов, задайте VITE_API_URL после развёртывания backend.'}</span></div></div>
            <div className="document-list">{filteredDocuments.length ? filteredDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} onClick={() => openDocument(doc)} />) : <div className="empty-state"><Search size={28} /><b>{active === 'groups' ? 'Справочник товарных групп пока пуст' : active === 'processes' ? 'Бизнес-процессы ещё не добавлены' : 'Ничего не найдено'}</b><span>{['groups', 'processes'].includes(active) ? 'Добавь первую карточку через форму. Она сохранится в этом браузере.' : 'Измени поисковый запрос или фильтр.'}</span>{['groups', 'processes'].includes(active) && (!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)) && <button className="secondary-button" onClick={openNewDocumentModal}>Добавить первую запись</button>}</div>}</div>
          </>}
          <footer className="footer"><span>TEKSHER HUB <i>·</i> Информационная платформа оператора маркировки</span><span>Версия 0.3 · 2026</span></footer>
        </div>
      </main>

      {showCreateModal && <CreateDocumentModal initialDoc={editingDoc} documents={documents.filter(item => !item.isDemo && item.id !== editingDoc?.id)} onClose={closeDocumentModal} onSubmit={handleSaveDocument} apiEnabled={API_ENABLED} saving={isSaving} error={actionError} />}
      {monitorModalOpen && <MonitorModal onClose={() => setMonitorModalOpen(false)} onSubmit={handleSaveMonitor} saving={isSaving} error={actionError} />}
      {userModalOpen && <UserModal onClose={() => setUserModalOpen(false)} onSubmit={handleSaveUser} saving={isSaving} error={actionError} />}
      {passwordResetTarget && <UserPasswordModal user={passwordResetTarget} onClose={() => setPasswordResetTarget(null)} onSubmit={handleResetPassword} saving={isSaving} error={actionError} />}
    </div>
  )
}

function ProductGroupsSection({ onOpen }) {
  const groups = [
    { id: 'external', title: 'Внешний контур – МЗКМ «Текшер»', code: 'ВНЕШКА · РФ', jurisdiction: 'RU', tone: 'external', subtitle: 'Маркировка и нормативные требования Российской Федерации', description: 'Для товаров, которые маркируются в российской системе «Честный ЗНАК» и проходят внешний контур взаимодействия. Работа с кодами и карточками организуется через МЗКМ «Текшер». Применяются российские НПА и специальные правила по каждой товарной группе.', items: ['Обувь и товары лёгкой промышленности', 'Парфюмерия и шины', 'Табачная и никотинсодержащая продукция', 'Упакованная вода и безалкогольные напитки', 'Другие группы из действующего российского перечня'], checklist: ['Проверить код ТН ВЭД / ОКПД2 и применимость маркировки', 'Проверить сроки и правила конкретной группы', 'Оформить карточку товара и заказать коды через МЗКМ', 'Обеспечить корректную передачу сведений и трансграничные документы'] },
    { id: 'internal', title: 'Внутренний контур – ГАИС МТ', code: 'ВНУТРЕННЯЯ · КР', jurisdiction: 'KG', tone: 'internal', subtitle: 'Национальная маркировка и учёт товаров в Кыргызской Республике', description: 'Для товаров и операций, подпадающих под национальное регулирование Кыргызской Республики. Основные источники – постановления Кабинета Министров КР, налоговое законодательство, правила маркировки и документы оператора ГАИС МТ. Не следует автоматически переносить сюда российские требования.', items: ['Товары из действующего национального перечня маркировки', 'Упакованная вода и учетно-контрольные марки – в пределах применимых требований', 'Национальные операции маркировки и учёта', 'Внутренние регламенты, инструкции и документы оператора'], checklist: ['Сверить товар с действующим перечнем КР', 'Определить тип маркировки и применимые сроки', 'Выполнить операции в ГАИС МТ по утверждённому процессу', 'Сохранить документы и проверить отражение операций в системе'] },
  ]
  return <div className="product-groups-page">
    <div className="page-heading"><div><div className="section-kicker">СПРАВОЧНИК / ДВА КОНТУРА</div><h1>Товарные группы</h1><p>Разделение по нормативной юрисдикции и системе работы. Наличие группы в списке не означает, что маркировка обязательна для любого товара внутри неё: сверяйте код товара, даты и действующую редакцию НПА.</p></div><div className="record-count">2 контура</div></div>
    <div className="notice"><CircleHelp size={17}/><div><b>Важно: контуры регулируются разными правилами</b><span>Внешний контур относится к российской системе МЗКМ и правилам РФ. Внутренний контур относится к национальной системе ГАИС МТ и законодательству КР. Акты ЕАЭС применяются отдельно в пределах их предмета регулирования.</span></div></div>
    <div className="product-contour-grid">{groups.map(group => <section className={'contour-card ' + group.tone} key={group.id}>
      <div className="contour-card-top"><span className="contour-icon"><Boxes size={23}/></span><span className="contour-code">{group.code}</span></div>
      <h2>{group.title}</h2><p className="contour-subtitle">{group.subtitle}</p><p className="contour-description">{group.description}</p>
      <div className="contour-section"><b>Основные категории</b><ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul></div>
      <div className="contour-section"><b>Рабочий порядок</b><ol>{group.checklist.map(item => <li key={item}>{item}</li>)}</ol></div>
      <button className="primary-button" onClick={() => onOpen(group.jurisdiction)}>Открыть нормативные документы <ArrowUpRight size={15}/></button>
    </section>)}</div>
    <section className="contour-reference"><div className="section-kicker">ОФИЦИАЛЬНЫЕ СПРАВОЧНИКИ</div><h2>Где проверять перечни и действующие редакции</h2><div className="reference-links">
      <a href="https://cbd.minjust.gov.kg/search-docs/ru" target="_blank" rel="noreferrer"><b>ЦБД правовой информации Минюста КР</b><span>Национальные НПА, редакции и статус документов</span><ExternalLink size={16}/></a>
      <a href="https://www.gov.kg/ru/npa" target="_blank" rel="noreferrer"><b>НПА Кабинета Министров КР</b><span>Официальные постановления и распоряжения</span><ExternalLink size={16}/></a>
      <a href="https://eec.eaeunion.org/" target="_blank" rel="noreferrer"><b>Евразийская экономическая комиссия</b><span>Соглашения и решения по маркировке в ЕАЭС</span><ExternalLink size={16}/></a>
      <a href="https://pravo.gov.ru/" target="_blank" rel="noreferrer"><b>Официальный портал правовой информации РФ</b><span>Официальное опубликование российских НПА</span><ExternalLink size={16}/></a>
    </div></section>
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
  const jurisdiction = jurisdictions[doc.jurisdiction]
  return <button className="document-row" onClick={onClick}>
    <span className={`doc-icon ${jurisdiction.className}`}><FileText size={20} /></span>
    <span className="doc-main"><b>{doc.title}</b><span>{doc.description}</span><small><span className={`tag ${jurisdiction.className}`}>{jurisdiction.short}</span>{doc.documentNumber && <span>№ {doc.documentNumber}</span>}<span>{doc.kind}</span><span>·</span><span>{doc.area}</span></small></span>
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

function DocumentDetail({ doc, onBack, onEdit, onDelete, canEdit, canDelete, canReview, files = [], versions = [], documents = [], onOpenRelated, onDownload, onReview }) {
  const jurisdiction = jurisdictions[doc.jurisdiction] || { label: doc.jurisdiction || 'Не указана', flag: '🌐', className: 'eaeu' }
  const statusLabel = doc.statusLabel || doc.status || 'Черновик'
  return <section className="detail-page">
    <button className="back-button" onClick={onBack}>← Назад к списку</button>
    <div className="detail-card">
      <span className={`tag ${jurisdiction.className}`}>{jurisdiction.flag} {jurisdiction.label}</span>
      <div className="detail-icon"><FileCheck2 size={28} /></div>
      <div className="detail-status-row"><span className={`status-pill ${statusClass(doc)}`}>{statusLabel}</span>{doc.isDemo && <span className="detail-muted">Пример интерфейса, не официальный документ</span>}</div>
      <h1>{doc.title}</h1><p>{doc.description}</p>
      {!doc.isDemo && (canEdit || canDelete) && <div className="detail-actions">
        {canEdit && <button type="button" className="secondary-button" onClick={onEdit}><Pencil size={15} /> Редактировать</button>}
        {canDelete && <button type="button" className="danger-button" onClick={onDelete}><Trash2 size={15} /> Удалить карточку</button>}
      </div>}
      {canReview && !doc.isDemo && <div className="review-actions">
        <span>Проверка источника</span>
        <button type="button" className="secondary-button" onClick={() => onReview('UNDER_REVIEW')}><RefreshCw size={14} /> На проверку</button>
        <button type="button" className="primary-button" onClick={() => onReview('ACTIVE')}><CheckCircle2 size={14} /> Подтвердить актуальность</button>
      </div>}
      <div className="detail-meta">
        <div><small>Тип материала</small><b>{doc.kind}</b></div>
        <div><small>Юрисдикция</small><b>{jurisdiction.label}</b></div>
        <div><small>Тематическая область</small><b>{doc.area || 'Не указана'}</b></div>
        <div><small>Товарная группа</small><b>{doc.productGroup || 'Не указана'}</b></div>
        <div><small>Ключевые слова</small><b>{doc.keywords || 'Не указаны'}</b></div>
        <div><small>Номер документа</small><b>{doc.documentNumber || 'Не указан'}</b></div>
        <div><small>Дата документа</small><b>{formatDate(doc.documentDate)}</b></div>
        <div><small>Действует с</small><b>{formatDate(doc.effectiveFrom)}</b></div>
        <div><small>Действует по</small><b>{formatDate(doc.effectiveUntil)}</b></div>
        <div><small>Версия карточки</small><b>{doc.versionNumber || 1}</b></div>
        <div><small>Последняя проверка источника</small><b>{formatDate(doc.officialSourceCheckedAt)}</b></div>
        <div><small>Добавил</small><b>{doc.createdBy || 'Локальная запись'}</b></div>
        <div><small>Обновил</small><b>{doc.updatedBy || '–'}</b></div>
        <div><small>Последнее изменение</small><b>{formatDate(doc.updatedAt || doc.createdAt)}</b></div>
      </div>
      {doc.sourceUrl ? <a className="source-link" href={doc.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /><span><b>Открыть источник документа</b><small>{doc.sourceUrl}</small></span><ArrowUpRight size={16} /></a> : <div className="notice"><CircleHelp size={17} /><div><b>{doc.isDemo ? 'Это демонстрационная запись' : 'Официальный источник не указан'}</b><span>{doc.isDemo ? 'Не используйте эту запись как юридическое основание. Добавьте проверенный документ с реквизитами и ссылкой на источник.' : 'Добавьте ссылку на официальный источник и проведите проверку перед использованием.'}</span></div></div>}
      {doc.sourceCheckNote && <div className="check-note"><b>Комментарий проверки</b><span>{doc.sourceCheckNote}</span></div>}
      {doc.relatedDocumentIds?.length > 0 && <section className="detail-subsection">
        <div className="subsection-heading"><div><Link2 size={17} /><b>Связанные документы</b></div><span>{doc.relatedDocumentIds.length}</span></div>
        <div className="related-document-list">{doc.relatedDocumentIds.map(id => {
          const related = documents.find(item => item.id === id)
          return related ? <button key={id} className="related-document" type="button" onClick={() => onOpenRelated?.(id)}><FileText size={16} /><span><b>{related.title}</b><small>{jurisdictions[related.jurisdiction]?.short || related.jurisdiction} · {related.kind}</small></span><ArrowUpRight size={15} /></button> : <div className="subsection-empty" key={id}>Связанный документ {id} не найден в текущем списке.</div>
        })}</div>
      </section>}
      {!doc.isDemo && <section className="detail-subsection">
        <div className="subsection-heading"><div><Paperclip size={17} /><b>Файлы документа</b></div><span>{files.length}</span></div>
        {files.length ? <div className="attached-files">{files.map(file => <div className="attached-file" key={file.id}><FileText size={18} /><div><b>{file.originalName}</b><small>{formatBytes(file.sizeBytes)} · {file.uploadedBy || 'пользователь'} · {formatDate(file.uploadedAt)}</small></div><button type="button" className="icon-button" onClick={() => onDownload(file)} aria-label="Скачать файл"><Download size={16} /></button></div>)}
        </div> : <p className="subsection-empty">К файлу документа пока ничего не прикреплено. Файл можно добавить через форму редактирования.</p>}
      </section>}
      {!doc.isDemo && <section className="detail-subsection">
        <div className="subsection-heading"><div><History size={17} /><b>История редакций</b></div><span>{versions.length || 0}</span></div>
        {versions.length ? <div className="version-list">{versions.map(version => <div className="version-row" key={version.id}><span className="version-number">v{version.versionNumber}</span><div><b>{version.changeNote || 'Изменение карточки'}</b><small>{version.changedBy} · {formatDate(version.createdAt)} · {version.statusLabel || version.status}</small></div></div>)}</div>
          : <p className="subsection-empty">История появится после первого сохранения в серверной базе.</p>}
      </section>}
      {doc.isDemo && <div className="notice"><CircleHelp size={17} /><div><b>Демонстрационная запись</b><span>Не используйте её как юридическое основание. В общей базе должны находиться реальные документы, проверенные по официальным источникам.</span></div></div>}
      {!API_ENABLED && !doc.isDemo && <p className="storage-note">Эта пользовательская карточка хранится только в локальном браузере и не видна другим сотрудникам.</p>}
    </div>
  </section>
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
}

function CreateDocumentModal({ initialDoc, documents = [], onClose, onSubmit, apiEnabled, saving, error }) {
  const initialStatus = ['DRAFT','UNDER_REVIEW','ACTIVE','EXPIRED','ARCHIVED'].includes(initialDoc?.status) ? initialDoc.status : ''
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-document-title">
      <header className="modal-header"><div><div className="section-kicker">КАТАЛОГ / НОРМАТИВНЫЙ ФОНД</div><h2 id="create-document-title">{initialDoc ? 'Редактировать карточку' : 'Добавить документ'}</h2><p>Укажите реквизиты и официальный источник. Перед отметкой «Действует» проверьте документ вручную.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть" disabled={saving}><X size={20} /></button></header>
      <form onSubmit={onSubmit}>
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
          <label className="form-field full-field"><span>Краткое описание *</span><textarea name="description" required rows="3" maxLength="3000" defaultValue={initialDoc?.description || ''} placeholder="Что регулирует документ и когда его использовать" /></label>
          {apiEnabled && <label className="form-field full-field"><span>Комментарий к редакции</span><input name="changeNote" maxLength="1000" placeholder="Например, обновлена дата вступления в силу" /></label>}
          {apiEnabled && <label className="form-field full-field upload-field"><span>Прикрепить файл (необязательно, до 30 МБ)</span><span className="file-input-wrap"><Paperclip size={16} /><input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" /></span></label>}
        </div>
        {error && <div className="feedback feedback-error"><CircleHelp size={16} /><span>{error}</span></div>}
        <div className="form-note"><CircleHelp size={16} /><span>{apiEnabled ? 'Карточка сохраняется в общей базе. Файл хранится в серверном каталоге. Статус «Действует» означает, что сотрудник подтвердил источник, а не автоматическое юридическое заключение.' : 'Карточка пока сохраняется только в этом браузере. Для общей базы настройте VITE_API_URL и backend.'}</span></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Отмена</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <RefreshCw size={15} className="spin" /> : <FilePlus2 size={16} />} {saving ? 'Сохранение…' : initialDoc ? 'Сохранить изменения' : 'Сохранить карточку'}</button></div>
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
