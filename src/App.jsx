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

  const documents = useMemo(() => API_ENABLED ? apiDocuments : [...userDocuments, ...demoDocuments], [apiDocuments, userDocuments])

  const filteredDocuments = useMemo(() => documents.filter((doc) => {
    const matchesJurisdiction = ['RU', 'KG', 'EAEU'].includes(active) ? doc.jurisdiction === active : true
    const matchesQuery = [doc.title, doc.description, doc.area, doc.kind, doc.documentNumber || ''].join(' ').toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'Все типы' || doc.kind === filter
    const displayStatus = doc.statusLabel || doc.status
    const matchesStatus = statusFilter === 'Все статусы' || displayStatus === statusFilter
    const matchesSection = active === 'groups' ? (doc.kind === 'Товарная группа' || doc.area === 'Товарные группы')
      : active === 'processes' ? doc.kind === 'Бизнес-процесс'
      : active === 'knowledge' ? ['Инструкция', 'Внутренний документ'].includes(doc.kind)
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
  }, [currentUser, selectedDoc?.id])

  const pageTitle = active === 'home' ? 'База знаний оператора маркировки'
    : jurisdictions[active]?.label || ({ documents: 'Все документы', groups: 'Товарные группы', processes: 'Бизнес-процессы', knowledge: 'Инструкции и база знаний', monitoring: 'Мониторинг официальных источников', users: 'Управление пользователями' }[active] || 'TEKSHER HUB')

  const openSection = (id) => {
    setActive(id); setSelectedDoc(null); setQuery(''); setFilter('Все типы'); setStatusFilter('Все статусы')
    setActionError(''); setSuccessMessage('')
  }

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
          <div className="sidebar-version">Версия 0.2 · MVP</div>
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
          </> : selectedDoc ? <DocumentDetail doc={selectedDoc} onBack={() => setSelectedDoc(null)}
              onEdit={() => { setEditingDoc(selectedDoc); setShowCreateModal(true) }}
              onDelete={() => handleDeleteDocument(selectedDoc)}
              canEdit={!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)}
              canDelete={!API_ENABLED || currentUser?.role === 'ADMIN'}
              canReview={API_ENABLED && ['ADMIN','EDITOR'].includes(currentUser?.role)}
              files={apiFiles} versions={documentVersions} onDownload={handleDownloadFile} onReview={handleReviewDocument} />
            : active === 'monitoring' ? <MonitorSection monitors={monitors} canManage={['ADMIN','EDITOR'].includes(currentUser?.role)}
                onAdd={() => setMonitorModalOpen(true)} onCheck={handleCheckMonitor} onDelete={handleDeleteMonitor} />
            : active === 'users' ? <UsersSection users={users} onAdd={() => setUserModalOpen(true)} onToggle={handleToggleUser} />
            : <>
            <div className="page-heading">
              <div><div className="section-kicker">БАЗА ЗНАНИЙ / {jurisdictions[active]?.short || 'TEKSHER HUB'}</div><h1>{pageTitle}</h1><p>{jurisdictions[active] ? `Документы и материалы: ${jurisdictions[active].label}. ` : 'Поиск по нормативным актам и рабочим материалам платформы.'}Демонстрационные записи не являются официальной нормативной базой.</p></div>
              <div className="heading-actions"><span className="record-count">{filteredDocuments.length} записей</span>{(!API_ENABLED || ['ADMIN','EDITOR'].includes(currentUser?.role)) && <button className="primary-button" onClick={openNewDocumentModal}><FilePlus2 size={16} /> Добавить запись</button>}</div>
            </div>
            <div className="search-panel">
              <div className="search-input-wrap"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию, номеру или содержанию..." /></div>
              <div className="filter-wrap"><SlidersHorizontal size={16} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>Все типы</option><option>Обзор</option><option>Нормативный акт</option><option>Товарная группа</option><option>Инструкция</option><option>Внутренний документ</option><option>Бизнес-процесс</option></select><ChevronDown size={14} /></div>
              <div className="filter-wrap status-select"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Все статусы</option><option>Демонстрационная запись</option><option>Черновик</option><option>Источник указан</option><option>На проверке</option><option>Действует</option><option>Срок действия истёк</option><option>В архиве</option></select><ChevronDown size={14} /></div>
            </div>
            <div className="notice"><CircleHelp size={17} /><div><b>{API_ENABLED ? 'Единая база документов' : 'Локальный демонстрационный режим'}</b><span>{API_ENABLED ? 'Данные загружаются из PostgreSQL через защищённый API. Перед публикацией проверяйте официальный источник и дату действия.' : 'Карточки сохраняются только в этом браузере. Чтобы включить общую базу, вход по ролям, версии и загрузку файлов, задайте VITE_API_URL после развёртывания backend.'}</span></div></div>
            <div className="document-list">{filteredDocuments.length ? filteredDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} onClick={() => setSelectedDoc(doc)} />) : <div className="empty-state"><Search size={28} /><b>{active === 'groups' ? 'Справочник товарных групп пока пуст' : active === 'processes' ? 'Бизнес-процессы ещё не добавлены' : 'Ничего не найдено'}</b><span>{['groups', 'processes'].includes(active) ? 'Добавь первую карточку через форму. Она сохранится в этом браузере.' : 'Измени поисковый запрос или фильтр.'}</span>{['groups', 'processes'].includes(active) && <button className="secondary-button" onClick={openNewDocumentModal}>Добавить первую запись</button>}</div>}</div>
          </>}
          <footer className="footer"><span>TEKSHER HUB <i>·</i> Информационная платформа оператора маркировки</span><span>Версия 0.3 · 2026</span></footer>
        </div>
      </main>

      {showCreateModal && <CreateDocumentModal initialDoc={editingDoc} onClose={closeDocumentModal} onSubmit={handleSaveDocument} apiEnabled={API_ENABLED} saving={isSaving} error={actionError} />}
      {monitorModalOpen && <MonitorModal onClose={() => setMonitorModalOpen(false)} onSubmit={handleSaveMonitor} saving={isSaving} />}
      {userModalOpen && <UserModal onClose={() => setUserModalOpen(false)} onSubmit={handleSaveUser} saving={isSaving} />}
    </div>
  )
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
    <span className={`doc-status ${doc.isDemo ? 'demo-status' : doc.sourceUrl ? 'source-status' : 'draft-status'}`}>{doc.status}</span><ArrowDownRight size={17} className="doc-arrow" />
  </button>
}

function DocumentDetail({ doc, onBack, onEdit, onDelete }) {
  const jurisdiction = jurisdictions[doc.jurisdiction]
  return <section className="detail-page">
    <button className="back-button" onClick={onBack}>← Назад к списку</button>
    <div className="detail-card">
      <span className={`tag ${jurisdiction.className}`}>{jurisdiction.flag} {jurisdiction.label}</span>
      <div className="detail-icon"><FileCheck2 size={28} /></div>
      <div className="detail-status-row"><span className={`status-pill ${doc.isDemo ? 'demo-status' : doc.sourceUrl ? 'source-status' : 'draft-status'}`}>{doc.status}</span>{doc.isDemo && <span className="detail-muted">Пример интерфейса, не официальный документ</span>}</div>
      <h1>{doc.title}</h1><p>{doc.description}</p>
      {!doc.isDemo && <div className="detail-actions"><button type="button" className="secondary-button" onClick={onEdit}><Pencil size={15} /> Редактировать</button><button type="button" className="danger-button" onClick={onDelete}><Trash2 size={15} /> Удалить карточку</button></div>}
      <div className="detail-meta">
        <div><small>Тип материала</small><b>{doc.kind}</b></div>
        <div><small>Юрисдикция</small><b>{jurisdiction.label}</b></div>
        <div><small>Тематическая область</small><b>{doc.area || 'Не указана'}</b></div>
        <div><small>Номер документа</small><b>{doc.documentNumber || 'Не указан'}</b></div>
        <div><small>Дата документа</small><b>{doc.documentDate ? new Date(doc.documentDate + 'T00:00:00').toLocaleDateString('ru-RU') : 'Не указана'}</b></div>
        <div><small>Запись добавлена</small><b>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('ru-RU') : 'Демо-данные'}</b></div>
      </div>
      {doc.sourceUrl ? <a className="source-link" href={doc.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /><span><b>Открыть источник документа</b><small>{doc.sourceUrl}</small></span><ArrowUpRight size={16} /></a> : <div className="notice"><CircleHelp size={17} /><div><b>{doc.isDemo ? 'Это демонстрационная запись' : 'Официальный источник не указан'}</b><span>{doc.isDemo ? 'Не используйте эту запись как юридическое основание. Вместо неё нужно добавить проверенный документ с официальными реквизитами и ссылкой на источник.' : 'Укажите официальный URL в карточке записи при создании. Редактирование записи и прикрепление файла появятся после подключения серверного хранилища.'}</span></div></div>}
      {!doc.isDemo && <p className="storage-note">Эта пользовательская карточка хранится только в локальном браузере. Она пока не видна другим сотрудникам.</p>}
    </div>
  </section>
}

function CreateDocumentModal({ initialDoc, onClose, onSubmit }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-document-title">
      <header className="modal-header"><div><div className="section-kicker">КАТАЛОГ / НОВАЯ КАРТОЧКА</div><h2 id="create-document-title">{initialDoc ? 'Редактировать карточку' : 'Добавить документ'}</h2><p>Заполните реквизиты и, при наличии, ссылку на официальный источник.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={20} /></button></header>
      <form onSubmit={onSubmit}>
        <label className="form-field full-field"><span>Название документа *</span><input name="title" required maxLength="240" defaultValue={initialDoc?.title || ''} placeholder="Например, постановление или инструкция" /></label>
        <div className="form-grid">
          <label className="form-field"><span>Юрисдикция *</span><select name="jurisdiction" defaultValue={initialDoc?.jurisdiction || 'KG'} required><option value="KG">Кыргызская Республика</option><option value="RU">Российская Федерация</option><option value="EAEU">ЕАЭС</option></select></label>
          <label className="form-field"><span>Тип материала *</span><select name="kind" defaultValue={initialDoc?.kind || 'Нормативный акт'} required><option>Нормативный акт</option><option>Товарная группа</option><option>Инструкция</option><option>Внутренний документ</option><option>Бизнес-процесс</option><option>Обзор</option></select></label>
          <label className="form-field"><span>Номер документа</span><input name="documentNumber" maxLength="100" defaultValue={initialDoc?.documentNumber || ''} placeholder="№ / реквизиты" /></label>
          <label className="form-field"><span>Дата документа</span><span className="date-input"><CalendarDays size={15} /><input name="documentDate" type="date" defaultValue={initialDoc?.documentDate || ''} /></span></label>
          <label className="form-field full-field"><span>Тематическая область *</span><input name="area" required maxLength="120" defaultValue={initialDoc?.area || ''} placeholder="Например, товарные группы, заказ КМ, нанесение" /></label>
          <label className="form-field full-field"><span>Ссылка на официальный источник</span><input name="sourceUrl" type="url" defaultValue={initialDoc?.sourceUrl || ''} placeholder="https://..." /></label>
          <label className="form-field full-field"><span>Краткое описание *</span><textarea name="description" required rows="3" maxLength="1200" defaultValue={initialDoc?.description || ''} placeholder="Что регулирует документ и когда его использовать" /></label>
        </div>
        <div className="form-note"><CircleHelp size={16} /><span>Карточка сохраняется в этом браузере. Загрузка файлов, редактирование и общий доступ появятся после подключения backend.</span></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button type="submit" className="primary-button"><FilePlus2 size={16} /> {initialDoc ? 'Сохранить изменения' : 'Сохранить карточку'}</button></div>
      </form>
    </section>
  </div>
}

export default App
