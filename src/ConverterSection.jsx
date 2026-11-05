import { ArrowUpRight, FileSpreadsheet } from 'lucide-react'
import './ConverterSection.css'

const CONVERTER_URL = 'https://main.teksher.kg/converter/'

export default function ConverterSection() {
  return (
    <section className="converter-page" aria-label="Конвертер кодов маркировки">
      <div className="page-heading converter-page-heading">
        <div>
          <div className="section-kicker">ИНСТРУМЕНТЫ ОПЕРАТОРА</div>
          <h1>Конвертер кодов</h1>
          <p>
            Преобразование файлов CSV с кодами маркировки для дальнейшей работы
            с товарными группами и упаковками.
          </p>
        </div>
        <a
          className="secondary-button"
          href={CONVERTER_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть отдельно <ArrowUpRight size={15} />
        </a>
      </div>

      <div className="converter-service-note">
        <div className="converter-service-note-main">
          <FileSpreadsheet size={21} />
          <div>
            <strong>Действующий конвертер Текшер</strong>
            <span>
              Доступны обрезка криптохвоста, удаление и добавление кавычек.
              Поддерживаются форматы CSV и XLSX.
            </span>
          </div>
        </div>
        <span className="converter-service-limit">До 150 000 КМ в файле</span>
      </div>

      <div className="converter-embed-shell">
        <iframe
          className="converter-embed-frame"
          src={CONVERTER_URL}
          title="Конвертер CSV-файлов Текшер"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <p className="converter-embed-fallback">
        При проблемах с отображением откройте сервис в отдельной вкладке:{' '}
        <a href={CONVERTER_URL} target="_blank" rel="noopener noreferrer">
          main.teksher.kg/converter
        </a>.
      </p>
    </section>
  )
}
