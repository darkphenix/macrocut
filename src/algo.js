import { todayStr, toDateKey } from './date'

/**
 * MacroCut - Pipeline nutrition full client
 *
 * 1. BMR / TDEE initial
 * 2. Qualite des logs
 * 3. TDEE adaptatif robuste
 * 4. Cible de perte securisee
 * 5. Macros adaptees au contexte
 * 6. Prevision a partir de la tendance reelle
 */

const DAY_MS = 24 * 60 * 60 * 1000

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function round(value) {
  return Math.round(Number(value) || 0)
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function mean(values) {
  const list = values.filter((value) => Number.isFinite(value))
  if (!list.length) return null
  return list.reduce((sum, value) => sum + value, 0) / list.length
}

function median(values) {
  const list = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!list.length) return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 === 0
    ? (list[mid - 1] + list[mid]) / 2
    : list[mid]
}

function medianAbsoluteDeviation(values) {
  const med = median(values)
  if (!Number.isFinite(med)) return null
  const deviations = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(value - med))
  return median(deviations)
}

function toDayTs(dateStr) {
  const ts = Date.parse(`${dateStr}T12:00:00`)
  return Number.isFinite(ts) ? ts : null
}

function daysBetween(startTs, endTs) {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return 0
  return Math.max(0, Math.round((endTs - startTs) / DAY_MS))
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function formatEtaDate(dateStr) {
  if (!dateStr) return null
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

function sortLogs(logs) {
  return [...logs]
    .filter((log) => log && typeof log.date === 'string' && Number.isFinite(toDayTs(log.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function getRecentLogs(logs, windowDays = 28) {
  const sorted = sortLogs(logs)
  if (!sorted.length) return []
  const lastTs = toDayTs(sorted[sorted.length - 1].date)
  const startTs = lastTs - ((windowDays - 1) * DAY_MS)
  return sorted.filter((log) => {
    const ts = toDayTs(log.date)
    return ts != null && ts >= startTs && ts <= lastTs
  })
}

function filterOutlierEntries(entries, key, threshold = 3) {
  if (entries.length < 5) return entries
  const values = entries.map((entry) => entry[key])
  const med = median(values)
  const mad = medianAbsoluteDeviation(values)
  if (!Number.isFinite(med) || !Number.isFinite(mad) || mad === 0) return entries
  const scale = mad * 1.4826
  return entries.filter((entry) => Math.abs(entry[key] - med) <= threshold * scale)
}

function getRecentCompleteStreak(logs, limit = 7) {
  if (!logs.length) return 0
  let streak = 0
  const lastTs = toDayTs(logs[logs.length - 1].date)
  for (let i = 0; i < limit; i++) {
    const expectedTs = lastTs - (i * DAY_MS)
    const expectedKey = toDateKey(new Date(expectedTs))
    const log = logs.find((entry) => entry.date === expectedKey)
    if (log?.weight != null && log?.totalKcal != null) streak++
    else break
  }
  return streak
}

function linearRegression(points) {
  if (points.length < 2) return null
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const xMean = mean(xs)
  const yMean = mean(ys)
  if (!Number.isFinite(xMean) || !Number.isFinite(yMean)) return null

  let numerator = 0
  let denominator = 0
  for (const point of points) {
    numerator += (point.x - xMean) * (point.y - yMean)
    denominator += (point.x - xMean) ** 2
  }
  if (!denominator) return null

  const slope = numerator / denominator
  const intercept = yMean - (slope * xMean)
  const ssTotal = ys.reduce((sum, y) => sum + ((y - yMean) ** 2), 0)
  const ssResidual = points.reduce((sum, point) => {
    const estimate = intercept + (slope * point.x)
    return sum + ((point.y - estimate) ** 2)
  }, 0)
  const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0

  return { slope, intercept, r2: clamp(r2, 0, 1) }
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentaire', desc: "Peu ou pas d'exercice" },
  { value: 1.375, label: 'Legerement actif', desc: '1-3 seances/sem.' },
  { value: 1.55, label: 'Moderement actif', desc: '3-5 seances/sem.' },
  { value: 1.725, label: 'Tres actif', desc: '6-7 seances/sem.' },
  { value: 1.9, label: 'Athlete / travail dur', desc: 'Double entrainement' },
]

export function computeBMR({ weight, height, age, sex }) {
  if (!weight || !height || !age) return null
  const base = 10 * weight + 6.25 * height - 5 * age
  return round(sex === 'female' ? base - 161 : base + 5)
}

export function computeInitialTDEE(settings, weight) {
  if (settings.manualTDEE > 0) return settings.manualTDEE
  const bmr = computeBMR({
    weight: weight || settings.startWeight,
    height: settings.height,
    age: settings.age,
    sex: settings.sex,
  })
  if (!bmr) return 2400
  return round(bmr * (settings.activityLevel || 1.375))
}

export function getQualityLevel(score) {
  if (score >= 80) return 'elevee'
  if (score >= 60) return 'bonne'
  if (score >= 40) return 'moyenne'
  return 'faible'
}

export function getQualityLabel(score) {
  const level = getQualityLevel(score)
  if (level === 'elevee') return 'Elevee'
  if (level === 'bonne') return 'Bonne'
  if (level === 'moyenne') return 'Moyenne'
  return 'Faible'
}

export function assessLogQuality(logs, windowDays = 21) {
  const recent = getRecentLogs(logs, windowDays)
  if (!recent.length) {
    return {
      score: 0,
      level: 'faible',
      label: 'Faible',
      windowDays,
      loggedDays: 0,
      weightDays: 0,
      kcalDays: 0,
      completeDays: 0,
      recentCompleteStreak: 0,
      recencyGapDays: null,
      isReady: false,
    }
  }

  const loggedDays = recent.length
  const weightDays = recent.filter((log) => log.weight != null).length
  const kcalDays = recent.filter((log) => log.totalKcal != null).length
  const completeDays = recent.filter((log) => log.weight != null && log.totalKcal != null).length
  const weightCoverage = weightDays / windowDays
  const kcalCoverage = kcalDays / windowDays
  const completeCoverage = completeDays / windowDays
  const latestTs = toDayTs(recent[recent.length - 1].date)
  const todayMiddayTs = toDayTs(todayStr())
  const recencyGapDays = latestTs != null && todayMiddayTs != null
    ? Math.max(0, daysBetween(latestTs, todayMiddayTs))
    : null
  const recencyScore =
    recencyGapDays == null ? 0 :
      recencyGapDays <= 1 ? 1 :
        recencyGapDays <= 3 ? 0.75 :
          recencyGapDays <= 7 ? 0.4 : 0.1
  const recentCompleteStreak = getRecentCompleteStreak(recent)

  const score = round(
    (weightCoverage * 30) +
    (kcalCoverage * 26) +
    (completeCoverage * 27) +
    ((recentCompleteStreak / 7) * 12) +
    (recencyScore * 5)
  )

  const boundedScore = clamp(score, 0, 100)
  return {
    score: boundedScore,
    level: getQualityLevel(boundedScore),
    label: getQualityLabel(boundedScore),
    windowDays,
    loggedDays,
    weightDays,
    kcalDays,
    completeDays,
    recentCompleteStreak,
    recencyGapDays,
    isReady: boundedScore >= 60 && completeDays >= 10,
  }
}

export function computeAdaptiveTDEEAnalysis(logs, fallbackTDEE) {
  const quality = assessLogQuality(logs, 21)
  const recentLogs = getRecentLogs(logs, 35)
  const completeEntries = recentLogs
    .filter((log) => log.weight != null && log.totalKcal != null)
    .map((log) => ({
      date: log.date,
      ts: toDayTs(log.date),
      weight: Number(log.weight),
      kcal: Number(log.totalKcal),
    }))

  const filteredWeights = filterOutlierEntries(completeEntries, 'weight')
  const filteredEntries = filterOutlierEntries(
    completeEntries.filter((entry) => filteredWeights.some((kept) => kept.date === entry.date)),
    'kcal',
    3.5
  )

  if (filteredEntries.length < 10) {
    const confidenceScore = clamp(Math.round(quality.score * 0.6), 0, 100)
    return {
      tdee: round(fallbackTDEE),
      rawTdee: null,
      blendedTdee: round(fallbackTDEE),
      avgKcal: null,
      deltaWeight: null,
      spanDays: 0,
      confidenceScore,
      confidenceLabel: getQualityLabel(confidenceScore),
      useAdaptive: false,
      reason: 'not_enough_complete_logs',
      quality,
      sampleCount: filteredEntries.length,
      blendFactor: 0,
    }
  }

  const startBlockSize = Math.max(4, Math.min(6, Math.floor(filteredEntries.length / 3)))
  const endBlockSize = startBlockSize
  const startEntries = filteredEntries.slice(0, startBlockSize)
  const endEntries = filteredEntries.slice(-endBlockSize)

  const startWeight = mean(startEntries.map((entry) => entry.weight))
  const endWeight = mean(endEntries.map((entry) => entry.weight))
  const avgKcal = mean(filteredEntries.map((entry) => entry.kcal))
  const startTs = startEntries[0]?.ts ?? null
  const endTs = endEntries[endEntries.length - 1]?.ts ?? null
  const spanDays = daysBetween(startTs, endTs)

  if (!Number.isFinite(startWeight) || !Number.isFinite(endWeight) || !Number.isFinite(avgKcal) || spanDays < 14) {
    const confidenceScore = clamp(Math.round(quality.score * 0.65), 0, 100)
    return {
      tdee: round(fallbackTDEE),
      rawTdee: null,
      blendedTdee: round(fallbackTDEE),
      avgKcal: Number.isFinite(avgKcal) ? round(avgKcal) : null,
      deltaWeight: Number.isFinite(startWeight) && Number.isFinite(endWeight)
        ? round1(endWeight - startWeight)
        : null,
      spanDays,
      confidenceScore,
      confidenceLabel: getQualityLabel(confidenceScore),
      useAdaptive: false,
      reason: 'not_enough_time_span',
      quality,
      sampleCount: filteredEntries.length,
      blendFactor: 0,
    }
  }

  const deltaWeight = endWeight - startWeight
  const dailyImbalance = (deltaWeight * 7700) / spanDays
  const rawTdee = clamp(round(avgKcal - dailyImbalance), 1200, 5500)
  const sampleScore = clamp((filteredEntries.length / 24) * 100, 0, 100)
  const spanScore = clamp((spanDays / 35) * 100, 0, 100)
  const signalScore = clamp((Math.abs(deltaWeight) / 1.2) * 100, 25, 100)
  const confidenceScore = round(
    (quality.score * 0.5) +
    (sampleScore * 0.2) +
    (spanScore * 0.15) +
    (signalScore * 0.15)
  )
  const boundedConfidence = clamp(confidenceScore, 0, 100)
  const blendFactor = boundedConfidence >= 45
    ? clamp((boundedConfidence - 35) / 65, 0.15, 0.92)
    : 0
  const blendedTdee = round((fallbackTDEE * (1 - blendFactor)) + (rawTdee * blendFactor))
  const useAdaptive = boundedConfidence >= 60 && quality.isReady

  return {
    tdee: useAdaptive ? blendedTdee : round(fallbackTDEE),
    rawTdee,
    blendedTdee,
    avgKcal: round(avgKcal),
    deltaWeight: round1(deltaWeight),
    spanDays,
    confidenceScore: boundedConfidence,
    confidenceLabel: getQualityLabel(boundedConfidence),
    useAdaptive,
    reason: useAdaptive ? 'adaptive' : 'low_confidence',
    quality,
    sampleCount: filteredEntries.length,
    blendFactor: round1(blendFactor),
  }
}

export function computeAdaptiveTDEE(logs, fallbackTDEE) {
  return computeAdaptiveTDEEAnalysis(logs, fallbackTDEE).tdee
}

export function computeWeightTrendAnalysis(logs, windowDays = 42) {
  const smoothed = getRollingAvgWeight(getRecentLogs(logs, windowDays), 7)
    .filter((entry) => entry.rollingAvg != null)

  if (smoothed.length < 8) {
    return {
      isReady: false,
      sampleCount: smoothed.length,
      spanDays: 0,
      slopePerDay: 0,
      weeklyChange: 0,
      lossPerWeek: 0,
      r2: 0,
    }
  }

  const firstTs = toDayTs(smoothed[0].date)
  const points = smoothed.map((entry) => ({
    x: daysBetween(firstTs, toDayTs(entry.date)),
    y: entry.rollingAvg,
  }))
  const fit = linearRegression(points)
  if (!fit) {
    return {
      isReady: false,
      sampleCount: smoothed.length,
      spanDays: 0,
      slopePerDay: 0,
      weeklyChange: 0,
      lossPerWeek: 0,
      r2: 0,
    }
  }

  const spanDays = points[points.length - 1].x - points[0].x
  const weeklyChange = fit.slope * 7
  const lossPerWeek = -weeklyChange

  return {
    isReady: smoothed.length >= 10 && spanDays >= 14,
    sampleCount: smoothed.length,
    spanDays,
    slopePerDay: fit.slope,
    weeklyChange: round1(weeklyChange),
    lossPerWeek: round1(lossPerWeek),
    r2: round1(fit.r2),
    startWeight: smoothed[0].rollingAvg,
    endWeight: smoothed[smoothed.length - 1].rollingAvg,
  }
}

export function computeGoalRatePlan(settings, currentWeight, quality, options = {}) {
  const bw = currentWeight || settings.startWeight
  const bmiValue = options.bmi ?? computeBMI(bw, settings.height)?.bmi ?? null
  const remainingKg = Math.max(0, bw - settings.goalWeight)
  const desiredWeeklyLoss = clamp(Number(settings.weeklyLoss) || 0.5, 0.1, 2)

  if (remainingKg <= 0) {
    return {
      mode: 'maintenance',
      remainingKg: 0,
      desiredWeeklyLoss,
      effectiveWeeklyLoss: 0,
      maxRecommendedWeeklyLoss: 0,
      qualityScale: 1,
      reason: 'goal_reached',
    }
  }

  const percentCap = bw * 0.01
  const bmiCap =
    bmiValue == null ? desiredWeeklyLoss :
      bmiValue < 20 ? 0.1 :
        bmiValue < 22 ? 0.2 :
          bmiValue < 25 ? 0.35 :
            bmiValue < 30 ? 0.65 : 1.0
  const proximityCap =
    remainingKg < 1 ? 0.08 :
      remainingKg < 2 ? 0.12 :
        remainingKg < 4 ? 0.25 :
          remainingKg < 6 ? 0.4 : desiredWeeklyLoss
  const maxRecommendedWeeklyLoss = Math.min(desiredWeeklyLoss, percentCap, bmiCap, proximityCap)
  const qualityScale =
    quality?.score >= 80 ? 1 :
      quality?.score >= 60 ? 0.96 :
        quality?.score >= 40 ? 0.9 : 0.82

  const effectiveWeeklyLoss = clamp(
    maxRecommendedWeeklyLoss * qualityScale,
    0.05,
    desiredWeeklyLoss
  )

  const mode =
    effectiveWeeklyLoss <= 0.05 ? 'maintenance' :
      effectiveWeeklyLoss < (desiredWeeklyLoss * 0.85) ? 'softened' : 'as_requested'

  let reason = 'goal_requested'
  if (mode === 'softened') {
    if (remainingKg < 4) reason = 'goal_is_close'
    else if (bmiValue != null && bmiValue < 25) reason = 'leaner_profile'
    else if ((quality?.score ?? 0) < 60) reason = 'low_confidence_signal'
    else reason = 'safety_guardrails'
  }

  return {
    mode,
    reason,
    remainingKg: round1(remainingKg),
    desiredWeeklyLoss: round1(desiredWeeklyLoss),
    effectiveWeeklyLoss: round1(effectiveWeeklyLoss),
    maxRecommendedWeeklyLoss: round1(maxRecommendedWeeklyLoss),
    qualityScale: round1(qualityScale),
  }
}

export function computeTargets(tdee, settings, currentWeight, options = {}) {
  const bw = currentWeight || settings.startWeight
  const bmr = options.bmr ?? computeBMR({
    weight: bw,
    height: settings.height,
    age: settings.age,
    sex: settings.sex,
  })
  const bmi = computeBMI(bw, settings.height)
  const quality = options.quality ?? assessLogQuality(options.logs ?? [])
  const goalPlan = computeGoalRatePlan(settings, bw, quality, { bmi: bmi?.bmi ?? null })

  const desiredDeficitDay = round((goalPlan.desiredWeeklyLoss * 7700) / 7)
  const deficitDay = round((goalPlan.effectiveWeeklyLoss * 7700) / 7)
  const sexFloor = settings.sex === 'female' ? 1200 : 1400
  const bmrFloor = bmr ? round(bmr * 0.85) : sexFloor
  const kcalFloor = Math.max(sexFloor, bmrFloor)
  const rawTargetKcal = round(tdee - deficitDay)
  const targetKcal = Math.max(kcalFloor, rawTargetKcal)
  const actualDeficitDay = Math.max(0, round(tdee - targetKcal))
  const actualWeeklyLoss = round1((actualDeficitDay * 7) / 7700)
  const deficitPct = tdee > 0 ? actualDeficitDay / tdee : 0

  let proteinFloorPerKg = 1.8
  if (deficitPct >= 0.24 || actualWeeklyLoss >= 0.9) proteinFloorPerKg = 2.4
  else if (deficitPct >= 0.18 || actualWeeklyLoss >= 0.7) proteinFloorPerKg = 2.2
  else if (deficitPct >= 0.12 || actualWeeklyLoss >= 0.45) proteinFloorPerKg = 2.0
  if ((bmi?.bmi ?? 0) >= 30) proteinFloorPerKg = Math.max(proteinFloorPerKg, 2.0)
  if (goalPlan.remainingKg < 3) proteinFloorPerKg = Math.max(proteinFloorPerKg, 2.0)

  const proteinPerKgApplied = Math.max(settings.proteinPerKg, proteinFloorPerKg)
  let protein = round(bw * proteinPerKgApplied)

  const fatFloorPerKg = settings.sex === 'female' ? 0.7 : 0.6
  const fatFloor = round(bw * fatFloorPerKg)
  let fat = round(Math.max((targetKcal * (settings.fatPercent / 100)) / 9, fatFloor))
  let carbs = round((targetKcal - (protein * 4) - (fat * 9)) / 4)

  const carbsComfortFloor = deficitPct >= 0.2 ? 25 : 40
  if (carbs < carbsComfortFloor && fat > fatFloor) {
    const missingCarbKcal = (carbsComfortFloor - carbs) * 4
    const reducibleFatGrams = Math.max(0, fat - fatFloor)
    const fatShift = Math.min(reducibleFatGrams, Math.ceil(missingCarbKcal / 9))
    fat -= fatShift
    carbs = round((targetKcal - (protein * 4) - (fat * 9)) / 4)
  }
  carbs = Math.max(0, carbs)

  return {
    targetKcal,
    protein,
    fat,
    carbs,
    deficitDay: actualDeficitDay,
    desiredDeficitDay,
    desiredWeeklyLoss: goalPlan.desiredWeeklyLoss,
    effectiveWeeklyLoss: actualWeeklyLoss,
    kcalFloor,
    deficitPct: round1(deficitPct * 100),
    proteinPerKgApplied: round1(proteinPerKgApplied),
    fatFloor,
    fatFloorPerKg: round1(fatFloorPerKg),
    carbsComfortFloor,
    goalPlan,
  }
}

export function computeForecast(logs, settings, currentWeight, targets, quality, energyModel) {
  const today = todayStr()
  const remainingKg = Math.max(0, currentWeight - settings.goalWeight)
  const trend = computeWeightTrendAnalysis(logs, 42)

  if (remainingKg <= 0) {
    return {
      status: 'goal_reached',
      label: 'Objectif atteint',
      remainingKg: 0,
      observedLossPerWeek: trend.lossPerWeek ?? 0,
      projectedLossPerWeek: 0,
      etaWeeks: 0,
      etaDate: today,
      etaLabel: formatEtaDate(today),
      confidenceLabel: energyModel?.confidenceLabel ?? quality?.label ?? 'Faible',
      trend,
    }
  }

  const targetLossPerWeek = targets.effectiveWeeklyLoss
  const observedLossPerWeek = trend.isReady ? trend.lossPerWeek : null
  const confidenceBlend = clamp(((energyModel?.confidenceScore ?? quality?.score ?? 0) - 30) / 70, 0.15, 0.8)

  let projectedLossPerWeek = targetLossPerWeek
  let status = 'target_driven'
  if (trend.isReady && observedLossPerWeek != null) {
    projectedLossPerWeek = round1(
      (observedLossPerWeek * confidenceBlend) + (targetLossPerWeek * (1 - confidenceBlend))
    )
    status = observedLossPerWeek <= 0.05
      ? 'plateau'
      : observedLossPerWeek < (targetLossPerWeek * 0.6)
        ? 'slower_than_target'
        : 'on_track'
  } else if ((quality?.score ?? 0) < 40) {
    projectedLossPerWeek = round1(targetLossPerWeek * 0.85)
    status = 'low_confidence'
  }

  if (!Number.isFinite(projectedLossPerWeek) || projectedLossPerWeek <= 0.05) {
    return {
      status: 'plateau',
      label: 'Projection trop fragile',
      remainingKg: round1(remainingKg),
      observedLossPerWeek,
      projectedLossPerWeek: Math.max(0, projectedLossPerWeek || 0),
      etaWeeks: null,
      etaDate: null,
      etaLabel: null,
      confidenceLabel: energyModel?.confidenceLabel ?? quality?.label ?? 'Faible',
      trend,
    }
  }

  const etaWeeks = round1(remainingKg / projectedLossPerWeek)
  const etaDays = Math.max(1, Math.round(etaWeeks * 7))
  const etaDate = addDays(today, etaDays)

  return {
    status,
    label:
      status === 'on_track' ? 'Rythme coherent' :
        status === 'slower_than_target' ? 'Plus lent que la cible' :
          status === 'low_confidence' ? 'Projection prudente' :
            'Projection basee sur la cible',
    remainingKg: round1(remainingKg),
    observedLossPerWeek,
    projectedLossPerWeek,
    etaWeeks,
    etaDate,
    etaLabel: formatEtaDate(etaDate),
    confidenceLabel: energyModel?.confidenceLabel ?? quality?.label ?? 'Faible',
    trend,
  }
}

export function computeNutritionPipeline({ settings, logs, currentWeight }) {
  const bmr = computeBMR({
    weight: currentWeight || settings.startWeight,
    height: settings.height,
    age: settings.age,
    sex: settings.sex,
  })
  const initialTDEE = computeInitialTDEE(settings, currentWeight)
  const quality = assessLogQuality(logs)
  const energyModel = computeAdaptiveTDEEAnalysis(logs, initialTDEE)
  const targets = computeTargets(energyModel.tdee, settings, currentWeight, {
    quality,
    logs,
    bmr,
  })
  const forecast = computeForecast(logs, settings, currentWeight, targets, quality, energyModel)

  return {
    bmr,
    initialTDEE,
    quality,
    energyModel,
    targets,
    forecast,
  }
}

export function getRollingAvgWeight(logs, window = 7) {
  const sorted = sortLogs(logs)
  return sorted.map((log, index) => {
    const slice = sorted.slice(Math.max(0, index - window + 1), index + 1)
    const weights = slice.map((entry) => entry.weight).filter((value) => value != null)
    const avg = weights.length > 0 ? weights.reduce((sum, value) => sum + value, 0) / weights.length : null
    return {
      date: log.date,
      weight: log.weight,
      rollingAvg: avg != null ? round1(avg) : null,
    }
  })
}

export function dataQuality(logs) {
  return assessLogQuality(logs).score
}

export function computeBMI(weight, height) {
  if (!weight || !height) return null
  const bmi = weight / ((height / 100) ** 2)
  let cat = ''
  if (bmi < 18.5) cat = 'Maigreur'
  else if (bmi < 25) cat = 'Normale'
  else if (bmi < 30) cat = 'Surpoids'
  else if (bmi < 35) cat = 'Obesite I'
  else if (bmi < 40) cat = 'Obesite II'
  else cat = 'Obesite III'
  return { bmi: round1(bmi), cat }
}

export function idealWeight(height, sex) {
  if (!height) return null
  const base = sex === 'female'
    ? height - 100 - (height - 150) / 2
    : height - 100 - (height - 150) / 4
  return round1(base)
}
