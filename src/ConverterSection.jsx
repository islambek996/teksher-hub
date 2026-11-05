import { useRef, useState } from 'react'
import {
  AlertCircle, ArrowDownToLine, CheckCircle2, FileSpreadsheet, FileText,
  Info, LoaderCircle, ShieldCheck, Upload, X,
} from 'lucide-react'
import {
  convertCsv, converterModes, createOutputBlob, outputFileName,
  packagingTypes, productGroups,
} from './lib/marking-converter.js'
import './ConverterSection.css'

export default function ConverterSection() {
  const inputRef = useRef(null)
  const [mode, setMode] = useState('trim')
  const [group, setGroup] = useState('')
  const [packaging, setPackaging] = useState('')
  const [file, setFile] = useState(null)
  const [format, setFormat] = useState('csv')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloadName, setDownloadName] = useState('')

  const releaseDownload = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setDownloadUrl('')
    setDownloadName('')
  }

  const resetResult = () => {
    setResult(null)
    setError('')
    releaseDownload()
    setProgress(0)
  }

  const selectFile = selected => {
    const nextFile = selected?.[0]
    if (!nextFile) return
    resetResult()
    if (!/\.csv$/i.test(nextFile.name)) {
      setFile(null)
      setError('Загрузите файл с расширением .csv.')
      return
    }
    setFile(nextFile)
    setError('')
  }

  const handleConvert = async () => {
    if (!file || !group || !packaging) {
      setError('Выберите товарную группу, тип упаковки и CSV-файл.')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    releaseDownload()
    setProgress(0)
    try {
      const input = await file.text()
      const converted = await convertCsv({
        input,
        mode,
        group,
        packaging,
        onProgress: setProgress,
      })
      if (!converted.ok) {
        setResult(converted)
        setError(converted.tooManyErrors
          ? 'Обнаружено более 50 ошибочных кодов. Конвертация остановлена. Исправьте исходный файл и повторите попытку.'
          : 'В файле обнаружены ошибки. Конвертация не выполнена.')
        return
      }

      const outputFormat = mode === 'trim' ? format : 'csv'
      const blob = createOutputBlob(converted, outputFormat)
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setDownloadName(outputFileName(file.name, mode, outputFormat))
      setResult({ ...converted, format: outputFormat })
      setProgress(100)
    } catch (exception) {
      setError(exception?.message || 'Не удалось обработать файл. Проверьте CSV и повторите попытку.')
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (!downloadUrl || !downloadName) return
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = downloadName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const modeDescription = converterModes.find(item => item.id === mode)?.description

  return (
    <section className="converter-page" aria-label="Конвертер кодов маркировки">
      <div className="page-heading converter-page-heading">
        <div>
          <div className="section-kicker">ИНСТРУМЕНТЫ ОПЕРАТОРА</div>
          <h1>Конвертер кодов</h1>
          <p>Локальная обработка CSV-файлов с проверкой структуры кодов маркировки. Файлы не отправляются на сторонний сервис.</p>
        </div>
        <div className="converter-secure-label"><ShieldCheck size={16} /> Обработка в браузере</div>
      </div>

      <div className="converter-info-strip">
        <Info size={18} />
        <div><strong>До 150 000 кодов в одном файле</strong><span>Поддерживаются алкогольная, табачная и пивная продукция, единичная и групповая упаковка.</span></div>
      </div>

      <div className="converter-workspace">
        <div className="converter-section-heading">
          <span className="converter-step">01</span>
          <div><h2>Выберите операцию</h2><p>Укажите, что необходимо сделать с кодами маркировки.</p></div>
        </div>
        <div className="converter-mode-grid">
          {converterModes.map(item => (
            <button
              type="button"
              className={'converter-mode-card' + (mode === item.id ? ' selected' : '')}
              key={item.id}
              onClick={() => { setMode(item.id); resetResult(); if (item.id !== 'trim') setFormat('csv') }}
              aria-pressed={mode === item.id}
            >
              <span className="converter-mode-check">{mode === item.id ? <CheckCircle2 size={17} /> : <span />}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        <div className="converter-divider" />

        <div className="converter-section-heading">
          <span className="converter-step">02</span>
          <div><h2>Параметры кодов</h2><p>Проверка выполняется по структуре выбранной товарной группы и упаковки.</p></div>
        </div>
        <div className="converter-fields-grid">
          <label className="converter-field">
            <span>Товарная группа <b>*</b></span>
            <select value={group} onChange={event => { setGroup(event.target.value); resetResult() }}>
              <option value="">Выберите товарную группу</option>
              {productGroups.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="converter-field">
            <span>Тип упаковки <b>*</b></span>
            <select value={packaging} onChange={event => { setPackaging(event.target.value); resetResult() }}>
              <option value="">Выберите тип упаковки</option>
              {packagingTypes.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select>
          </label>
          {mode === 'trim' && (
            <label className="converter-field">
              <span>Формат выгружаемого файла <b>*</b></span>
              <select value={format} onChange={event => setFormat(event.target.value)}>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX (Microsoft Excel)</option>
              </select>
            </label>
          )}
        </div>

        <div className="converter-divider" />

        <div className="converter-section-heading">
          <span className="converter-step">03</span>
          <div><h2>Загрузите CSV-файл</h2><p>Файл должен содержать коды маркировки. Столбец с кодами определяется автоматически.</p></div>
        </div>
        <input
          ref={inputRef}
          className="converter-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={event => { selectFile(event.target.files); event.target.value = '' }}
        />
        <button
          type="button"
          className={'converter-dropzone' + (file ? ' has-file' : '')}
          onClick={() => inputRef.current?.click()}
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files) }}
        >
          <span className="converter-upload-icon">{file ? <FileSpreadsheet size={25} /> : <Upload size={25} />}</span>
          {file ? (
            <span className="converter-file-copy"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} МБ · Файл готов к обработке</small></span>
          ) : (
            <span className="converter-file-copy"><strong>Перетащите CSV-файл сюда</strong><small>или нажмите, чтобы выбрать файл на компьютере · формат CSV · до 150 000 кодов</small></span>
          )}
          {file && <span className="converter-file-change">Изменить файл</span>}
        </button>
        {file && <button type="button" className="converter-remove-file" onClick={() => { setFile(null); resetResult() }}><X size={13} /> Удалить выбранный файл</button>}

        {error && (
          <div className="converter-alert converter-alert-error" role="alert">
            <AlertCircle size={18} /><span>{error}</span>
          </div>
        )}

        {busy && (
          <div className="converter-progress" role="status" aria-live="polite">
            <div><LoaderCircle size={16} className="converter-spinner" /><span>Проверка и обработка кодов…</span><b>{progress}%</b></div>
            <span className="converter-progress-track"><i style={{ width: progress + '%' }} /></span>
          </div>
        )}

        {result && !result.ok && (
          <div className="converter-validation">
            <div className="converter-validation-heading"><AlertCircle size={18} /><strong>Найдены некорректные коды: {result.errors.length}{result.tooManyErrors ? '+' : ''}</strong></div>
            <p>Указаны номера строк CSV-файла. Исправьте коды и загрузите документ повторно.</p>
            <div className="converter-error-table-wrap">
              <table className="converter-error-table">
                <thead><tr><th>Строка</th><th>Содержимое</th><th>Причина</th></tr></thead>
                <tbody>{result.errors.map((item, index) => <tr key={item.line + '-' + index}><td>{item.line}</td><td><code>{item.code}</code></td><td>{item.reason}</td></tr>)}</tbody>
              </table>
            </div>
            <small>Система прекращает конвертацию при обнаружении более 50 ошибок.</small>
          </div>
        )}

        {result?.ok && (
          <div className="converter-alert converter-alert-success" role="status">
            <CheckCircle2 size={19} />
            <div><strong>Конвертация успешно завершена</strong><span>Проверено кодов: {result.count.toLocaleString('ru-RU')} · Формат: {result.format.toUpperCase()}</span></div>
          </div>
        )}

        <div className="converter-actions">
          <button
            type="button"
            className="primary-button converter-run-button"
            onClick={handleConvert}
            disabled={!file || !group || !packaging || busy}
          >
            {busy ? <LoaderCircle size={17} className="converter-spinner" /> : <FileText size={17} />}
            {busy ? 'Обработка…' : 'Конвертировать'}
          </button>
          {result?.ok && (
            <button type="button" className="secondary-button converter-download-button" onClick={download}>
              <ArrowDownToLine size={17} /> Скачать {downloadName}
            </button>
          )}
        </div>
      </div>

      <div className="converter-rules-note">
        <Info size={16} />
        <span>{modeDescription} Каждый непустой код проверяется отдельно. При ошибках готовый файл не формируется.</span>
      </div>
    </section>
  )
}
