const MEAL_OFF_CACHE_KEY = 'coupure_meal_off_cache_v1'
const OFF_TIMEOUT_MS = 9000
const OFF_CACHE_TTL = 1000 * 60 * 60 * 24 * 45

function safeJsonParse(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function normalizeTerm(term) {
  return String(term ?? '').trim().toLowerCase()
}

function readCache() {
  return safeJsonParse(localStorage.getItem(MEAL_OFF_CACHE_KEY), {})
}

function writeCache(cache) {
  try {
    localStorage.setItem(MEAL_OFF_CACHE_KEY, JSON.stringify(cache))
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
  if (b.includes(a)) return 0.92
  if (a.includes(b)) return 0.84
  return 0.12
}

function parsePackMass(text) {
  const value = String(text ?? '').toLowerCase().replace(',', '.')
  if (!value) return null

  const kg = value.match(/(\d+(?:\.\d+)?)\s*kg\b/)
  if (kg) return { size: Math.round(Number(kg[1]) * 1000), unit: 'g' }

  const g = value.match(/(\d+(?:\.\d+)?)\s*g\b/)
  if (g) return { size: Math.round(Number(g[1])), unit: 'g' }

  const ml = value.match(/(\d+(?:\.\d+)?)\s*ml\b/)
  if (ml) return { size: Math.round(Number(ml[1])), unit: 'ml' }

  const cl = value.match(/(\d+(?:\.\d+)?)\s*cl\b/)
  if (cl) return { size: Math.round(Number(cl[1]) * 10), unit: 'ml' }

  const l = value.match(/(\d+(?:\.\d+)?)\s*l\b/)
  if (l) return { size: Math.round(Number(l[1]) * 1000), unit: 'ml' }

  return null
}

function parsePackCount(text) {
  const value = String(text ?? '').toLowerCase().trim()
  if (!value) return null
  const match = value.match(/^(\d+)\s*(x|pieces?|pi[eè]ces?|oeufs?|wraps?|tortillas?|galettes?|pots?)?/)
  if (!match) return null
  const count = Number(match[1])
  if (!Number.isFinite(count) || count <= 1) return null
  return { size: count, unit: 'unit' }
}

function extractPackHint(product) {
  const quantity = product?.quantity || product?.packaging_quantity || product?.serving_size || ''
  return parsePackMass(quantity) ?? parsePackCount(quantity)
}

function selectBestProduct(term, products) {
  const scored = products
    .map((product) => {
      const name = product?.product_name || product?.generic_name || ''
      const pack = extractPackHint(product)
      if (!pack) return null
      return {
        name,
        score: similarityScore(term, name),
        pack,
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
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`OFF_${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchPackHintFromOpenFoodFacts(term) {
  const query = normalizeTerm(term)
  if (query.length < 2) return null

  const cached = getCached(query)
  if (cached) return cached

  try {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '8',
      fields: 'product_name,generic_name,quantity,packaging_quantity,serving_size',
    })
    const data = await fetchJsonWithTimeout(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`)
    const products = Array.isArray(data?.products) ? data.products : []
    const best = selectBestProduct(query, products)
    if (!best) return null
    const payload = {
      packSize: best.pack.size,
      packUnit: best.pack.unit,
      packLabel: best.name || term,
      source: 'openfoodfacts',
    }
    setCached(query, payload)
    return payload
  } catch {
    return null
  }
}

export { MEAL_OFF_CACHE_KEY }
