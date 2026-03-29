const STORAGE_VERSION = 1
const EXPORT_VERSION = 1

const SETTINGS_KEY = 'coupure_settings_v2'
const LOGS_KEY = 'coupure_logs_v2'
const LEGACY_NOTIF_KEY = 'coupure_notif_v1'
const NOTIF_KEY = 'coupure_notif_v2'
const OFF_CACHE_KEY = 'coupure_off_cache_v1'
const TAB_KEY = 'coupure_tab_v1'
const INSIGHT_KEY = 'coupure_insight_tab_v1'
const HABIT_KEY = 'coupure_habit_v1'
const HABIT_LOGS_KEY = 'coupure_hlog_v1'
const ONBOARDING_KEY = 'coupure_onboarding_v1'
const MEAL_PLAN_KEY = 'coupure_meal_plan_v1'
const MEAL_OFF_CACHE_KEY = 'coupure_meal_off_cache_v1'

const APP_STORAGE_KEYS = [
  SETTINGS_KEY,
  LOGS_KEY,
  LEGACY_NOTIF_KEY,
  NOTIF_KEY,
  OFF_CACHE_KEY,
  TAB_KEY,
  INSIGHT_KEY,
  HABIT_KEY,
  HABIT_LOGS_KEY,
  ONBOARDING_KEY,
  MEAL_PLAN_KEY,
  MEAL_OFF_CACHE_KEY,
]

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function storageAvailable() {
  try {
    const probe = '__coupure_storage_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function getStorageMeta() {
  const supported = typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  const available = supported && storageAvailable()
  return { supported, available }
}

function estimateBytes(payload) {
  try {
    return new Blob([payload]).size
  } catch {
    return String(payload).length * 2
  }
}

export function formatStorageSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function getStorageHealth() {
  const { supported, available } = getStorageMeta()
  if (!supported) {
    return {
      supported,
      available,
      totalBytes: 0,
      keyCount: 0,
      status: 'unsupported',
      message: "Le stockage navigateur n'est pas pris en charge sur cet appareil.",
    }
  }

  if (!available) {
    return {
      supported,
      available,
      totalBytes: 0,
      keyCount: 0,
      status: 'blocked',
      message: "Le stockage local n'est pas accessible (mode privé strict, quota ou politique navigateur).",
    }
  }

  let totalBytes = 0
  let keyCount = 0
  for (const key of APP_STORAGE_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw != null) {
      totalBytes += estimateBytes(raw)
      keyCount++
    }
  }

  const status = totalBytes > 1_500_000 ? 'warning' : 'ok'
  const message =
    status === 'warning'
      ? 'Le stockage local grossit. Exporte une sauvegarde pour limiter le risque de perte.'
      : 'Stockage local actif. Pense à exporter une sauvegarde si tu changes de navigateur ou d’appareil.'

  return { supported, available, totalBytes, keyCount, status, message }
}

export function buildBackupPayload() {
  const health = getStorageHealth()
  if (!health.available) {
    throw new Error('LOCAL_STORAGE_UNAVAILABLE')
  }

  const data = {}
  for (const key of APP_STORAGE_KEYS) {
    data[key] = safeJsonParse(localStorage.getItem(key), null)
  }

  return {
    app: 'coupure',
    type: 'full-backup',
    version: EXPORT_VERSION,
    storageVersion: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function createBackupFilename() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `coupure-backup-${stamp}.json`
}

export function downloadBackupFile() {
  const payload = buildBackupPayload()
  const serialized = JSON.stringify(payload, null, 2)
  const blob = new Blob([serialized], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = createBackupFilename()
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return {
    bytes: estimateBytes(serialized),
    filename: createBackupFilename(),
  }
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_BACKUP_FORMAT')
  if (payload.app !== 'coupure') throw new Error('INVALID_BACKUP_APP')
  if (payload.type !== 'full-backup') throw new Error('INVALID_BACKUP_TYPE')
  if (!payload.data || typeof payload.data !== 'object') throw new Error('INVALID_BACKUP_DATA')
  return payload
}

export async function parseBackupFile(file) {
  const text = await file.text()
  const payload = safeJsonParse(text)
  return validateImportPayload(payload)
}

export function restoreBackupPayload(payload) {
  const validated = validateImportPayload(payload)
  const health = getStorageHealth()
  if (!health.available) throw new Error('LOCAL_STORAGE_UNAVAILABLE')

  for (const key of APP_STORAGE_KEYS) {
    const value = validated.data[key]
    if (value == null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  return {
    restoredKeys: APP_STORAGE_KEYS.length,
    exportedAt: validated.exportedAt ?? null,
    version: validated.version ?? null,
  }
}

export function getBackupSummary() {
  const health = getStorageHealth()
  return {
    ...health,
    storageLabel: formatStorageSize(health.totalBytes),
    supportsBackup: health.available,
  }
}
