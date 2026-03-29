const FALLBACK_PROFILE = {
  name: 'Plat melange',
  per100: { kcal: 180, protein: 8, carbs: 18, fat: 8 },
}

const FOOD_PRIORS = {
  'apple pie':            { name: 'Tarte aux pommes', per100: { kcal: 237, protein: 2.4, carbs: 34, fat: 11 } },
  baklava:                { name: 'Baklava', per100: { kcal: 428, protein: 6, carbs: 48, fat: 24 } },
  bibimbap:               { name: 'Bibimbap', per100: { kcal: 149, protein: 6, carbs: 20, fat: 5 } },
  'caesar salad':         { name: 'Salade Caesar', per100: { kcal: 190, protein: 7, carbs: 7, fat: 15 } },
  'caprese salad':        { name: 'Salade caprese', per100: { kcal: 170, protein: 9, carbs: 4, fat: 13 } },
  'carrot cake':          { name: 'Carrot cake', per100: { kcal: 408, protein: 4, carbs: 47, fat: 23 } },
  ceviche:                { name: 'Ceviche', per100: { kcal: 117, protein: 18, carbs: 5, fat: 3 } },
  cheesecake:             { name: 'Cheesecake', per100: { kcal: 321, protein: 6, carbs: 25, fat: 23 } },
  'chicken curry':        { name: 'Poulet curry', per100: { kcal: 174, protein: 15, carbs: 7, fat: 10 } },
  'chicken wings':        { name: 'Ailes de poulet', per100: { kcal: 260, protein: 24, carbs: 4, fat: 16 } },
  'chocolate cake':       { name: 'Gateau chocolat', per100: { kcal: 371, protein: 5, carbs: 53, fat: 15 } },
  churros:                { name: 'Churros', per100: { kcal: 425, protein: 6, carbs: 52, fat: 22 } },
  'club sandwich':        { name: 'Club sandwich', per100: { kcal: 235, protein: 12, carbs: 22, fat: 11 } },
  croissant:              { name: 'Croissant', per100: { kcal: 406, protein: 8, carbs: 45, fat: 21 } },
  donuts:                 { name: 'Donut', per100: { kcal: 452, protein: 5, carbs: 51, fat: 25 } },
  dumplings:              { name: 'Raviolis asiatiques', per100: { kcal: 200, protein: 7, carbs: 25, fat: 7 } },
  edamame:                { name: 'Edamame', per100: { kcal: 121, protein: 11, carbs: 9, fat: 5 } },
  falafel:                { name: 'Falafel', per100: { kcal: 333, protein: 13, carbs: 32, fat: 17 } },
  'fish and chips':       { name: 'Fish and chips', per100: { kcal: 232, protein: 11, carbs: 21, fat: 11 } },
  'french fries':         { name: 'Frites', per100: { kcal: 312, protein: 3.4, carbs: 41, fat: 15 } },
  'french onion soup':    { name: 'Soupe a l oignon', per100: { kcal: 78, protein: 2.6, carbs: 8, fat: 4 } },
  'fried rice':           { name: 'Riz saute', per100: { kcal: 174, protein: 4, carbs: 28, fat: 5 } },
  'frozen yogurt':        { name: 'Frozen yogurt', per100: { kcal: 127, protein: 3.5, carbs: 22, fat: 3 } },
  guacamole:              { name: 'Guacamole', per100: { kcal: 167, protein: 2, carbs: 9, fat: 15 } },
  gyoza:                  { name: 'Gyoza', per100: { kcal: 226, protein: 9, carbs: 26, fat: 9 } },
  hamburger:              { name: 'Hamburger', per100: { kcal: 295, protein: 13, carbs: 30, fat: 14 } },
  'hot dog':              { name: 'Hot dog', per100: { kcal: 278, protein: 11, carbs: 24, fat: 15 } },
  hummus:                 { name: 'Houmous', per100: { kcal: 166, protein: 8, carbs: 14, fat: 10 } },
  lasagna:                { name: 'Lasagnes', per100: { kcal: 146, protein: 8, carbs: 13, fat: 7 } },
  'lobster bisque':       { name: 'Bisque de homard', per100: { kcal: 104, protein: 4, carbs: 8, fat: 6 } },
  'macaroni and cheese':  { name: 'Mac and cheese', per100: { kcal: 164, protein: 6, carbs: 20, fat: 7 } },
  miso:                   { name: 'Soupe miso', per100: { kcal: 35, protein: 2.5, carbs: 3, fat: 1.4 } },
  nachos:                 { name: 'Nachos', per100: { kcal: 343, protein: 9, carbs: 30, fat: 20 } },
  omelette:               { name: 'Omelette', per100: { kcal: 154, protein: 11, carbs: 2, fat: 11 } },
  paella:                 { name: 'Paella', per100: { kcal: 166, protein: 8, carbs: 21, fat: 5 } },
  pancakes:               { name: 'Pancakes', per100: { kcal: 227, protein: 6, carbs: 29, fat: 10 } },
  pho:                    { name: 'Pho', per100: { kcal: 90, protein: 6, carbs: 12, fat: 2 } },
  pizza:                  { name: 'Pizza', per100: { kcal: 266, protein: 11, carbs: 33, fat: 10 } },
  poutine:                { name: 'Poutine', per100: { kcal: 265, protein: 5, carbs: 27, fat: 15 } },
  ramen:                  { name: 'Ramen', per100: { kcal: 97, protein: 4, carbs: 12, fat: 4 } },
  risotto:                { name: 'Risotto', per100: { kcal: 166, protein: 4, carbs: 27, fat: 4 } },
  samosa:                 { name: 'Samosa', per100: { kcal: 308, protein: 6, carbs: 32, fat: 17 } },
  sashimi:                { name: 'Sashimi', per100: { kcal: 127, protein: 22, carbs: 0, fat: 4 } },
  steak:                  { name: 'Steak', per100: { kcal: 271, protein: 26, carbs: 0, fat: 18 } },
  sushi:                  { name: 'Sushi', per100: { kcal: 143, protein: 6, carbs: 22, fat: 3 } },
  tacos:                  { name: 'Tacos', per100: { kcal: 226, protein: 9, carbs: 19, fat: 12 } },
  tiramisu:               { name: 'Tiramisu', per100: { kcal: 283, protein: 4, carbs: 31, fat: 16 } },
  waffles:                { name: 'Gaufres', per100: { kcal: 291, protein: 8, carbs: 33, fat: 14 } },
}

const ALIASES = {
  'beef tartare': 'steak',
  burrito: 'hamburger',
  'chicken quesadilla': 'tacos',
  'chicken sandwich': 'hamburger',
  'eggs benedict': 'omelette',
  'fried calamari': 'fish and chips',
  'garlic bread': 'pizza',
  gnocchi: 'risotto',
  'grilled cheese sandwich': 'club sandwich',
  'grilled salmon': 'sashimi',
  'hot and sour soup': 'miso',
  'ice cream': 'frozen yogurt',
  'lobster roll sandwich': 'club sandwich',
  'onion rings': 'french fries',
  'pork chop': 'steak',
  ravioli: 'dumplings',
  'scallops': 'sashimi',
  'seaweed salad': 'caprese salad',
  'spaghetti bolognese': 'risotto',
  'spaghetti carbonara': 'risotto',
  'spring rolls': 'dumplings',
  'strawberry shortcake': 'cheesecake',
  takoyaki: 'dumplings',
  'tuna tartare': 'sashimi',
}

export function normalizeLabel(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
}

function getPrior(label) {
  if (!label) return null
  if (FOOD_PRIORS[label]) return FOOD_PRIORS[label]
  const alias = ALIASES[label]
  if (alias && FOOD_PRIORS[alias]) return FOOD_PRIORS[alias]

  const broadMatch = Object.keys(FOOD_PRIORS).find((key) => label.includes(key) || key.includes(label))
  if (broadMatch) return FOOD_PRIORS[broadMatch]

  return null
}

export function resolveNutritionMatch(label) {
  const normalized = normalizeLabel(label)
  const prior = getPrior(normalized)
  if (prior) {
    return {
      normalized,
      name: prior.name,
      per100: prior.per100,
      source: 'prior',
    }
  }
  return {
    normalized,
    name: FALLBACK_PROFILE.name,
    per100: FALLBACK_PROFILE.per100,
    source: 'fallback',
  }
}

export function resolveNutritionProfile(label) {
  const result = resolveNutritionMatch(label)
  return { name: result.name, per100: result.per100 }
}

export function round1(value) {
  return Math.round(Number(value) * 10) / 10
}

export function computeMacros(per100, grams) {
  const qty = Number(grams) || 0
  const ratio = qty / 100
  return {
    kcal: Math.round((per100?.kcal ?? 0) * ratio),
    protein: round1((per100?.protein ?? 0) * ratio),
    carbs: round1((per100?.carbs ?? 0) * ratio),
    fat: round1((per100?.fat ?? 0) * ratio),
  }
}

export function suggestPortionFromScore(score) {
  const pct = Number(score) || 0
  if (pct >= 0.8) return 220
  if (pct >= 0.6) return 180
  if (pct >= 0.45) return 150
  return 120
}

const VISION_RULES = [
  { match: ['soup', 'ramen', 'pho', 'miso', 'bisque', 'curry'], vessel: 'bowl', density: 0.95, depthCm: 3.8, referenceArea: 175 },
  { match: ['salad', 'caprese', 'caesar', 'guacamole', 'ceviche'], vessel: 'plate', density: 0.58, depthCm: 2.4, referenceArea: 235 },
  { match: ['pizza', 'pie', 'cake', 'cheesecake', 'tiramisu', 'waffles', 'pancakes', 'croissant', 'donuts', 'baklava', 'churros'], vessel: 'plate', density: 0.62, depthCm: 2.2, referenceArea: 215 },
  { match: ['hamburger', 'club sandwich', 'hot dog', 'tacos'], vessel: 'handheld', density: 0.78, depthCm: 4.2, referenceArea: 120 },
  { match: ['sushi', 'sashimi', 'dumplings', 'gyoza'], vessel: 'plate', density: 0.88, depthCm: 2.2, referenceArea: 180 },
  { match: ['steak', 'paella', 'risotto', 'lasagna', 'macaroni', 'fried rice', 'bibimbap'], vessel: 'plate', density: 0.92, depthCm: 2.8, referenceArea: 210 },
]

function inferVisionRule(label, per100) {
  const normalized = normalizeLabel(label)
  const matched = VISION_RULES.find((rule) => rule.match.some((token) => normalized.includes(token)))
  if (matched) return matched

  const kcal = Number(per100?.kcal ?? 0)
  const protein = Number(per100?.protein ?? 0)
  const carbs = Number(per100?.carbs ?? 0)
  const fat = Number(per100?.fat ?? 0)

  if (kcal <= 90 && protein <= 8 && fat <= 5) {
    return { vessel: 'bowl', density: 0.96, depthCm: 3.6, referenceArea: 180 }
  }
  if (fat >= 16 && carbs >= 25) {
    return { vessel: 'plate', density: 0.7, depthCm: 2.5, referenceArea: 200 }
  }
  if (protein >= 18 && carbs <= 10) {
    return { vessel: 'plate', density: 0.98, depthCm: 2.4, referenceArea: 170 }
  }
  return { vessel: 'plate', density: 0.82, depthCm: 2.6, referenceArea: 205 }
}

export function estimateVolumeFromVision(label, per100, vision = {}) {
  const rule = inferVisionRule(label, per100)
  const coverage = Math.max(0.12, Math.min(0.95, Number(vision.coverage) || 0.45))
  const depthStrength = Math.max(0.2, Math.min(1, Number(vision.depthStrength) || 0.5))
  const compactness = Math.max(0.25, Math.min(1, Number(vision.compactness) || 0.7))
  const volumeScore = Math.max(0.2, Math.min(1.05, Number(vision.volumeScore) || 0.5))

  const effectiveArea = rule.referenceArea * coverage * (0.9 + (compactness * 0.25))
  const effectiveDepth = rule.depthCm * (0.7 + (depthStrength * 0.75))
  const volumeMl = effectiveArea * effectiveDepth * volumeScore / 1.75

  return {
    vessel: rule.vessel,
    density: rule.density,
    referenceArea: rule.referenceArea,
    depthCm: round1(effectiveDepth),
    volumeMl: Math.max(40, Math.round(volumeMl)),
  }
}

export function estimatePortionFromVision(label, per100, confidence, vision = {}) {
  const volume = estimateVolumeFromVision(label, per100, vision)
  const confidenceFactor = 0.82 + (Math.max(0, Math.min(1, Number(confidence) || 0)) * 0.36)
  const gramsFromVolume = volume.volumeMl * volume.density * confidenceFactor
  const scoreFallback = suggestPortionFromScore(confidence)
  const blendedGrams = Math.round((gramsFromVolume * 0.72) + (scoreFallback * 0.28))

  return {
    grams: Math.max(60, Math.min(900, blendedGrams)),
    volumeMl: volume.volumeMl,
    density: volume.density,
    vessel: volume.vessel,
    depthCm: volume.depthCm,
  }
}
