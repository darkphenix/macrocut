/**
 * COUPURE — Algorithme nutrition complet
 *
 * BMR : Mifflin-St Jeor
 *   Homme : BMR = 10×poids(kg) + 6.25×taille(cm) − 5×âge + 5
 *   Femme : BMR = 10×poids(kg) + 6.25×taille(cm) − 5×âge − 161
 *
 * TDEE = BMR × coeff activité
 * Puis ajusté par algo adaptatif après 14j de logs.
 */

function mean(arr) {
  const v = arr.filter((x) => x != null && !isNaN(x))
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export const ACTIVITY_LEVELS = [
  { value: 1.2,   label: 'Sédentaire',           desc: "Peu ou pas d'exercice" },
  { value: 1.375, label: 'Légèrement actif',      desc: '1–3 séances/sem.' },
  { value: 1.55,  label: 'Modérément actif',      desc: '3–5 séances/sem.' },
  { value: 1.725, label: 'Très actif',             desc: '6–7 séances/sem.' },
  { value: 1.9,   label: 'Athlète / travail dur',  desc: 'Double entraînement' },
]

export function computeBMR({ weight, height, age, sex }) {
  if (!weight || !height || !age) return null
  const base = 10 * weight + 6.25 * height - 5 * age
  return Math.round(sex === 'female' ? base - 161 : base + 5)
}

export function computeInitialTDEE(settings, weight) {
  if (settings.manualTDEE > 0) return settings.manualTDEE
  const bmr = computeBMR({
    weight: weight || settings.startWeight,
    height: settings.height,
    age:    settings.age,
    sex:    settings.sex,
  })
  if (!bmr) return 2400
  return Math.round(bmr * (settings.activityLevel || 1.375))
}

export function computeAdaptiveTDEE(logs, fallbackTDEE) {
  const withData = logs.filter((l) => l.weight != null && l.totalKcal != null)
  const sorted = [...withData].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 14) return fallbackTDEE
  const recent   = sorted.slice(-7)
  const previous = sorted.slice(-14, -7)
  const avgKcal  = mean(recent.map((l) => l.totalKcal))
  if (!avgKcal) return fallbackTDEE
  const wRecent = mean(recent.map((l) => l.weight))
  const wPrev   = mean(previous.map((l) => l.weight))
  if (!wRecent || !wPrev) return fallbackTDEE
  const deltaWeight    = wRecent - wPrev
  const dailyImbalance = (deltaWeight * 7700) / 7
  const tdee           = avgKcal - dailyImbalance
  return Math.round(Math.max(1200, Math.min(5500, tdee)))
}

export function computeTargets(tdee, settings, currentWeight) {
  const bw         = currentWeight || settings.startWeight
  const deficitDay = Math.round((settings.weeklyLoss * 7700) / 7)
  const targetKcal = Math.max(1200, Math.round(tdee - deficitDay))
  const protein    = Math.round(bw * settings.proteinPerKg)
  const fat        = Math.round((targetKcal * (settings.fatPercent / 100)) / 9)
  const carbs      = Math.max(0, Math.round((targetKcal - protein * 4 - fat * 9) / 4))
  return { targetKcal, protein, fat, carbs, deficitDay }
}

export function getRollingAvgWeight(logs, window = 7) {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((log, i) => {
    const slice   = sorted.slice(Math.max(0, i - window + 1), i + 1)
    const weights = slice.map((l) => l.weight).filter((w) => w != null)
    const avg     = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null
    return {
      date:       log.date,
      weight:     log.weight,
      rollingAvg: avg != null ? Math.round(avg * 10) / 10 : null,
    }
  })
}

export function dataQuality(logs) {
  const sorted   = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
  const complete = sorted.filter((l) => l.weight != null && l.totalKcal != null).length
  return Math.round((complete / 7) * 100)
}

export function computeBMI(weight, height) {
  if (!weight || !height) return null
  const bmi = weight / ((height / 100) ** 2)
  let cat = ''
  if      (bmi < 18.5) cat = 'Maigreur'
  else if (bmi < 25)   cat = 'Normale'
  else if (bmi < 30)   cat = 'Surpoids'
  else if (bmi < 35)   cat = 'Obésité I'
  else if (bmi < 40)   cat = 'Obésité II'
  else                 cat = 'Obésité III'
  return { bmi: Math.round(bmi * 10) / 10, cat }
}

export function idealWeight(height, sex) {
  if (!height) return null
  const base = sex === 'female'
    ? height - 100 - (height - 150) / 2
    : height - 100 - (height - 150) / 4
  return Math.round(base * 10) / 10
}
