/**
 * COUPURE - Moteur de routine local
 *
 * Pas de backend:
 * - verification a l'ouverture et au retour au premier plan
 * - notifications routees vers l'ecran utile
 * - logique contextuelle basee sur les logs et l'habitude active
 */

import { todayStr } from './date'
import { logTotals } from './store'
import { computeStreak, loadHabitLogs } from './habitStore'

const LEGACY_NOTIF_KEY = 'coupure_notif_v1'
const NOTIF_KEY = 'coupure_notif_v2'
const SUPPORT_TIME = '16:30'
const MAX_FOLLOWUPS_PER_DAY = 2

const MESSAGE_POOLS = {
  routine: {
    new: [
      {
        title: 'Routine du jour',
        body: "Commence petit. Cree une habitude simple et garde-la aujourd'hui.",
        route: 'coach',
      },
      {
        title: 'Ton premier reflexe',
        body: "Une micro-routine suffit. Ouvre COUPURE et choisis ton geste du jour.",
        route: 'coach',
      },
    ],
    starting: [
      {
        title: 'On continue',
        body: "Ta routine prend forme. Fais-la tot, meme en version mini.",
        route: 'coach',
      },
      {
        title: 'Petit geste, grand effet',
        body: "Deux minutes suffisent pour ne pas casser l'elan.",
        route: 'coach',
      },
    ],
    fragile: [
      {
        title: 'Reprends simplement',
        body: "Pas besoin de rattraper. Reviens juste au prochain petit geste.",
        route: 'coach',
      },
      {
        title: 'Retour calme',
        body: "Une reprise modeste vaut mieux qu'une attente parfaite. Fais ta version mini.",
        route: 'coach',
      },
    ],
    building: [
      {
        title: 'Tu construis ta routine',
        body: "Continue sans chercher parfait. L'important, c'est d'etre la aujourd'hui.",
        route: 'coach',
      },
      {
        title: 'Garde le rythme',
        body: "Ta chaine progresse. Un check-in aujourd'hui et tu consolides.",
        route: 'coach',
      },
    ],
    stable: [
      {
        title: 'Routine solide',
        body: "Tu sais quoi faire. Fais ton check-in et garde le standard.",
        route: 'coach',
      },
      {
        title: 'Cap maintenu',
        body: "Les jours simples comptent aussi. On verrouille la routine aujourd'hui.",
        route: 'coach',
      },
    ],
  },
  support: {
    new: [
      {
        title: 'Un pas maintenant',
        body: "Pas besoin d'attendre le bon moment. Lance ta premiere micro-routine.",
        route: 'coach',
      },
    ],
    starting: [
      {
        title: 'Relance douce',
        body: "Si la journee part vite, fais juste la version mini pour rester dans le jeu.",
        route: 'coach',
      },
    ],
    fragile: [
      {
        title: 'On repart sans pression',
        body: "Un seul petit geste aujourd'hui suffit pour revenir dans la boucle.",
        route: 'coach',
      },
      {
        title: 'Pas besoin de compenser',
        body: "Reprends la routine telle qu'elle est. Le plus dur, c'est de revenir.",
        route: 'coach',
      },
    ],
    building: [
      {
        title: 'Tu peux sauver la journee',
        body: "Ton mini check-in maintient l'habitude meme les jours charges.",
        route: 'coach',
      },
    ],
    stable: [
      {
        title: 'Ne coupe pas le fil',
        body: "Un passage rapide dans COUPURE suffit pour garder la chaine propre.",
        route: 'coach',
      },
    ],
  },
  closure: {
    new: [
      {
        title: 'Fermer la journee',
        body: "Ajoute au moins ce dont tu te souviens. Un journal incomplet vaut mieux que vide.",
        route: 'today',
      },
    ],
    starting: [
      {
        title: 'Boucle du soir',
        body: "Ferme la journee maintenant pour rendre demain plus simple.",
        route: 'today',
      },
    ],
    fragile: [
      {
        title: 'Cloture simple',
        body: "Pas besoin d'etre parfait. Note juste l'essentiel avant la fin de journee.",
        route: 'today',
      },
    ],
    building: [
      {
        title: 'Journal du soir',
        body: "Completer ton jour maintenant protege la routine de demain.",
        route: 'today',
      },
    ],
    stable: [
      {
        title: 'Journee a fermer',
        body: "Tu connais la suite: complete ton journal et laisse le coach respirer.",
        route: 'today',
      },
    ],
  },
}

function getDefaultSettings() {
  return {
    enabled: false,
    permissionAskedAt: null,
    permissionState: getPermission(),
    morningTime: '07:30',
    eveningTime: '20:00',
    lastRoutine: null,
    lastClosure: null,
    lastSupport: null,
    lastState: 'new',
    cooldownLevel: 0,
  }
}

function sanitizeSettings(input) {
  const base = getDefaultSettings()
  const state = input ?? {}
  return {
    enabled: state.enabled === true,
    permissionAskedAt: typeof state.permissionAskedAt === 'string' ? state.permissionAskedAt : null,
    permissionState: normalizePermissionState(state.permissionState),
    morningTime: normalizeTime(state.morningTime, base.morningTime),
    eveningTime: normalizeTime(state.eveningTime, base.eveningTime),
    lastRoutine: typeof state.lastRoutine === 'string' ? state.lastRoutine : null,
    lastClosure: typeof state.lastClosure === 'string' ? state.lastClosure : null,
    lastSupport: typeof state.lastSupport === 'string' ? state.lastSupport : null,
    lastState: isKnownState(state.lastState) ? state.lastState : 'new',
    cooldownLevel: clamp(Number(state.cooldownLevel) || 0, 0, 2),
  }
}

function isKnownState(value) {
  return ['new', 'starting', 'fragile', 'building', 'stable'].includes(value)
}

function normalizePermissionState(value) {
  if (value === 'granted' || value === 'denied' || value === 'default' || value === 'unsupported') {
    return value
  }
  return getPermission()
}

function normalizeTime(value, fallback) {
  return timeToMinutes(value) == null ? fallback : value
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function timeToMinutes(timeStr) {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function currentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function dateDistance(dateA, dateB) {
  if (!dateA || !dateB) return Infinity
  const first = new Date(`${dateA}T12:00:00`)
  const second = new Date(`${dateB}T12:00:00`)
  return Math.round((second - first) / (24 * 60 * 60 * 1000))
}

function loadLegacySettings() {
  try {
    const raw = localStorage.getItem(LEGACY_NOTIF_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function migrateLegacySettings(input) {
  if (!input || typeof input !== 'object') return null
  return sanitizeSettings({
    enabled: input.enabled === true,
    permissionAskedAt: null,
    permissionState: getPermission(),
    morningTime: input.morningTime,
    eveningTime: input.eveningTime,
    lastRoutine: input.lastMorning ?? null,
    lastClosure: input.lastEvening ?? null,
    lastSupport: input.lastMotivation ?? null,
    lastState: 'new',
    cooldownLevel: 0,
  })
}

function getRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function poolFor(type, state) {
  return MESSAGE_POOLS[type]?.[state] ?? MESSAGE_POOLS[type]?.new ?? []
}

function showNotification({ title, body, tag, route }) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const options = {
    body,
    tag,
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { route },
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => {
        const notification = new Notification(title, options)
        notification.onclick = () => {
          window.location.hash = `#${route}`
          window.focus()
        }
      })
    return
  }

  const notification = new Notification(title, options)
  notification.onclick = () => {
    window.location.hash = `#${route}`
    window.focus()
  }
}

function recentWeightMissing(logs) {
  const today = todayStr()
  const withWeight = [...(logs ?? [])]
    .filter((log) => log?.weight != null)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!withWeight.length) return true
  return dateDistance(withWeight[0].date, today) > 1
}

function isClosureIncomplete(logs, habit) {
  const today = todayStr()
  const todayLog = (logs ?? []).find((log) => log.date === today) ?? null
  const totals = logTotals(todayLog)
  if (totals.kcal <= 0) return true
  if (habit?.focus === 'weight' && recentWeightMissing(logs)) return true
  return false
}

function deriveRoutineState({ habit, habitLogs, today }) {
  const logs = Array.isArray(habitLogs) ? habitLogs : []
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  const todayLog = sorted.find((log) => log.date === today) ?? null
  const lastLog = sorted[0] ?? null
  const { streak } = computeStreak(logs)

  if (!habit) return 'new'
  if (!logs.length) return 'new'
  if (todayLog?.status === 'missed' || lastLog?.status === 'missed') return 'fragile'
  if (lastLog && dateDistance(lastLog.date, today) > 1) return 'fragile'
  if (streak <= 2) return 'starting'
  if (streak >= 14 || habit.graduated) return 'stable'
  return 'building'
}

function activityDoneToday({ logs, habitLogs, today }) {
  const todayHabit = (habitLogs ?? []).find((log) => log.date === today)
  const todayNutrition = (logs ?? []).find((log) => log.date === today) ?? null
  const totals = logTotals(todayNutrition)
  return Boolean(todayHabit || todayNutrition?.weight != null || totals.kcal > 0)
}

function followupsSentToday(settings, today) {
  let count = 0
  if (settings.lastSupport === today) count++
  if (settings.lastClosure === today) count++
  return count
}

function buildMessage(type, state) {
  const pool = poolFor(type, state)
  return getRandom(pool)
}

export function loadNotifSettings() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (raw) return sanitizeSettings(JSON.parse(raw))
  } catch {}

  const migrated = migrateLegacySettings(loadLegacySettings())
  if (migrated) {
    saveNotifSettings(migrated)
    return migrated
  }

  return getDefaultSettings()
}

export function saveNotifSettings(settings) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(sanitizeSettings(settings)))
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (!window.isSecureContext) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission || 'default'
  }
}

export function getPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (!window.isSecureContext) return 'unsupported'
  return Notification.permission
}

export function checkAndSendNotifications({
  settings,
  logs = [],
  habit = null,
  habitLogs = loadHabitLogs(),
} = {}) {
  if (!('Notification' in window)) return null

  const current = sanitizeSettings(settings)
  const permissionState = getPermission()
  const updated = {
    ...current,
    permissionState,
  }
  const today = todayStr()
  const nowMinutes = currentMinutes()
  const state = deriveRoutineState({ habit, habitLogs, today })
  const doneToday = activityDoneToday({ logs, habitLogs, today })
  let changed = updated.permissionState !== current.permissionState || updated.lastState !== state

  updated.lastState = state

  if (!updated.enabled || permissionState !== 'granted') {
    if (changed) saveNotifSettings(updated)
    return changed ? updated : null
  }

  const morningMinutes = timeToMinutes(updated.morningTime)
  if (morningMinutes != null && nowMinutes >= morningMinutes && updated.lastRoutine !== today) {
    const message = buildMessage('routine', state)
    if (message) {
      showNotification({ ...message, tag: 'routine' })
      updated.lastRoutine = today
      changed = true
    }
  }

  const canSendFollowup = followupsSentToday(updated, today) < MAX_FOLLOWUPS_PER_DAY
  const supportMinutes = timeToMinutes(SUPPORT_TIME)
  if (
    canSendFollowup &&
    supportMinutes != null &&
    nowMinutes >= supportMinutes &&
    updated.lastSupport !== today &&
    !doneToday
  ) {
    const message = buildMessage('support', state)
    if (message) {
      showNotification({ ...message, tag: 'support' })
      updated.lastSupport = today
      changed = true
    }
  }

  const eveningMinutes = timeToMinutes(updated.eveningTime)
  const closureNeeded = isClosureIncomplete(logs, habit)
  if (
    followupsSentToday(updated, today) < MAX_FOLLOWUPS_PER_DAY &&
    eveningMinutes != null &&
    nowMinutes >= eveningMinutes &&
    updated.lastClosure !== today &&
    closureNeeded
  ) {
    const message = buildMessage('closure', state)
    if (message) {
      showNotification({ ...message, tag: 'closure' })
      updated.lastClosure = today
      changed = true
    }
  }

  updated.cooldownLevel = doneToday ? 0 : state === 'fragile' ? clamp(updated.cooldownLevel + 1, 0, 2) : 0

  if (changed) {
    saveNotifSettings(updated)
    return updated
  }

  return null
}

export function sendTestNotification(type = 'routine', state = 'starting') {
  const message = buildMessage(type, isKnownState(state) ? state : 'starting')
  if (!message) return
  showNotification({ ...message, tag: `test-${type}` })
}

export { NOTIF_KEY, LEGACY_NOTIF_KEY }
