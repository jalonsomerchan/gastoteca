import { normalizeName } from './formatters.js'

export function syncTypedOption(target, key, query, options = []) {
  const typedValue = String(query || '').trim()
  if (!typedValue) return

  const availableOptions = Array.isArray(options) ? options : options?.value || []
  const match = availableOptions.find((option) => {
    const value = typeof option === 'object' && option !== null ? option.value : option
    const label = typeof option === 'object' && option !== null ? option.label ?? value : option
    return [value, label].some((candidate) => candidate != null && normalizeName(String(candidate)) === normalizeName(typedValue))
  })

  const resolvedValue = match == null
    ? typedValue
    : typeof match === 'object' && match !== null
      ? match.value ?? match.label ?? typedValue
      : match

  if (key === null) target.value = resolvedValue
  else target[key] = resolvedValue
}
