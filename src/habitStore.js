/**
 * COUPURE — Module Habitude
 * Une seule habitude active, système anti-abandon.
 */

import { toDateKey, todayStr as localTodayStr } from './date'

const HABIT_KEY     = 'coupure_habit_v1'
const HLOG_KEY      = 'coupure_hlog_v1'

// Jours consécutifs pour "installer" une habitude
export const GRADUATION_DAYS = 21

export const HABIT_SUGGESTIONS = [
  { id: 'walk',    emoji: '🚶', name: 'Marche quotidienne',     full: 'Marcher 10 minutes',         mini: 'Marcher 2 minutes dehors' },
  { id: 'water',   emoji: '💧', name: 'Hydratation matin',      full: 'Boire 2 grands verres d\'eau au réveil', mini: 'Boire 1 verre d\'eau en se levant' },
  { id: 'nosnack', emoji: '🚫', name: 'Stop grignotage soir',   full: 'Aucun grignotage après 21h', mini: 'Aucun grignotage après 22h' },
  { id: 'sleep',   emoji: '🌙', name: 'Heure de coucher',       full: 'Au lit avant 23h',            mini: 'Écrans éteints à 23h30' },
  { id: 'protein', emoji: '🥩', name: 'Protéines au petit-déj', full: 'Source de protéines à chaque repas', mini: 'Protéines au petit-déjeuner uniquement' },
  { id: 'steps',   emoji: '👟', name: '7000 pas',               full: 'Atteindre 7000 pas',          mini: 'Atteindre 3000 pas' },
  { id: 'custom',  emoji: '✏️', name: 'Habitude personnalisée', full: '',                            mini: '' },
]

export function loadHabit() {
  try {
    const raw = JSON.parse(localStorage.getItem(HABIT_KEY))
    if (!raw || typeof raw !== 'object') return null
    return {
      ...raw,
      enabled: raw.enabled ?? true,
      reminderTime: typeof raw.reminderTime === 'string' ? raw.reminderTime : '08:00',
    }
  }
  catch { return null }
}

export function saveHabit(h) {
  localStorage.setItem(HABIT_KEY, JSON.stringify(h))
}

export function loadHabitLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HLOG_KEY))
    if (!Array.isArray(parsed)) return []
    const valid = new Set(['done', 'minimum', 'missed'])
    return parsed
      .filter((log) => log && typeof log.date === 'string' && valid.has(log.status))
      .map((log) => ({
        date: log.date,
        status: log.status,
        ts: Number.isFinite(Number(log.ts)) ? Number(log.ts) : Date.now(),
      }))
  }
  catch { return [] }
}

export function saveHabitLogs(logs) {
  localStorage.setItem(HLOG_KEY, JSON.stringify(logs))
}

export function todayStr() {
  return localTodayStr()
}

export function formatDateShort(d) {
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()}/${dt.getMonth() + 1}`
}

/**
 * Calcule le streak actuel (jours consécutifs done|minimum)
 * et le nombre de "rescues" utilisés (minimum)
 */
export function computeStreak(logs) {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0, rescues = 0, perfect = 0

  for (const log of sorted) {
    if (log.status === 'done' || log.status === 'minimum') {
      streak++
      if (log.status === 'minimum') rescues++
      else perfect++
    } else {
      break // 'missed' casse la chaîne
    }
  }
  return { streak, rescues, perfect }
}

/**
 * Calcule les 14 derniers jours pour la visualisation de chaîne
 */
export function getLast14(logs) {
  const result = []
  const d = new Date()
  for (let i = 13; i >= 0; i--) {
    const dt  = new Date(d)
    dt.setDate(d.getDate() - i)
    const ds  = toDateKey(dt)
    const log = logs.find((l) => l.date === ds)
    result.push({ date: ds, status: log?.status ?? null })
  }
  return result
}

/**
 * Vérifie si l'habitude est diplômée (21 jours consécutifs stables)
 */
export function isGraduated(logs) {
  const { streak } = computeStreak(logs)
  return streak >= GRADUATION_DAYS
}

/**
 * Génère un message contextuel selon l'état
 */
export function getContextMessage(streak, todayStatus) {
  if (todayStatus === 'done')    return { emoji: '🔥', text: 'Fait ! Chaîne maintenue.' }
  if (todayStatus === 'minimum') return { emoji: '⚡', text: 'Version mini comptée. Chaîne sauvée.' }
  if (todayStatus === 'missed')  return { emoji: '💔', text: 'Raté. Recommence demain.' }

  if (streak === 0)  return { emoji: '🌱', text: 'Commence aujourd\'hui. Le premier jour est le plus facile.' }
  if (streak < 3)    return { emoji: '🌱', text: `${streak} jour${streak > 1 ? 's' : ''}. Les habitudes se construisent dans la répétition.` }
  if (streak < 7)    return { emoji: '🔥', text: `${streak} jours. Tu entres dans la zone de construction.` }
  if (streak < 14)   return { emoji: '🔥', text: `${streak} jours consécutifs. La résistance diminue.` }
  if (streak < 21)   return { emoji: '💪', text: `${streak} jours. Plus que ${GRADUATION_DAYS - streak} pour installer l'habitude définitivement.` }
  return { emoji: '🏆', text: `${streak} jours. Habitude installée. Tu peux en créer une nouvelle.` }
}
