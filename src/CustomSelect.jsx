import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import './CustomSelect.css'

function nodeText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement(node)) return nodeText(node.props.children)
  return ''
}

function normalizeValues(value, multiple) {
  if (multiple) return Array.isArray(value) ? value.map(item => String(item)) : []
  return [String(value ?? '')]
}

export default function CustomSelect({
  children,
  value,
  defaultValue,
  onChange,
  name,
  id,
  className = '',
  disabled = false,
  required = false,
  multiple = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  title,
  style,
}) {
  const generatedId = useId()
  const listboxId = 'hub-select-list-' + generatedId.replace(/:/g, '')
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState(null)
  const [query, setQuery] = useState('')
  const controlled = value !== undefined
  const [internalValue, setInternalValue] = useState(() => (
    normalizeValues(defaultValue !== undefined ? defaultValue : value, multiple)
  ))

  const options = useMemo(() => Children.toArray(children)
    .filter(child => isValidElement(child) && child.type === 'option')
    .map((child, index) => {
      const label = nodeText(child.props.children).trim()
      const optionValue = child.props.value !== undefined ? String(child.props.value) : label
      return {
        key: child.key ?? optionValue + '-' + index,
        value: optionValue,
        label,
        disabled: Boolean(child.props.disabled),
      }
    }), [children])

  const selectedValues = controlled
    ? normalizeValues(value, multiple)
    : internalValue
  const selectedValue = selectedValues[0] ?? ''
  const selected = options.find(option => option.value === selectedValue)
  const selectedOptions = options.filter(option => selectedValues.includes(option.value))
  const filteredOptions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('ru-RU')
    return term
      ? options.filter(option => option.label.toLocaleLowerCase('ru-RU').includes(term))
      : options
  }, [options, query])
  const enabledIndexes = filteredOptions
    .map((option, index) => option.disabled ? -1 : index)
    .filter(index => index >= 0)

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const estimatedHeight = Math.min(330, Math.max(56, Math.min(options.length, 7) * 42 + (options.length > 8 ? 52 : 10)))
    const openAbove = window.innerHeight - rect.bottom < estimatedHeight + 14 && rect.top > estimatedHeight + 14
    const width = Math.min(Math.max(rect.width, 210), window.innerWidth - 24)
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
    const available = openAbove ? rect.top - 18 : window.innerHeight - rect.bottom - 18
    setPosition({
      top: openAbove ? 'auto' : rect.bottom + 6,
      bottom: openAbove ? window.innerHeight - rect.top + 6 : 'auto',
      left,
      width,
      maxHeight: Math.max(150, Math.min(330, available)),
    })
  }

  useEffect(() => {
    if (!open) return undefined
    updatePosition()
    const onPointerDown = event => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
      setQuery('')
    }
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open || !menuRef.current) return
    menuRef.current.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, query])

  const moveActive = delta => {
    if (!enabledIndexes.length) return
    const currentIndex = enabledIndexes.indexOf(activeIndex)
    const nextIndex = currentIndex < 0
      ? enabledIndexes[0]
      : enabledIndexes[(currentIndex + delta + enabledIndexes.length) % enabledIndexes.length]
    setActiveIndex(nextIndex)
  }

  const choose = option => {
    if (!option || option.disabled) return
    if (multiple) {
      const next = selectedValues.includes(option.value)
        ? selectedValues.filter(item => item !== option.value)
        : [...selectedValues, option.value]
      if (!controlled) setInternalValue(next)
      onChange?.({
        target: { value: next, name },
        currentTarget: { value: next, name },
      })
      return
    }

    if (!controlled) setInternalValue([option.value])
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name },
    })
    setOpen(false)
    setQuery('')
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const openMenu = () => {
    if (disabled) return
    setQuery('')
    const currentIndex = filteredOptions.findIndex(option => (
      selectedValues.includes(option.value) && !option.disabled
    ))
    setActiveIndex(currentIndex >= 0 ? currentIndex : enabledIndexes[0] ?? 0)
    setOpen(true)
    if (options.length > 8) requestAnimationFrame(() => searchRef.current?.focus())
  }

  const handleTriggerKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu()
      else moveActive(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(filteredOptions[activeIndex])
      else openMenu()
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActiveIndex(enabledIndexes[0] ?? 0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? 0)
    }
  }

  const handleSearchKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(filteredOptions[activeIndex])
    }
  }

  const triggerLabel = multiple
    ? selectedOptions.length === 0
      ? 'Выберите документы'
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : 'Выбрано документов: ' + selectedOptions.length
    : selected?.label || (selectedValue ? selectedValue : 'Выберите значение')

  return (
    <div
      ref={rootRef}
      className={'hub-select ' + className + (multiple ? ' is-multiple' : '')}
      style={style}
      data-open={open ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="hub-select-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required || undefined}
        aria-disabled={disabled || undefined}
        aria-multiselectable={multiple || undefined}
        title={title || (multiple ? selectedOptions.map(option => option.label).join(', ') : selected?.label)}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={'hub-select-value' + (!selectedOptions.length && !selected ? ' is-empty' : '')}>
          {triggerLabel}
        </span>
        <ChevronDown className="hub-select-chevron" size={16} aria-hidden="true" />
      </button>

      <select
        className="hub-select-native"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        multiple={multiple}
        required={required}
        disabled={disabled}
        value={multiple ? selectedValues : selectedValue}
        onChange={() => {}}
      >
        {options.map(option => (
          <option key={option.key} value={option.value} disabled={option.disabled}>{option.label}</option>
        ))}
      </select>

      {open && position && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          className="hub-select-menu"
          role="listbox"
          aria-multiselectable={multiple || undefined}
          style={{
            position: 'fixed',
            top: position.top,
            bottom: position.bottom,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            zIndex: 9999,
          }}
        >
          {options.length > 8 && (
            <div className="hub-select-search">
              <Search size={15} aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={event => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Найти вариант…"
                aria-label="Поиск по вариантам"
              />
            </div>
          )}
          <div className="hub-select-options">
            {filteredOptions.length ? filteredOptions.map((option, index) => {
              const isSelected = selectedValues.includes(option.value)
              return (
                <button
                  key={option.key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  data-active={activeIndex === index}
                  disabled={option.disabled}
                  className={
                    'hub-select-option'
                    + (isSelected ? ' is-selected' : '')
                    + (activeIndex === index ? ' is-active' : '')
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label || '—'}</span>
                  {isSelected && <Check size={15} aria-hidden="true" />}
                </button>
              )
            }) : <div className="hub-select-empty">Ничего не найдено</div>}
          </div>
          {multiple && <div className="hub-select-menu-footer">{selectedOptions.length} выбрано</div>}
        </div>,
        document.body,
      )}
    </div>
  )
}
