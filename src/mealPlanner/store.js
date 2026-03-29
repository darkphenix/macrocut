import { computeShoppingSummary, createEmptyWeekPlan, getDefaultHousehold, sanitizeHousehold } from './generator'

export const MEAL_PLAN_KEY = 'coupure_meal_plan_v1'

function getDefaultState() {
  return {
    household: getDefaultHousehold(),
    weekPlan: createEmptyWeekPlan(),
    randomSuggestion: null,
  }
}

function sanitizeIngredient(input) {
  const ingredient = input ?? {}
  return {
    name: String(ingredient.name ?? 'Ingredient'),
    qty: Number(ingredient.qty) || 0,
    scaledQty: Number(ingredient.scaledQty) || 0,
    unit: String(ingredient.unit ?? 'g'),
    offTerm: typeof ingredient.offTerm === 'string' ? ingredient.offTerm : null,
    packSize: Number.isFinite(Number(ingredient.packSize)) ? Number(ingredient.packSize) : null,
    packUnit: typeof ingredient.packUnit === 'string' ? ingredient.packUnit : null,
    packLabel: typeof ingredient.packLabel === 'string' ? ingredient.packLabel : null,
    packSource: typeof ingredient.packSource === 'string' ? ingredient.packSource : null,
  }
}

function sanitizeMeal(input) {
  if (!input || typeof input !== 'object') return null
  return {
    templateId: typeof input.templateId === 'string' ? input.templateId : 'unknown',
    title: String(input.title ?? 'Repas'),
    slot: typeof input.slot === 'string' ? input.slot : 'lunch',
    slotLabel: typeof input.slotLabel === 'string' ? input.slotLabel : 'Repas',
    servings: Number(input.servings) || 1,
    householdServings: Number(input.householdServings) || 1,
    ingredients: Array.isArray(input.ingredients) ? input.ingredients.map(sanitizeIngredient) : [],
    perServingMacros: {
      kcal: Number(input?.perServingMacros?.kcal) || 0,
      protein: Number(input?.perServingMacros?.protein) || 0,
      carbs: Number(input?.perServingMacros?.carbs) || 0,
      fat: Number(input?.perServingMacros?.fat) || 0,
    },
    scaledMacros: {
      kcal: Number(input?.scaledMacros?.kcal) || 0,
      protein: Number(input?.scaledMacros?.protein) || 0,
      carbs: Number(input?.scaledMacros?.carbs) || 0,
      fat: Number(input?.scaledMacros?.fat) || 0,
    },
    adultServingMacros: {
      kcal: Number(input?.adultServingMacros?.kcal) || 0,
      protein: Number(input?.adultServingMacros?.protein) || 0,
      carbs: Number(input?.adultServingMacros?.carbs) || 0,
      fat: Number(input?.adultServingMacros?.fat) || 0,
    },
    adultServingWeight: Number(input?.adultServingWeight) || 0,
    sourceMeta: typeof input.sourceMeta === 'string' ? input.sourceMeta : 'local',
  }
}

function sanitizeDay(input) {
  const day = input ?? {}
  return {
    date: typeof day.date === 'string' ? day.date : '',
    breakfast: sanitizeMeal(day.breakfast),
    lunch: sanitizeMeal(day.lunch),
    dinner: sanitizeMeal(day.dinner),
    snack: sanitizeMeal(day.snack),
  }
}

function sanitizeState(input) {
  const state = input ?? {}
  const base = getDefaultState()
  const weekPlan = Array.isArray(state.weekPlan) && state.weekPlan.length
    ? state.weekPlan.map(sanitizeDay)
    : base.weekPlan

  return {
    household: sanitizeHousehold(state.household),
    weekPlan,
    randomSuggestion: sanitizeMeal(state.randomSuggestion),
  }
}

export function loadMealPlanState() {
  try {
    const raw = localStorage.getItem(MEAL_PLAN_KEY)
    return raw ? sanitizeState(JSON.parse(raw)) : getDefaultState()
  } catch {
    return getDefaultState()
  }
}

export function saveMealPlanState(state) {
  localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(sanitizeState(state)))
}

export function deriveMealPlanSummary(state) {
  const safe = sanitizeState(state)
  return {
    ...safe,
    shoppingSummary: computeShoppingSummary(safe.weekPlan),
  }
}
