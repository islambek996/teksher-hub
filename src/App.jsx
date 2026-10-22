import { useMemo, useState } from 'react'
import {
  Archive, ArrowDownRight, ArrowUpRight, BookOpen, Boxes, ChevronDown,
  CircleHelp, Clock3, ExternalLink, FileCheck2, FileText, Globe2, Home,
  Landmark, Layers3, LibraryBig, Link2, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Tag, Workflow
} from 'lucide-react'

const documents = [
  { id: 1, title: 'Нормативная база маркировки товаров в Российской Федерации', kind: 'Обзор', jurisdiction: 'RU', area: 'МЗКМ', description: 'Подборка основных нормативных документов РФ и материалов системы «Честный ЗНАК».', status: 'Демонстрационная запись' },
  { id: 2, title: 'Нормативные документы Кыргызской Республики по маркировке', kind: 'Обзор', jurisdiction: 'KG', area: 'ГАИС МТ', description: 'Раздел для законов, постановлений и положений, регулирующих национальную систему маркировки.', status: 'Демонстрационная запись' },
  { id: 3, title: 'Наднациональные документы ЕАЭС', kind: 'Обзор', jurisdiction: 'EAEU', area: 'Общие процессы', description: 'Соглашения и решения ЕАЭС, применимые к маркировке и трансграничному взаимодействию.', status: 'Демонстрационная запись' },
  { id: 4, title: 'Инструкция по работе с карточками товаров в МЗКМ', kind: 'Инструкция', jurisdiction: 'RU', area: 'Карточки товаров', description: 'Место для проверенных инструкций, связанных с внешним контуром МЗКМ.', status: 'Демонстрационная запись' },
  { id: 5, title: 'Порядок работы с ГАИС МТ', kind: 'Внутренний документ', jurisdiction: 'KG', area: 'ГАИС МТ', description: 'Место для внутренних регламентов и инструкций национальной системы.', status: 'Демонстрационная запись' },
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
]

function App() {
  const [active, setActive] = useState('home')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Все типы')
  const [selectedDoc, setSelectedDoc] = useState(null)

  const filteredDocuments = useMemo(() => documents.filter((doc) => {
    const matchesJurisdiction = ['RU', 'KG', 'EAEU'].includes(active) ? doc.jurisdiction === active : true
    const matchesQuery = [doc.title, doc.description, doc.area, doc.kind].join(' ').toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'Все типы' || doc.kind === filter
    return matchesJurisdiction && matchesQuery && matchesFilter
  }), [active, query, filter])

  const pageTitle = active === 'home' ? 'База знаний оператора маркировки'
    : jurisdictions[active]?.label || ({ documents: 'Все документы', groups: 'Товарные группы', processes: 'Бизнес-процессы', knowledge: 'Инструкции и база знаний' }[active] || 'TEKSHER HUB')

  const openSection = (id) => { setActive(id); setSelectedDoc(null) }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => openSection('home')} aria-label="На главную">
          <span className="brand-mark">T</span>
          <span className="brand-copy"><strong>TEKSHER<span>HUB</span></strong><small>KNOWLEDGE PLATFORM</small></span>
        </button>
        <div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        {navGroups.map((group) => <div className="nav-group" key={group.title}>
          <div className="nav-heading">{group.title}</div>
          {group.items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => openSection(id)}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{active === id && <span className="active-dot" />}
          </button>)}
        </div>)}
        <div className="sidebar-bottom">
          <div className="status-indicator"><span /> Платформа в разработке</div>
          <div className="sidebar-version">Версия 0.1 · MVP</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>TEKSHER HUB</span><span className="crumb-slash">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-right"><span className="internal-badge"><ShieldCheck size={14} /> Внутренний портал</span><div className="avatar">ОП</div></div>
        </header>

        <div className="page-content">
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
              <a className="system-card" href="https://main.teksher.kg" target="_blank" rel="noreferrer"><span className="system-icon green"><Link2 size={20} /></span><span className="system-copy"><b>ГАИС МТ</b><small>Внутренний контур · КР</small></span><ArrowUpRight size={17} className="system-arrow" /></a>
            </section>
          </> : selectedDoc ? <DocumentDetail doc={selectedDoc} onBack={() => setSelectedDoc(null)} /> : <>
            <div className="page-heading"><div><div className="section-kicker">БАЗА ЗНАНИЙ / {jurisdictions[active]?.short || 'TEKSHER HUB'}</div><h1>{pageTitle}</h1><p>{jurisdictions[active] ? `Документы и материалы: ${jurisdictions[active].label}. ` : 'Поиск по нормативным актам и рабочим материалам платформы.'}Демонстрационные записи пока не являются официальной нормативной базой.</p></div><span className="record-count">{filteredDocuments.length} записей</span></div>
            <div className="search-panel">
              <div className="search-input-wrap"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию, номеру или содержанию..." /></div>
              <div className="filter-wrap"><SlidersHorizontal size={16} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>Все типы</option><option>Обзор</option><option>Инструкция</option><option>Внутренний документ</option></select><ChevronDown size={14} /></div>
            </div>
            <div className="notice"><CircleHelp size={17} /><div><b>Демонстрационный каталог</b><span>Реальные нормативные документы будут добавлены после настройки хранилища и проверки официальных источников.</span></div></div>
            <div className="document-list">{filteredDocuments.length ? filteredDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} onClick={() => setSelectedDoc(doc)} />) : <div className="empty-state"><Search size={28} /><b>Ничего не найдено</b><span>Измени поисковый запрос или фильтр.</span></div>}</div>
          </>}
          <footer className="footer"><span>TEKSHER HUB <i>·</i> Информационная платформа оператора маркировки</span><span>Первая версия · 2026</span></footer>
        </div>
      </main>
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
    <span className="doc-main"><b>{doc.title}</b><span>{doc.description}</span><small><span className={`tag ${jurisdiction.className}`}>{jurisdiction.short}</span><span>{doc.kind}</span><span>·</span><span>{doc.area}</span></small></span>
    <span className="doc-status">{doc.status}</span><ArrowDownRight size={17} className="doc-arrow" />
  </button>
}

function DocumentDetail({ doc, onBack }) {
  const jurisdiction = jurisdictions[doc.jurisdiction]
  return <section className="detail-page">
    <button className="back-button" onClick={onBack}>← Назад к списку</button>
    <div className="detail-card">
      <span className={`tag ${jurisdiction.className}`}>{jurisdiction.flag} {jurisdiction.label}</span>
      <div className="detail-icon"><FileCheck2 size={28} /></div>
      <h1>{doc.title}</h1><p>{doc.description}</p>
      <div className="detail-meta"><div><small>Тип материала</small><b>{doc.kind}</b></div><div><small>Область</small><b>{doc.area}</b></div><div><small>Статус записи</small><b>{doc.status}</b></div></div>
      <div className="notice"><CircleHelp size={17} /><div><b>Это демонстрационная запись</b><span>Здесь будут реквизиты документа, официальный источник, файл, статус действия, редакции и связанные акты. Не используйте эту запись как юридическое основание.</span></div></div>
    </div>
  </section>
}

export default App
