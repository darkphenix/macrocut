import { toDateKey } from '../date'
import { MEAL_DISTRIBUTION, MEAL_SLOTS, MEAL_TEMPLATES, PORTION_OPTIONS, SLOT_LABELS } from './templates'
import { fetchPackHintFromOpenFoodFacts } from './offEnrichment'

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function getDefaultHousehold() {
  return {
    adults: 2,
    children: 0,
    childFactor: 0.65,
  }
}

export function sanitizeHousehold(input) {
  const current = input ?? {}
  return {
    adults: clamp(Math.round(Number(current.adults) || 2), 1, 8),
    children: clamp(Math.round(Number(current.children) || 0), 0, 8),
    childFactor: round2(clamp(Number(current.childFactor) || 0.65, 0.3, 1)),
  }
}

export function householdEquivalentServings(household, servings = 1) {
  const safe = sanitizeHousehold(household)
  return round2((safe.adults + safe.children * safe.childFactor) * (Number(servings) || 1))
}

export function getSlotTarget(targets, slot) {
  const ratio = MEAL_DISTRIBUTION[slot] ?? MEAL_DISTRIBUTION.lunch
  return {
    kcal: Math.round((targets?.targetKcal ?? 0) * ratio.kcal),
    protein: round1((targets?.protein ?? 0) * ratio.protein),
    carbs: round1((targets?.carbs ?? 0) * ratio.carbs),
    fat: round1((targets?.fat ?? 0) * ratio.fat),
  }
}

function getTemplatesForSlot(slot) {
  return MEAL_TEMPLATES.filter((template) => template.slot === slot)
}

function totalAdultWeight(template, servings = 1) {
  const base = template.ingredients
    .filter((ingredient) => ingredient.unit === 'g' || ingredient.unit === 'ml')
    .reduce((sum, ingredient) => sum + ingredient.qty, 0)
  return Math.round(base * (Number(servings) || 1))
}

function scoreTemplate(template, slotTarget, portionMultiplier, penalties = {}) {
  const actual = {
    kcal: template.perServingMacros.kcal * portionMultiplier,
    protein: template.perServingMacros.protein * portionMultiplier,
    carbs: template.perServingMacros.carbs * portionMultiplier,
    fat: template.perServingMacros.fat * portionMultiplier,
  }

  let score =
    Math.abs(actual.kcal - slotTarget.kcal) / Math.max(slotTarget.kcal || 200, 200) +
    (Math.abs(actual.protein - slotTarget.protein) / Math.max(slotTarget.protein || 12, 12)) * 1.4 +
    (Math.abs(actual.carbs - slotTarget.carbs) / Math.max(slotTarget.carbs || 20, 20)) * 0.5 +
    (Math.abs(actual.fat - slotTarget.fat) / Math.max(slotTarget.fat || 8, 8)) * 0.4

  if (penalties.previousId && penalties.previousId === template.id) score += 1.2
  if (penalties.recentIds?.includes(template.id)) score += 0.45
  if (penalties.recentDinnerId && penalties.slot === 'dinner' && penalties.recentDinnerId === template.id) score += 0.8

  return score
}

function buildPlannedMeal(template, household, servings = 1) {
  const safeServings = round2(clamp(Number(servings) || 1, 0.8, 2))
  const householdServings = householdEquivalentServings(household, safeServings)
  const ingredients = template.ingredients.map((ingredient) => ({
    ...ingredient,
    scaledQty: round1(ingredient.qty * householdServings),
  }))
  const sourceMeta = ingredients.some((ingredient) => ingredient.packSource)
    ? ingredients.every((ingredient) => ingredient.packSource) ? 'off-enriched' : 'mixed'
    : 'local'

  return {
    templateId: template.id,
    slot: template.slot,
    slotLabel: SLOT_LABELS[template.slot],
    title: template.title,
    servings: safeServings,
    householdServings,
    ingredients,
    perServingMacros: { ...template.perServingMacros },
    scaledMacros: {
      kcal: Math.round(template.perServingMacros.kcal * householdServings),
      protein: round1(template.perServingMacros.protein * householdServings),
      carbs: round1(template.perServingMacros.carbs * householdServings),
      fat: round1(template.perServingMacros.fat * householdServings),
    },
    adultServingMacros: {
      kcal: Math.round(template.perServingMacros.kcal * safeServings),
      protein: round1(template.perServingMacros.protein * safeServings),
      carbs: round1(template.perServingMacros.carbs * safeServings),
      fat: round1(template.perServingMacros.fat * safeServings),
    },
    adultServingWeight: totalAdultWeight(template, safeServings),
    sourceMeta,
  }
}

export function scaleMeal(meal, household, servings = meal?.servings ?? 1) {
  const template = MEAL_TEMPLATES.find((entry) => entry.id === meal?.templateId)
  if (!template) return meal

  const base = buildPlannedMeal(template, household, servings)
  const previousIngredients = Array.isArray(meal?.ingredients) ? meal.ingredients : []
  const byName = new Map(previousIngredients.map((ingredient) => [normalizeName(ingredient.name), ingredient]))

  return {
    ...base,
    ingredients: base.ingredients.map((ingredient) => {
      const previous = byName.get(normalizeName(ingredient.name))
      return previous?.packSize
        ? {
            ...ingredient,
            packSize: previous.packSize,
            packUnit: previous.packUnit,
            packLabel: previous.packLabel,
            packSource: previous.packSource,
          }
        : ingredient
    }),
    sourceMeta:
      previousIngredients.some((ingredient) => ingredient.packSource)
        ? 'mixed'
        : base.sourceMeta,
  }
}

export function generateRandomMeal({ targets, slot, household, previousMeal = null, recentIds = [] }) {
  const templates = getTemplatesForSlot(slot)
  const slotTarget = getSlotTarget(targets, slot)

  const ranked = templates.flatMap((template) =>
    PORTION_OPTIONS.map((servings) => ({
      template,
      servings,
      score: scoreTemplate(template, slotTarget, servings, {
        previousId: previousMeal?.templateId ?? null,
        recentIds,
        slot,
      }),
    }))
  )
    .sort((a, b) => a.score - b.score)

  const shortlist = ranked.slice(0, Math.min(4, ranked.length))
  const choice = shortlist[Math.floor(Math.random() * shortlist.length)] ?? ranked[0]
  if (!choice) return null

  return buildPlannedMeal(choice.template, household, choice.servings)
}

export function createEmptyWeekPlan() {
  const today = new Date()
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    return {
      date: toDateKey(date),
      breakfast: null,
      lunch: null,
      dinner: null,
      snack: null,
    }
  })
}

export function generateWeekPlan({ targets, household }) {
  const weekPlan = createEmptyWeekPlan()
  const recentBySlot = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  }

  for (let index = 0; index < weekPlan.length; index++) {
    const previousDay = weekPlan[index - 1] ?? null
    const day = { ...weekPlan[index] }

    MEAL_SLOTS.forEach((slot) => {
      const meal = generateRandomMeal({
        targets,
        slot,
        household,
        previousMeal: previousDay?.[slot] ?? null,
        recentIds: recentBySlot[slot],
      })
      day[slot] = meal
      recentBySlot[slot] = [...recentBySlot[slot].slice(-2), meal?.templateId].filter(Boolean)
    })

    weekPlan[index] = day
  }

  return weekPlan
}

function computePackEstimate(quantity, unit, ingredient) {
  if (!ingredient?.packSize || ingredient.packUnit !== unit) return null
  if (!Number.isFinite(Number(quantity)) || quantity <= 0) return null
  return round2(quantity / ingredient.packSize)
}

export function computeShoppingSummary(weekPlan = []) {
  const lines = new Map()

  weekPlan.forEach((day) => {
    MEAL_SLOTS.forEach((slot) => {
      const meal = day?.[slot]
      ;(meal?.ingredients ?? []).forEach((ingredient) => {
        const key = `${normalizeName(ingredient.name)}__${ingredient.unit}`
        const current = lines.get(key) ?? {
          name: ingredient.name,
          unit: ingredient.unit,
          qty: 0,
          packSize: ingredient.packSize ?? null,
          packUnit: ingredient.packUnit ?? null,
          packLabel: ingredient.packLabel ?? null,
        }
        current.qty = round1(current.qty + (Number(ingredient.scaledQty) || 0))
        current.packSize = current.packSize ?? ingredient.packSize ?? null
        current.packUnit = current.packUnit ?? ingredient.packUnit ?? null
        current.packLabel = current.packLabel ?? ingredient.packLabel ?? null
        lines.set(key, current)
      })
    })
  })

  return Array.from(lines.values())
    .map((line) => ({
      ...line,
      estimatedPacks: computePackEstimate(line.qty, line.unit, line),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export async function enrichMealPackHints(meal) {
  if (!meal) return meal

  const nextIngredients = await Promise.all(
    (meal.ingredients ?? []).map(async (ingredient) => {
      if (!ingredient.offTerm || ingredient.packSize) return ingredient
      const packHint = await fetchPackHintFromOpenFoodFacts(ingredient.offTerm)
      if (!packHint) return ingredient
      return {
        ...ingredient,
        packSize: packHint.packSize,
        packUnit: packHint.packUnit,
        packLabel: packHint.packLabel,
        packSource: packHint.source,
      }
    })
  )

  const hasPack = nextIngredients.some((ingredient) => ingredient.packSource)
  return {
    ...meal,
    ingredients: nextIngredients,
    sourceMeta: hasPack ? 'mixed' : meal.sourceMeta,
  }
}

export async function enrichWeekPlanPackHints(weekPlan = []) {
  const nextPlan = []
  for (const day of weekPlan) {
    const nextDay = { ...day }
    for (const slot of MEAL_SLOTS) {
      nextDay[slot] = await enrichMealPackHints(day?.[slot] ?? null)
    }
    nextPlan.push(nextDay)
  }
  return nextPlan
}
