/**
 * MacroCut - Module Habitude
 * Une seule habitude active, systeme anti-abandon.
 */

import { toDateKey, todayStr as localTodayStr } from './date'

const HABIT_KEY = 'coupure_habit_v1'
const HLOG_KEY = 'coupure_hlog_v1'

export const GRADUATION_DAYS = 21

export const HABIT_SUGGESTIONS = [
  {
    id: 'checkin',
    emoji: '◎',
    name: 'Check-in quotidien',
    full: 'Ouvrir MacroCut et faire ton check-in du jour',
    mini: 'Ouvrir MacroCut 30 secondes',
    focus: 'checkin',
  },
  { id: 'walk', emoji: '🚶', name: 'Marche quotidienne', full: 'Marcher 10 minutes', mini: 'Marcher 2 minutes dehors' },
  { id: 'water', emoji: '💧', name: 'Hydratation matin', full: "Boire 2 grands verres d'eau au reveil", mini: "Boire 1 verre d'eau en se levant" },
  { id: 'nosnack', emoji: '🚫', name: 'Stop grignotage soir', full: 'Aucun grignotage apres 21h', mini: 'Aucun grignotage apres 22h' },
  { id: 'sleep', emoji: '🌙', name: 'Heure de coucher', full: 'Au lit avant 23h', mini: 'Ecrans eteints a 23h30' },
  { id: 'protein', emoji: '🥩', name: 'Proteines au petit-dej', full: 'Source de proteines a chaque repas', mini: 'Proteines au petit-dejeuner uniquement' },
  { id: 'steps', emoji: '👟', name: '7000 pas', full: 'Atteindre 7000 pas', mini: 'Atteindre 3000 pas' },
  { id: 'custom', emoji: '✏️', name: 'Habitude personnalisee', full: '', mini: '', focus: null },
]

export function todayStr() {
  return localTodayStr()
}

export function createDefaultCoachHabit(reminderTime = '07:30') {
  return {
    id: `checkin_${Date.now()}`,
    emoji: '◎',
    name: 'Check-in quotidien',
    fullAction: 'Ouvrir MacroCut et faire ton check-in du jour',
    miniAction: 'Ouvrir MacroCut 30 secondes',
    reminderTime,
    createdAt: todayStr(),
    graduated: false,
    enabled: true,
    focus: 'checkin',
  }
}

function migrateHabitText(habit) {
  if (!habit || typeof habit !== 'object') return null

  const nextHabit = { ...habit }

  if (nextHabit.fullAction === 'Ouvrir COUPURE et faire ton check-in du jour') {
    nextHabit.fullAction = 'Ouvrir MacroCut et faire ton check-in du jour'
  }

  if (nextHabit.miniAction === 'Ouvrir COUPURE 30 secondes') {
    nextHabit.miniAction = 'Ouvrir MacroCut 30 secondes'
  }

  return nextHabit
}

export function loadHabit() {
  try {
    const raw = JSON.parse(localStorage.getItem(HABIT_KEY))
    if (!raw || typeof raw !== 'object') return null
    return {
      ...migrateHabitText(raw),
      enabled: raw.enabled ?? true,
      reminderTime: typeof raw.reminderTime === 'string' ? raw.reminderTime : '08:00',
      focus: typeof raw.focus === 'string' ? raw.focus : null,
    }
  } catch {
    return null
  }
}

export function saveHabit(habit) {
  localStorage.setItem(HABIT_KEY, JSON.stringify(habit))
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
  } catch {
    return []
  }
}

export function saveHabitLogs(logs) {
  localStorage.setItem(HLOG_KEY, JSON.stringify(logs))
}

export function formatDateShort(date) {
  const dt = new Date(`${date}T12:00:00`)
  return `${dt.getDate()}/${dt.getMonth() + 1}`
}

export function computeStreak(logs) {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  let rescues = 0
  let perfect = 0

  for (const log of sorted) {
    if (log.status === 'done' || log.status === 'minimum') {
      streak++
      if (log.status === 'minimum') rescues++
      else perfect++
    } else {
      break
    }
  }

  return { streak, rescues, perfect }
}

export function getLast14(logs) {
  const result = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(today)
    dt.setDate(today.getDate() - i)
    const ds = toDateKey(dt)
    const log = logs.find((entry) => entry.date === ds)
    result.push({ date: ds, status: log?.status ?? null })
  }
  return result
}

export function isGraduated(logs) {
  const { streak } = computeStreak(logs)
  return streak >= GRADUATION_DAYS
}

export function getContextMessage(streak, todayStatus) {
  if (todayStatus === 'done') return { emoji: '🔥', text: 'Fait. La chaine continue.' }
  if (todayStatus === 'minimum') return { emoji: '⚡', text: 'Version mini comptee. La chaine tient.' }
  if (todayStatus === 'missed') return { emoji: '↺', text: 'Jour rate. Reprends simplement demain.' }

  if (streak === 0) return { emoji: '🌱', text: "Commence aujourd'hui. Le plus important, c'est de revenir." }
  if (streak < 3) return { emoji: '🌱', text: `${streak} jour${streak > 1 ? 's' : ''}. La routine se met en place.` }
  if (streak < 7) return { emoji: '🔥', text: `${streak} jours. Tu installes le reflexe.` }
  if (streak < 14) return { emoji: '🔥', text: `${streak} jours consecutifs. La resistance baisse.` }
  if (streak < 21) return { emoji: '💪', text: `${streak} jours. Plus que ${GRADUATION_DAYS - streak} pour l'ancrer.` }
  return { emoji: '🏆', text: `${streak} jours. Habitude installee.` }
}
