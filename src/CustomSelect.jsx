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
import { Check, ChevronDown } from 'lucide-react'
import './CustomSelect.css'

function nodeText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement(node)) return nodeText(node.props.children)
  return ''
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
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState(null)
  const [internalValue, setInternalValue] = useState(() => (
    defaultValue !== undefined ? String(defaultValue) : value !== undefined ? String(value ?? '') : ''
  ))
  const controlled = value !== undefined

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

  const selectedValue = controlled ? String(value ?? '') : internalValue
  const selected = options.find(option => option.value === selectedValue)
  const enabledIndexes = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const estimatedHeight = Math.min(288, Math.max(44, options.length * 42 + 8))
    const openAbove = window.innerHeight - rect.bottom < estimatedHeight + 14 && rect.top > estimatedHeight + 14
    const width = Math.min(Math.max(rect.width, 190), window.innerWidth - 24)
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
    setPosition({
      top: openAbove ? Math.max(12, rect.top - estimatedHeight - 6) : rect.bottom + 6,
      left,
      width,
      maxHeight: Math.min(288, window.innerHeight - 24),
    })
  }

  useEffect(() => {
    if (!open) return undefined
    updatePosition()
    const onPointerDown = event => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false)
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
    const active = menuRef.current.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const choose = option => {
    if (!option || option.disabled) return
    if (!controlled) setInternalValue(option.value)
    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value },
    })
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const openMenu = index => {
    if (disabled) return
    const selectedIndex = options.findIndex(option => option.value === selectedValue && !option.disabled)
    setActiveIndex(index ?? (selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? 0))
    setOpen(true)
  }

  const moveActive = delta => {
    if (!enabledIndexes.length) return
    const current = enabledIndexes.indexOf(activeIndex)
    const next = current < 0
      ? enabledIndexes[0]
      : enabledIndexes[(current + delta + enabledIndexes.length) % enabledIndexes.length]
    setActiveIndex(next)
  }

  const handleTriggerKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu()
      else moveActive(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(options[activeIndex])
      else openMenu()
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActiveIndex(enabledIndexes[0] ?? 0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? 0)
    }
  }

  return (
    <div
      ref={rootRef}
      className={'hub-select ' + className}
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
        title={title || selected?.label}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={'hub-select-value' + (!selected ? ' is-empty' : '')}>
          {selected?.label || (selectedValue ? selectedValue : 'Выберите значение')}
        </span>
        <ChevronDown className="hub-select-chevron" size={16} aria-hidden="true" />
      </button>

      <select
        className="hub-select-native"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        disabled={disabled}
        value={selectedValue}
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
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            zIndex: 9999,
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={selectedValue === option.value}
              aria-disabled={option.disabled || undefined}
              data-active={activeIndex === index}
              disabled={option.disabled}
              className={
                'hub-select-option'
                + (selectedValue === option.value ? ' is-selected' : '')
                + (activeIndex === index ? ' is-active' : '')
              }
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <span>{option.label || '—'}</span>
              {selectedValue === option.value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
