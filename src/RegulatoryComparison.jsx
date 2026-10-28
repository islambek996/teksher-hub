import { useMemo, useState } from 'react'
import {
  ArrowLeftRight, ArrowUpRight, BookOpen, CheckCircle2, ExternalLink,
  FileText, Filter, Globe2, Landmark, Search, ShieldCheck, Sparkles, Scale
} from 'lucide-react'

const regions = [
  { code: 'KG', short: 'КР', title: 'Кыргызская Республика', icon: ShieldCheck },
  { code: 'RU', short: 'РФ', title: 'Российская Федерация', icon: Landmark },
  { code: 'EAEU', short: 'ЕАЭС', title: 'Евразийский экономический союз', icon: Globe2 },
]

const sourceCards = [
  {
    region: 'KG',
    title: 'Централизованный банк данных правовой информации КР',
    description: 'Официальная база нормативных правовых актов. Проверяйте актуальную редакцию, изменения и дату вступления в силу.',
    label: 'Официальная правовая база',
    url: 'https://cbd.minjust.gov.kg/',
  },
  {
    region: 'KG',
    title: 'Постановление Кабинета Министров КР № 570 от 18.10.2022',
    description: 'Положение о маркировке товаров в Кыргызской Республике и перечни отдельных товаров. Проверьте последующие изменения.',
    label: 'Базовый документ',
    url: 'https://cbd.minjust.gov.kg/159504/edition/1192170/ru',
  },
  {
    region: 'KG',
    title: 'Постановление Кабинета Министров КР № 385 от 01.07.2025',
    description: 'Отдельный режим учётно-контрольных марок для предусмотренных перечнем товаров. Проверяйте актуальную редакцию, изменения и перечень применимости.',
    label: 'Проверить отдельный режим',
    url: 'https://cbd.minjust.gov.kg/',
  },
  {
    region: 'KG',
    title: 'Официальный портал Кабинета Министров КР',
    description: 'Публикации и нормативные правовые акты. Используйте для поиска новых решений и постановлений.',
    label: 'Официальный портал',
    url: 'https://www.gov.kg/ru/npa/',
  },
  {
    region: 'RU',
    title: 'Официальный интернет-портал правовой информации',
    description: 'Источник официального опубликования нормативных правовых актов Российской Федерации.',
    label: 'Официальная правовая база',
    url: 'https://publication.pravo.gov.ru/',
  },
  {
    region: 'RU',
    title: 'Постановление Правительства РФ от 26.04.2019 № 515',
    description: 'Базовый акт о системе маркировки средствами идентификации. По официальному порталу найдите исходную публикацию и последующие изменяющие акты; специальные правила товарных групп проверяются отдельно.',
    label: 'Нормативный акт · проверить редакцию',
    url: 'https://publication.pravo.gov.ru/search',
  },
  {
    region: 'RU',
    title: 'Честный ЗНАК – раздел для бизнеса',
    description: 'Информация оператора о товарных группах, подключении, кодах, документах и работе в системе. Юридические требования сверяйте с НПА.',
    label: 'Информация оператора',
    url: 'https://честныйзнак.рф/business/',
  },
  {
    region: 'EAEU',
    title: 'Правовой портал ЕАЭС',
    description: 'Официальный поиск документов Евразийского экономического союза, включая решения Совета ЕЭК по отдельным товарным группам.',
    label: 'Официальная правовая база',
    url: 'https://docs.eaeunion.org/',
  },
  {
    region: 'EAEU',
    title: 'Соглашение ЕАЭС о маркировке от 02.02.2018',
    description: 'Рамочная правовая основа маркировки средствами идентификации в Союзе. Найдите соглашение по полному названию в официальном правовом портале и проверьте связанные решения Совета ЕЭК.',
    label: 'Наднациональный акт · проверить редакцию',
    url: 'https://docs.eaeunion.org/',
  },
  {
    region: 'EAEU',
    title: 'Евразийская экономическая комиссия',
    description: 'Официальные материалы и разъяснения по интеграционным вопросам и маркировке средствами идентификации.',
    label: 'Официальный сайт ЕЭК',
    url: 'https://eec.eaeunion.org/',
  },
]

const comparisonRows = [
  {
    area: 'Правовая основа',
    keywords: 'закон постановление положение соглашение нормативный акт',
    KG: 'Национальные акты КР определяют внутренние правила и перечни товаров. В числе базовых документов – постановление КМ КР № 570 от 18.10.2022; по отдельным товарам могут действовать иные режимы.',
    RU: 'Общие правила установлены постановлением Правительства РФ № 515 от 26.04.2019. Для отдельных товарных групп применяются специальные правила и отдельные акты.',
    EAEU: 'Соглашение о маркировке товаров средствами идентификации от 02.02.2018 задаёт рамочную основу. По отдельным категориям принимаются решения Совета ЕЭК.',
  },
  {
    area: 'Определение обязательности',
    keywords: 'перечень товарная группа код ТН ВЭД ОКПД2 сроки остатки',
    KG: 'Необходимо сверять действующий национальный перечень, код ТН ВЭД ЕАЭС, описание товара и сроки по конкретной категории. Нельзя делать вывод только по бытовому названию товара.',
    RU: 'Проверяйте действующие правила конкретной товарной группы, коды ТН ВЭД ЕАЭС/ОКПД2, исключения, сроки запуска и переходные положения.',
    EAEU: 'Для решения ЕЭК проверьте включённые коды ТН ВЭД ЕАЭС, описание товарной позиции, характеристики продукции и условия применения решения.',
  },
  {
    area: 'Идентификатор и нанесение',
    keywords: 'DataMatrix GS1 код маркировки этикетка идентификация упаковка',
    KG: 'Формат средства идентификации, место нанесения и порядок получения кода устанавливаются применимыми национальными актами и правилами конкретной группы. Отдельно проверяйте, не относится ли товар к режиму учётно-контрольных марок.',
    RU: 'Для каждой товарной группы проверяйте требования к коду, маркировочному носителю, сериализации, упаковке, агрегированию и моменту нанесения. Общий порядок не заменяет специальное правило.',
    EAEU: 'Соглашение предусматривает унифицированный подход, но характеристики кода, способ генерации и нанесения конкретизируются решениями ЕЭК по отдельным категориям.',
  },
  {
    area: 'Оборот и передача сведений',
    keywords: 'ввод в оборот продажа перемещение вывод оборот электронный документ отчёт',
    KG: 'Состав и сроки передачи сведений определяются национальным порядком и процедурами ГАИС МТ для применимой категории. Перед операцией сверяйте актуальную инструкцию системы.',
    RU: 'Сведения об обороте передаются в государственную информационную систему в порядке, установленном общими и специальными правилами маркировки. Набор событий зависит от товарной группы.',
    EAEU: 'Документы ЕАЭС предусматривают обмен сведениями между государствами-членами, но сценарий для товара проверяется по решению ЕЭК и действующим национальным процедурам.',
  },
  {
    area: 'Импорт и трансграничные операции',
    keywords: 'импорт ввоз экспорт трансграничный перемещение ЕАЭС страна происхождения',
    KG: 'Для ввоза проверяйте национальные требования КР, применимый перечень, сроки для остатков и обязанности импортёра. Сам факт маркировки в другой стране не подтверждает автоматическое выполнение всех требований КР.',
    RU: 'При ввозе проверяйте специальное правило по товарной группе, сценарий происхождения товара и момент передачи сведений. Учитывайте отдельные положения для импорта из стран ЕАЭС.',
    EAEU: 'Единая рамка ЕАЭС не означает, что все национальные процедуры и даты одинаковы. Уточните, принято ли решение по категории и какие правила действуют в стране назначения.',
  },
  {
    area: 'Сроки и остатки',
    keywords: 'дата вступления в силу переходный период остатки запрещено реализация срок',
    KG: 'Сроки, допустимость оборота остатков и запрет реализации немаркированной продукции следует брать из действующей редакции постановления и приложений по конкретной группе.',
    RU: 'Переходные периоды и правила для остатков могут различаться по группам и редакциям актов. Проверяйте даты публикации, вступления в силу и конкретные переходные пункты.',
    EAEU: 'Решение ЕЭК может устанавливать рамочные сроки и условия, а фактическая дата запуска может зависеть от национального решения государства-члена.',
  },
]

const promptTemplates = [
  {
    title: 'Проверить товарную группу',
    description: 'Найти обязательность, сроки и коды по официальным источникам',
    prompt: 'Проверь обязательность маркировки для товарной группы [указать товар и код ТН ВЭД ЕАЭС] отдельно для Кыргызской Республики, Российской Федерации и ЕАЭС. Используй только найденные официальные или явно помеченные справочные источники, укажи номера актов, даты, ссылки, сроки и исключения. Если данных недостаточно, прямо укажи это.',
  },
  {
    title: 'Сравнить импорт КР и РФ',
    description: 'Разделить национальные и наднациональные требования',
    prompt: 'Сравни требования к маркировке при импорте товара [указать товар, код ТН ВЭД ЕАЭС, страна происхождения] в Кыргызскую Республику и Российскую Федерацию. Раздели нормы ЕАЭС и национальные правила. Для каждого вывода укажи подтверждающий источник и его статус; не делай выводов без найденного текста.',
  },
  {
    title: 'Проверить изменение НПА',
    description: 'Найти новую редакцию и последствия для работы',
    prompt: 'Проверь, есть ли в доступных официальных источниках более новая редакция или изменение нормативного акта [название, номер, дата]. Сравни только подтверждённые изменения, перечисли затронутые пункты и возможное влияние на маркировку. Отдели подтверждённые факты от предположений и укажи ссылки на первоисточники.',
  },
  {
    title: 'Разграничить системы маркировки',
    description: 'Проверить DataMatrix и учётно-контрольные марки',
    prompt: 'Объясни на основании официальных нормативных источников, какой режим маркировки применяется к товару [указать товар и код]: средство идентификации/DataMatrix, учётно-контрольная марка или иной режим. Отдельно проверь правила Кыргызской Республики, РФ и применимые акты ЕАЭС; не считай эти режимы взаимозаменяемыми без прямого подтверждения.',
  },
]

function regionName(code) {
  return regions.find(region => region.code === code)?.short || code
}

export default function RegulatoryComparison({ onAskAI = () => {} }) {
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [sourceRegion, setSourceRegion] = useState('ALL')
  const [showSources, setShowSources] = useState(true)

  const filteredRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('ru-RU')
    return comparisonRows.filter(row => {
      const regionTexts = regionFilter === 'ALL' ? [row.KG, row.RU, row.EAEU] : [row[regionFilter]]
      return (!term || [row.area, row.keywords, ...regionTexts].join(' ').toLocaleLowerCase('ru-RU').includes(term))
    })
  }, [regionFilter, query])

  const filteredSources = useMemo(() => sourceCards.filter(source =>
    (sourceRegion === 'ALL' || source.region === sourceRegion)
    && (!query.trim() || [source.title, source.description, source.label, source.region].join(' ').toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')))
  ), [sourceRegion, query])

  const visibleRegions = regionFilter === 'ALL' ? regions : regions.filter(region => region.code === regionFilter)

  return (
    <section className="reg-comparison management-page">
      <div className="page-heading reg-comparison-heading">
        <div>
          <div className="section-kicker">СПРАВОЧНИК / НОРМАТИВНЫЕ ТРЕБОВАНИЯ</div>
          <h1>Сравнение требований КР, РФ и ЕАЭС</h1>
          <p>Единая навигация по нормативной базе: сравнивайте подходы, переходите к первоисточникам и запускайте поиск по конкретной товарной группе.</p>
        </div>
        <span className="reg-comparison-heading-icon"><ArrowLeftRight size={23}/></span>
      </div>

      <div className="reg-comparison-notice">
        <ShieldCheck size={19}/>
        <div>
          <strong>Правила могут различаться по товарным группам</strong>
          <span>Это навигационная сравнительная сводка, а не юридическое заключение. Перед операцией проверяйте действующую редакцию акта, код ТН ВЭД ЕАЭС, описание товара, дату вступления в силу и переходные положения в официальном первоисточнике.</span>
        </div>
      </div>

      <div className="reg-comparison-region-grid">
        {regions.map(region => {
          const Icon = region.icon
          return (
            <button type="button" className={'reg-region-card region-' + region.code.toLowerCase() + (regionFilter === region.code ? ' is-selected' : '')} key={region.code} onClick={() => setRegionFilter(regionFilter === region.code ? 'ALL' : region.code)}>
              <span className="reg-region-icon"><Icon size={19}/></span>
              <span className="reg-region-copy"><strong>{region.short}</strong><small>{region.title}</small></span>
              <span className="reg-region-check">{regionFilter === region.code ? <CheckCircle2 size={17}/> : <ArrowUpRight size={16}/>}</span>
            </button>
          )
        })}
      </div>

      <div className="reg-comparison-filterbar">
        <label className="reg-comparison-search">
          <Search size={17}/>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск: DataMatrix, остатки, импорт, срок, товарная группа…"/>
        </label>
        <label className="reg-comparison-select">
          <Filter size={15}/>
          <select value={regionFilter} onChange={event => setRegionFilter(event.target.value)} aria-label="Фильтр по юрисдикции">
            <option value="ALL">Все юрисдикции</option>
            <option value="KG">Кыргызская Республика</option>
            <option value="RU">Российская Федерация</option>
            <option value="EAEU">ЕАЭС</option>
          </select>
        </label>
      </div>

      <div className="reg-comparison-section-title">
        <div><span className="section-kicker">СРАВНИТЕЛЬНАЯ МАТРИЦА</span><h2>Ключевые различия</h2><p>Выберите юрисдикцию или ищите по теме, чтобы сузить сравнение.</p></div>
        <span className="reg-result-count">{filteredRows.length} тем</span>
      </div>

      <div className="reg-comparison-matrix">
        {filteredRows.map((row, index) => (
          <article className="reg-matrix-row" key={row.area}>
            <div className="reg-matrix-area"><span>{String(index + 1).padStart(2, '0')}</span><h3>{row.area}</h3></div>
            <div className={'reg-matrix-cells columns-' + visibleRegions.length}>
              {visibleRegions.map(region => (
                <div className={'reg-matrix-cell region-' + region.code.toLowerCase()} key={region.code}>
                  <div className="reg-matrix-cell-title"><span>{region.short}</span><strong>{region.title}</strong></div>
                  <p>{row[region.code]}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
        {!filteredRows.length && <div className="empty-state"><Search size={23}/><b>По этому запросу ничего не найдено</b><span>Измените формулировку или сбросьте фильтр юрисдикции.</span><button className="secondary-button" type="button" onClick={() => { setQuery(''); setRegionFilter('ALL') }}>Сбросить фильтры</button></div>}
      </div>

      <div className="reg-comparison-section-title reg-source-heading">
        <div><span className="section-kicker">ПЕРВОИСТОЧНИКИ</span><h2>Официальные нормативные ресурсы</h2><p>Открывайте источники, чтобы проверить действующий текст и последние изменения.</p></div>
        <button type="button" className="secondary-button" onClick={() => setShowSources(open => !open)}>{showSources ? 'Скрыть источники' : 'Показать источники'}</button>
      </div>

      {showSources && <>
        <div className="reg-source-filter">
          {[
            ['ALL', 'Все источники'],
            ['KG', 'КР'],
            ['RU', 'РФ'],
            ['EAEU', 'ЕАЭС'],
          ].map(([code, label]) => <button type="button" key={code} className={sourceRegion === code ? 'is-active' : ''} onClick={() => setSourceRegion(code)}>{label}</button>)}
        </div>
        <div className="reg-source-grid">
          {filteredSources.map(source => (
            <article className="reg-source-card" key={source.title}>
              <div className="reg-source-card-top"><span className={'reg-source-region region-' + source.region.toLowerCase()}>{regionName(source.region)}</span><span className="reg-source-label"><FileText size={12}/>{source.label}</span></div>
              <h3>{source.title}</h3>
              <p>{source.description}</p>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{'Открыть источник'} <ExternalLink size={14}/></a>
            </article>
          ))}
        </div>
      </>}

      <div className="reg-comparison-section-title reg-ai-heading">
        <div><span className="section-kicker">TEKSHER AI / ПРАКТИЧЕСКИЕ СЦЕНАРИИ</span><h2>Задачи для умного поиска</h2><p>Запустите поиск с уже подготовленным запросом. ИИ должен приводить источники и сообщать, если доказательств недостаточно.</p></div>
        <Sparkles size={21}/>
      </div>
      <div className="reg-ai-prompt-grid">
        {promptTemplates.map(template => (
          <button type="button" className="reg-ai-prompt-card" key={template.title} onClick={() => onAskAI(template.prompt)}>
            <span><BookOpen size={17}/></span>
            <strong>{template.title}</strong>
            <small>{template.description}</small>
            <em>Открыть в ИИ-помощнике <ArrowUpRight size={13}/></em>
          </button>
        ))}
      </div>

      <div className="reg-comparison-footer-note"><CheckCircle2 size={16}/><span>Мониторинг официальных страниц фиксирует изменение содержимого источника. Это сигнал для специалиста, но не автоматический вывод об изменении правовой силы акта. Отдельно проверяйте, опубликован ли новый акт, вступил ли он в силу и относится ли он к нужной товарной группе.</span></div>
    </section>
  )
}
