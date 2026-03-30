function readEnvFlag(name, fallback = false) {
  const raw = import.meta.env?.[name]
  if (raw == null) return fallback
  const normalized = String(raw).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function readEnvNumber(name, fallback) {
  const raw = Number(import.meta.env?.[name])
  return Number.isFinite(raw) ? raw : fallback
}

function readEnvString(names, fallback) {
  for (const name of names) {
    const value = import.meta.env?.[name]
    if (value != null && String(value).trim()) return String(value).trim()
  }
  return fallback
}

export const ENABLE_VISION_FOOD = readEnvFlag(
  'VITE_ENABLE_VISION_FOOD',
  readEnvFlag('VITE_ENABLE_LABO', true)
)

export const VISION_FOOD_CLASSIFIER_MODEL_ID = readEnvString(
  ['VITE_VISION_FOOD_MODEL_ID', 'VITE_LABO_MODEL_ID'],
  'onnx-community/swin-finetuned-food101-ONNX'
)

export const VISION_FOOD_DEPTH_MODEL_ID = readEnvString(
  ['VITE_VISION_FOOD_DEPTH_MODEL_ID', 'VITE_LABO_DEPTH_MODEL_ID'],
  'onnx-community/depth-anything-v2-small'
)

export const VISION_FOOD_TOPK = Math.max(
  3,
  Math.min(8, readEnvNumber('VITE_VISION_FOOD_TOPK', readEnvNumber('VITE_LABO_TOPK', 5)))
)

// Compat legacy
export const ENABLE_LABO = ENABLE_VISION_FOOD
export const LABO_DEFAULT_MODEL_ID = VISION_FOOD_CLASSIFIER_MODEL_ID
export const LABO_TOPK = VISION_FOOD_TOPK
