/**
 * COUPURE — Système de notifications locales
 *
 * Architecture sans serveur :
 *  - SW reçoit des "alarms" stockées en localStorage
 *  - À l'ouverture de l'app, on vérifie si des notifs sont dues
 *  - Periodic Background Sync utilisé si dispo (expérimental)
 *  - Fallback: vérification à chaque ouverture + visible-change
 */

import { todayStr } from './date'

const NOTIF_KEY = 'coupure_notif_v1'

export const MESSAGES = {
  morning: [
    { title: '⚖️ Poids du matin', body: 'Pèse-toi à jeun avant de manger. La régularité c\'est tout.' },
    { title: '⚖️ On monte sur la balance', body: 'Même résultat honnête que faux confort. Vas-y.' },
    { title: '⚖️ Routine matinale', body: 'Poids, puis café. Dans cet ordre.' },
    { title: '⚖️ Données = pouvoir', body: 'Sans le poids du matin, l\'algo ne peut pas t\'aider. 30 secondes.' },
    { title: '⚖️ C\'est le moment', body: 'Toujours à la même heure, toujours à jeun. Log ton poids.' },
  ],
  evening: [
    { title: '🍽️ Log de soirée', body: 'As-tu enregistré tout ce que tu as mangé aujourd\'hui ?' },
    { title: '🍽️ Fin de journée', body: 'Un log incomplet vaut mieux qu\'aucun log. Ajoute ce que tu te rappelles.' },
    { title: '🍽️ Ferme la boucle', body: 'La journée est presque finie. Complète ton suivi.' },
    { title: '🍽️ Honnêteté > perfection', body: 'Log tout, même si c\'est pas parfait. L\'algo s\'adapte.' },
    { title: '🍽️ Soirée de bilan', body: 'Quelques secondes pour fermer la journée correctement.' },
  ],
  motivation: [
    { title: '💪 Reste dans le jeu', body: 'La constance bat la perfection. Un jour à la fois.' },
    { title: '🔥 Momentum', body: 'Chaque jour loggé renforce l\'algo et ta discipline.' },
    { title: '📉 La tendance est ton amie', body: 'Le poids fluctue. La moyenne, elle, ne ment pas.' },
    { title: '⚡ Rappel', body: 'Ton TDEE s\'adapte à toi. Continue à logger pour qu\'il soit précis.' },
    { title: '🏋️ Force & coupure', body: 'Maintenir les protéines protège ta masse. Check ton objectif.' },
    { title: '🎯 Focus', body: 'Déficit modéré + protéines élevées = composition optimale.' },
    { title: '📊 Data > feeling', body: 'La balance ment à court terme. Fais confiance à la courbe sur 2 semaines.' },
  ],
}

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function todayKey() {
  return todayStr()
}

export function loadNotifSettings() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY)) ?? getDefaultSettings()
  } catch {
    return getDefaultSettings()
  }
}

function getDefaultSettings() {
  return {
    enabled: false,
    morningTime: '07:30',
    eveningTime: '20:00',
    motivationEnabled: true,
    lastMorning: null,
    lastEvening: null,
    lastMotivation: null,
  }
}

export function saveNotifSettings(s) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(s))
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  const result = await Notification.requestPermission()
  return result
}

export function getPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function timeToMinutes(timeStr) {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function currentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function showNotification(title, body, tag) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, {
        body,
        tag,
        icon: './icon-192.png',
        badge: './icon-192.png',
      }))
      .catch(() => {
        new Notification(title, { body, icon: './icon-192.png', tag })
      })
    return
  }
  new Notification(title, { body, icon: './icon-192.png', tag })
}

/**
 * Vérifie si des notifications sont dues et les envoie.
 * Appelé à chaque ouverture/focus de l'app.
 */
export function checkAndSendNotifications(settings) {
  if (!('Notification' in window)) return
  if (!settings.enabled || Notification.permission !== 'granted') return

  const today = todayKey()
  const nowMin = currentMinutes()
  let updated = { ...settings }
  let changed  = false

  // Morning
  const morningMin = timeToMinutes(settings.morningTime)
  if (morningMin != null && nowMin >= morningMin && settings.lastMorning !== today) {
    const msg = getRandom(MESSAGES.morning)
    showNotification(msg.title, msg.body, 'morning')
    updated.lastMorning = today
    changed = true
  }

  // Evening
  const eveningMin = timeToMinutes(settings.eveningTime)
  if (eveningMin != null && nowMin >= eveningMin && settings.lastEvening !== today) {
    const msg = getRandom(MESSAGES.evening)
    showNotification(msg.title, msg.body, 'evening')
    updated.lastEvening = today
    changed = true
  }

  // Motivation (aléatoire, max 1 par jour à 12h)
  if (settings.motivationEnabled && nowMin >= 12 * 60 && settings.lastMotivation !== today) {
    if (Math.random() < 0.4) { // 40% de chance de notif motivationnelle à l'ouverture si >12h
      const msg = getRandom(MESSAGES.motivation)
      showNotification(msg.title, msg.body, 'motivation')
      updated.lastMotivation = today
      changed = true
    }
  }

  if (changed) saveNotifSettings(updated)
  return updated
}

export function sendTestNotification(type = 'motivation') {
  const msg = getRandom(MESSAGES[type] ?? MESSAGES.motivation)
  showNotification(msg.title, msg.body, 'test')
}

/**
 * Vérification notif habitude
 * Appelé depuis App, séparé du flux nutrition
 */
export function checkHabitNotification(habitSettings) {
  if (!('Notification' in window)) return
  const enabled = habitSettings?.enabled ?? true
  if (!enabled || Notification.permission !== 'granted') return
  const { reminderTime, lastHabitNotif } = habitSettings
  if (!reminderTime) return
  const today  = todayKey()
  const nowMin = currentMinutes()
  const remMin = timeToMinutes(reminderTime)
  if (remMin != null && nowMin >= remMin && lastHabitNotif !== today) {
    showNotification('🔥 Habitude du jour', 'As-tu fait ton action aujourd\'hui ? Version mini acceptée.', 'habit')
    return { ...habitSettings, lastHabitNotif: today }
  }
  return null
}
