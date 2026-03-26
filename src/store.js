import { todayStr as localTodayStr } from './date'

const SETTINGS_KEY = 'coupure_settings_v2'
const LOGS_KEY = 'coupure_logs_v2'

export const DEFAULT_SETTINGS = {
  // Objectif
  startWeight: 85,
  goalWeight: 75,
  weeklyLoss: 0.5,

  // Biométrie (pour calcul BMR Mifflin-St Jeor)
  height: 175,          // cm
  age: 30,
  sex: 'male',          // 'male' | 'female'
  activityLevel: 1.375, // 1.2 sédentaire → 1.725 très actif

  // Macros
  proteinPerKg: 2.2,
  fatPercent: 25,

  // TDEE override manuel (utilisé si 0 → calculé depuis BMR)
  manualTDEE: 0,
}

const ACTIVITY_VALUES = [1.2, 1.375, 1.55, 1.725, 1.9]

function toNumber(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function sanitizeSettings(input) {
  const s = input ?? {}
  const activity = toNumber(s.activityLevel, DEFAULT_SETTINGS.activityLevel)
  const validActivity = ACTIVITY_VALUES.includes(activity) ? activity : DEFAULT_SETTINGS.activityLevel

  return {
    startWeight: clamp(toNumber(s.startWeight, DEFAULT_SETTINGS.startWeight), 25, 500),
    goalWeight: clamp(toNumber(s.goalWeight, DEFAULT_SETTINGS.goalWeight), 25, 500),
    weeklyLoss: clamp(toNumber(s.weeklyLoss, DEFAULT_SETTINGS.weeklyLoss), 0.1, 2),
    height: clamp(toNumber(s.height, DEFAULT_SETTINGS.height), 120, 240),
    age: clamp(toNumber(s.age, DEFAULT_SETTINGS.age), 14, 100),
    sex: s.sex === 'female' ? 'female' : 'male',
    activityLevel: validActivity,
    proteinPerKg: clamp(toNumber(s.proteinPerKg, DEFAULT_SETTINGS.proteinPerKg), 0.8, 4),
    fatPercent: clamp(toNumber(s.fatPercent, DEFAULT_SETTINGS.fatPercent), 10, 60),
    manualTDEE: clamp(toNumber(s.manualTDEE, DEFAULT_SETTINGS.manualTDEE), 0, 7000),
  }
}

function sanitizeManual(input) {
  const m = input ?? {}
  return {
    kcal: toNumber(m.kcal, null),
    protein: toNumber(m.protein, null),
    fat: toNumber(m.fat, null),
    carbs: toNumber(m.carbs, null),
  }
}

function sanitizeItem(input, idx = 0) {
  const item = input ?? {}
  return {
    id: item.id ?? `legacy_${idx}_${String(item.name ?? 'food').slice(0, 16)}`,
    name: String(item.name ?? 'Aliment'),
    qty: toNumber(item.qty, 0),
    kcal: toNumber(item.kcal, 0),
    protein: toNumber(item.protein, 0),
    carbs: toNumber(item.carbs, 0),
    fat: toNumber(item.fat, 0),
  }
}

function sanitizeLogs(input) {
  if (!Array.isArray(input)) return []
  return input
    .map((log) => {
      if (!log || typeof log !== 'object' || typeof log.date !== 'string') return null
      return {
        date: log.date,
        weight: toNumber(log.weight, null),
        items: Array.isArray(log.items) ? log.items.map(sanitizeItem) : [],
        manual: sanitizeManual(log.manual),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return sanitizeSettings(raw ? JSON.parse(raw) : DEFAULT_SETTINGS)
  } catch {
    return sanitizeSettings(DEFAULT_SETTINGS)
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(s)))
}

export function loadLogs() {
  try {
    const raw = localStorage.getItem(LOGS_KEY)
    return sanitizeLogs(raw ? JSON.parse(raw) : [])
  } catch {
    return []
  }
}

export function saveLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(sanitizeLogs(logs)))
}

export function todayStr() {
  return localTodayStr()
}

export function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatDateShort(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()}/${dt.getMonth() + 1}`
}

/**
 * Retourne les totaux macros d'un log (somme des items + saisie manuelle)
 * Structure log :
 *   { date, weight, items: [{name,kcal,protein,fat,carbs,qty}], manual:{kcal,protein,fat,carbs} }
 */
export function logTotals(log) {
  if (!log) return { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  const items = log.items ?? []
  const m = log.manual ?? {}
  const n = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const sum = (field) =>
    Math.round(
      items.reduce((acc, it) => acc + n(it?.[field]), 0) + n(m[field])
    )
  return {
    kcal:    sum('kcal'),
    protein: sum('protein'),
    fat:     sum('fat'),
    carbs:   sum('carbs'),
  }
}
