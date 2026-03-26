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

export const ENABLE_LABO = readEnvFlag('VITE_ENABLE_LABO', !!import.meta.env?.DEV)
export const LABO_DEFAULT_MODEL_ID =
  String(import.meta.env?.VITE_LABO_MODEL_ID ?? 'onnx-community/swin-finetuned-food101-ONNX')

export const LABO_TOPK = Math.max(3, Math.min(8, readEnvNumber('VITE_LABO_TOPK', 5)))
