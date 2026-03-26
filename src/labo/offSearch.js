import { round1 } from './nutrition'

const OFF_CACHE_KEY = 'coupure_labo_off_cache_v1'
const OFF_CACHE_TTL = 1000 * 60 * 60 * 24 * 45
const OFF_TIMEOUT_MS = 9000

function normalizeTerm(term) {
  return String(term ?? '').trim().toLowerCase()
}

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function readCache() {
  return safeJsonParse(localStorage.getItem(OFF_CACHE_KEY), {})
}

function writeCache(cache) {
  try {
    localStorage.setItem(OFF_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

function getCached(term) {
  const cache = readCache()
  const hit = cache[term]
  if (!hit?.value || !hit?.ts) return null
  if (Date.now() - hit.ts > OFF_CACHE_TTL) return null
  return hit.value
}

function setCached(term, value) {
  const cache = readCache()
  cache[term] = { ts: Date.now(), value }
  writeCache(cache)
}

function similarityScore(reference, candidate) {
  const a = normalizeTerm(reference)
  const b = normalizeTerm(candidate)
  if (!a || !b) return 0
  if (a === b) return 1
  if (b.includes(a)) return 0.9
  if (a.includes(b)) return 0.8
  return 0.1
}

function extractPer100(product) {
  const n = product?.nutriments ?? {}
  const kcal = Number(n['energy-kcal_100g'] ?? n['energy-kcal'])
  const protein = Number(n.proteins_100g)
  const carbs = Number(n.carbohydrates_100g)
  const fat = Number(n.fat_100g)
  if (![kcal, protein, carbs, fat].every(Number.isFinite)) return null
  if (kcal < 20 || kcal > 900) return null
  return {
    kcal: Math.round(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
  }
}

function selectBestProduct(term, products) {
  const scored = products
    .map((product) => {
      const per100 = extractPer100(product)
      if (!per100) return null
      const name = product?.product_name || product?.generic_name || term
      return {
        name,
        per100,
        score: similarityScore(term, name),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
  return scored[0] ?? null
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`OFF_${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchMacrosFromOpenFoodFacts(term) {
  const q = normalizeTerm(term)
  if (q.length < 2) return null

  const cached = getCached(q)
  if (cached) return { ...cached, source: `${cached.source}-cache` }

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '12',
    fields: 'product_name,generic_name,nutriments',
  })

  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`
  const data = await fetchJsonWithTimeout(url)
  const products = Array.isArray(data?.products) ? data.products : []
  const best = selectBestProduct(q, products)
  if (!best) return null

  const payload = {
    name: best.name,
    per100: best.per100,
    source: 'openfoodfacts',
  }
  setCached(q, payload)
  return payload
}
