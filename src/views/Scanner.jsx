import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

const OFF_CACHE_KEY = 'coupure_off_cache_v1'
const OFF_CACHE_TTL = 1000 * 60 * 60 * 24 * 90
const OFF_CACHE_MAX = 250
const OFF_TIMEOUT_MS = 9000

function normalizeBarcode(value) {
  return String(value ?? '').replace(/\D/g, '').trim()
}

function candidateBarcodes(raw) {
  const code = normalizeBarcode(raw)
  if (!code) return []
  if (code.length === 12) return [code, `0${code}`]
  return [code]
}

function safeJsonParse(value, fallback = {}) {
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

function getCachedProduct(barcode, { allowStale = false } = {}) {
  const cache = readCache()
  const hit = cache[barcode]
  if (!hit?.product || !hit?.ts) return null
  const age = Date.now() - hit.ts
  if (!allowStale && age > OFF_CACHE_TTL) return null
  return hit.product
}

function setCachedProduct(barcode, product) {
  const cache = readCache()
  cache[barcode] = { ts: Date.now(), product }
  const entries = Object.entries(cache).sort((a, b) => (b[1]?.ts ?? 0) - (a[1]?.ts ?? 0))
  writeCache(Object.fromEntries(entries.slice(0, OFF_CACHE_MAX)))
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function parseMassLabel(value) {
  const text = cleanText(value).toLowerCase().replace(',', '.')
  if (!text) return null

  const kg = text.match(/(\d+(?:\.\d+)?)\s*kg\b/)
  if (kg) return Math.round(Number(kg[1]) * 1000)

  const g = text.match(/(\d+(?:\.\d+)?)\s*g\b/)
  if (g) return Math.round(Number(g[1]))

  const ml = text.match(/(\d+(?:\.\d+)?)\s*ml\b/)
  if (ml) return Math.round(Number(ml[1]))

  const cl = text.match(/(\d+(?:\.\d+)?)\s*cl\b/)
  if (cl) return Math.round(Number(cl[1]) * 10)

  const l = text.match(/(\d+(?:\.\d+)?)\s*l\b/)
  if (l) return Math.round(Number(l[1]) * 1000)

  return null
}

function extractKcalValue(nutriments, candidates) {
  for (const key of candidates) {
    const value = Number(nutriments?.[key])
    if (Number.isFinite(value) && value > 0) return value
  }
  return null
}

function extractPer100(product) {
  const n = product?.nutriments ?? {}
  const kcal =
    extractKcalValue(n, ['energy-kcal_100g', 'energy-kcal']) ??
    (() => {
      const kj = extractKcalValue(n, ['energy-kj_100g', 'energy_100g', 'energy-kj'])
      return Number.isFinite(kj) ? kj / 4.184 : null
    })()

  const protein = Number(n.proteins_100g ?? n.proteins)
  const carbs = Number(n.carbohydrates_100g ?? n.carbohydrates)
  const fat = Number(n.fat_100g ?? n.fat)

  const normalized = {
    kcal: Number.isFinite(kcal) ? Math.round(kcal) : 0,
    protein: Number.isFinite(protein) ? round1(protein) : 0,
    carbs: Number.isFinite(carbs) ? round1(carbs) : 0,
    fat: Number.isFinite(fat) ? round1(fat) : 0,
  }

  const hasReliableMacros =
    normalized.kcal > 0 &&
    [normalized.protein, normalized.carbs, normalized.fat].some((value) => value > 0)

  return { per100: normalized, hasReliableMacros }
}

function pickProductName(product) {
  return cleanText(
    product?.product_name_fr ||
    product?.product_name ||
    product?.generic_name_fr ||
    product?.generic_name ||
    product?.brands ||
    'Produit inconnu'
  )
}

function buildProductPayload(product, requestedBarcode, barcodeUsed) {
  const { per100, hasReliableMacros } = extractPer100(product)
  const servingLabel = cleanText(product?.serving_size)
  const quantityLabel = cleanText(product?.quantity || product?.packaging_quantity)
  const categories = Array.isArray(product?.categories_tags)
    ? product.categories_tags.slice(0, 3).map((value) => value.replace(/^en:/, '').replace(/-/g, ' '))
    : []

  return {
    barcode: requestedBarcode,
    barcodeMatched: barcodeUsed,
    name: pickProductName(product),
    brand: cleanText(product?.brands),
    image: product?.image_front_small_url || product?.image_front_url || null,
    per100,
    hasReliableMacros,
    servingLabel,
    servingGrams: parseMassLabel(servingLabel),
    quantityLabel,
    quantityGrams: parseMassLabel(quantityLabel),
    nutriGrade: cleanText(product?.nutriscore_grade).toUpperCase() || null,
    novaGroup: Number.isFinite(Number(product?.nova_group)) ? Number(product.nova_group) : null,
    categories,
  }
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

async function fetchProduct(rawBarcode) {
  const candidates = candidateBarcodes(rawBarcode)
  if (!candidates.length) throw new Error('PRODUCT_NOT_FOUND')

  for (const code of candidates) {
    const cached = getCachedProduct(code)
    if (cached) {
      return { ...cached, fromCache: true, stale: false }
    }
  }

  let lastError = null
  for (const code of candidates) {
    try {
      const data = await fetchJsonWithTimeout(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_fr,generic_name,generic_name_fr,brands,nutriments,image_front_small_url,image_front_url,quantity,packaging_quantity,serving_size,categories_tags,nutriscore_grade,nova_group`
      )
      if (data.status !== 1) throw new Error('PRODUCT_NOT_FOUND')
      const payload = buildProductPayload(data.product, normalizeBarcode(rawBarcode), code)
      setCachedProduct(code, payload)
      return { ...payload, fromCache: false, stale: false }
    } catch (error) {
      lastError = error
    }
  }

  for (const code of candidates) {
    const stale = getCachedProduct(code, { allowStale: true })
    if (stale) return { ...stale, fromCache: true, stale: true }
  }

  throw lastError ?? new Error('PRODUCT_NOT_FOUND')
}

function calcFor(per100, qty) {
  const ratio = qty / 100
  return {
    kcal: Math.round((per100?.kcal ?? 0) * ratio),
    protein: round1((per100?.protein ?? 0) * ratio),
    carbs: round1((per100?.carbs ?? 0) * ratio),
    fat: round1((per100?.fat ?? 0) * ratio),
  }
}

function buildQtyPresets(product) {
  const presets = [
    product?.servingGrams ? { label: '1 portion', grams: product.servingGrams } : null,
    { label: '30g', grams: 30 },
    { label: '100g', grams: 100 },
    product?.quantityGrams ? { label: '1 paquet', grams: product.quantityGrams } : null,
    { label: '250g', grams: 250 },
  ].filter(Boolean)

  const seen = new Set()
  return presets.filter((preset) => {
    const key = `${preset.label}-${preset.grams}`
    if (seen.has(key)) return false
    seen.add(key)
    return preset.grams > 0 && preset.grams <= 2000
  })
}

function NutriBadge({ product }) {
  const items = [
    product?.servingLabel && { label: product.servingLabel, tone: 'default' },
    product?.quantityLabel && { label: product.quantityLabel, tone: 'default' },
    product?.nutriGrade && { label: `Nutri ${product.nutriGrade}`, tone: `nutri-${product.nutriGrade.toLowerCase()}` },
    product?.novaGroup && { label: `NOVA ${product.novaGroup}`, tone: 'default' },
  ].filter(Boolean)

  if (!items.length) return null

  return (
    <div className="chip-row">
      {items.map((item) => (
        <span key={item.label} className={`chip chip-${item.tone}`}>
          {item.label}
        </span>
      ))}
    </div>
  )
}

export default function Scanner({ onAddItem, onGoToday }) {
  const [phase, setPhase] = useState('idle')
  const [product, setProduct] = useState(null)
  const [qty, setQty] = useState('100')
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [cameraDenied, setCameraDenied] = useState(false)

  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const scanning = useRef(false)

  const stopCamera = useCallback(() => {
    scanning.current = false
    if (readerRef.current) {
      try { readerRef.current.reset() } catch {}
      try { BrowserMultiFormatReader.releaseAllStreams() } catch {}
      readerRef.current = null
    }
  }, [])

  const loadProduct = useCallback(async (barcode) => {
    const cleaned = normalizeBarcode(barcode)
    if (cleaned.length < 8) {
      setError('Code-barres invalide. Saisis au moins 8 chiffres.')
      setPhase('error')
      return
    }
    setPhase('loading')
    try {
      const nextProduct = await fetchProduct(cleaned)
      setProduct(nextProduct)
      setQty(String(nextProduct.servingGrams || 100))
      setPhase('result')
    } catch {
      setError(`Impossible de trouver ce produit pour le moment. Verifie le code "${cleaned}" ou essaie un autre aliment.`)
      setPhase('error')
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (scanning.current || !videoRef.current) return
    if (!window.isSecureContext) {
      setError("La camera necessite un contexte securise (HTTPS ou localhost). Tu peux saisir le code a la main.")
      setPhase('error')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("La camera n'est pas supportee sur ce navigateur. Tu peux saisir le code a la main.")
      setPhase('error')
      return
    }
    scanning.current = true
    try {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader
      await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
        if (result && scanning.current) {
          stopCamera()
          await loadProduct(result.getText())
        }
      })
    } catch {
      setCameraDenied(true)
      setError("Impossible d'acceder a la camera. Autorise l'acces camera puis relance, ou saisis le code a la main.")
      setPhase('error')
    }
  }, [loadProduct, stopCamera])

  useEffect(() => {
    if (phase === 'scan') startCamera()
    return stopCamera
  }, [phase, startCamera, stopCamera])

  const live = useMemo(
    () => (product ? calcFor(product.per100, parseFloat(qty) || 100) : null),
    [product, qty]
  )

  const qtyPresets = useMemo(
    () => buildQtyPresets(product),
    [product]
  )

  function handleAdd() {
    if (!product) return
    const grams = parseFloat(qty) || 100
    const values = calcFor(product.per100, grams)
    const logName = product.brand ? `${product.name} (${product.brand})` : product.name
    onAddItem({ name: logName, qty: grams, source: 'scanner', ...values })
    setAdded(true)
    setTimeout(() => {
      setAdded(false)
      setPhase('idle')
      setProduct(null)
    }, 1600)
  }

  function handleManual() {
    const cleaned = normalizeBarcode(manualCode)
    if (!cleaned) return
    stopCamera()
    loadProduct(cleaned)
    setManualCode('')
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">SCANNER</div>
          <div className="view-subtitle">Le plus rapide pour enregistrer un produit emballe</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Comment faire</div>
        <div className="settings-warning-list">
          <p>1. Cadre le code-barres.</p>
          <p>2. Verifie la quantite.</p>
          <p>3. Ajoute au suivi du jour.</p>
        </div>
      </div>

      {phase === 'idle' && (
        <div className="card">
          <div className="card-title">Camera</div>
          <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 'var(--s3)' }}>
            Active la camera pour scanner automatiquement, ou utilise la saisie manuelle.
          </div>
          <button
            className="save-btn"
            onClick={() => {
              setError('')
              setCameraDenied(false)
              setPhase('scan')
            }}
          >
            Activer la camera
          </button>
        </div>
      )}

      <div className="log-form" style={{ padding: '10px 12px' }}>
        <div className="form-title">Tu preferes saisir le code ?</div>
        <div className="inline-input-row">
          <div className="ig" style={{ flex: 1 }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ex: 3274080005003"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManual()}
            />
          </div>
          <button className="inline-save-btn" onClick={handleManual}>
            Rechercher
          </button>
        </div>
      </div>

      {phase === 'scan' && (
        <>
          <div className="scanner-wrap">
            <video ref={videoRef} className="scanner-video" playsInline muted />
            <div className="scanner-overlay">
              <div className="scanner-frame">
                <div className="scanner-line" />
              </div>
              <div className="scanner-hint">Cadre le code-barres dans la zone</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">En cours</div>
            <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6 }}>
              La camera detecte automatiquement le code. Garde une distance moyenne et limite les reflets.
            </div>
          </div>
        </>
      )}

      {phase === 'loading' && (
        <div className="empty">
          <div className="empty-icon spin">[]</div>
          <div className="empty-txt">Je retrouve le produit et ses infos nutritionnelles...</div>
        </div>
      )}

      {phase === 'error' && (
        <>
          <div className="empty">
            <div className="empty-icon">!</div>
            <div className="empty-txt">{error}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <button className="save-btn" style={{ flex: 1 }} onClick={() => { setError(''); setPhase('scan') }}>
              Relancer camera
            </button>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setError(''); setPhase('idle') }}>
              Retour
            </button>
          </div>
          {cameraDenied && (
            <div className="card" style={{ borderColor: 'rgba(96,165,250,0.35)' }}>
              <div style={{ fontSize: 11, color: 'var(--info)', lineHeight: 1.5 }}>
                Si le navigateur a bloque l'acces, autorise la camera dans les reglages du site puis reessaie.
              </div>
            </div>
          )}
        </>
      )}

      {phase === 'result' && product && (
        <>
          {product.stale && (
            <div className="card" style={{ borderColor: 'rgba(251,191,36,0.35)' }}>
              <div style={{ fontSize: 11, color: 'var(--f-color)', lineHeight: 1.5 }}>
                J'ai utilise une version en memoire de ce produit car la source etait indisponible.
              </div>
            </div>
          )}

          {!product.hasReliableMacros && (
            <div className="card" style={{ borderColor: 'rgba(96,165,250,0.35)' }}>
              <div style={{ fontSize: 11, color: 'var(--info)', lineHeight: 1.5 }}>
                Produit trouve, mais les informations nutritionnelles semblent incompletes. Verifie avant de valider.
              </div>
            </div>
          )}

          <div className="product-card">
            {product.image ? (
              <img src={product.image} alt={product.name} className="product-img" />
            ) : (
              <div
                className="product-img"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface-3)',
                  fontSize: 28,
                }}
              >
                []
              </div>
            )}
            <div className="product-info">
              <div className="product-name">{product.name}</div>
              {product.brand && <div className="product-brand">{product.brand}</div>}
              <NutriBadge product={product} />
              <div className="product-per100">
                Base 100g · {product.per100.kcal} kcal · P{product.per100.protein}g · G{product.per100.carbs}g · L{product.per100.fat}g
              </div>
              {product.categories.length > 0 && (
                <div className="product-extra">
                  {product.categories.join(' · ')}
                </div>
              )}
            </div>
          </div>

          <div className="log-form">
            <div className="form-title">Quelle quantite as-tu mangee ?</div>

            {qtyPresets.length > 0 && (
              <div className="qty-presets">
                {qtyPresets.map((preset) => (
                  <button
                    key={`${preset.label}-${preset.grams}`}
                    className={`qty-preset ${String(preset.grams) === qty ? 'active' : ''}`}
                    onClick={() => setQty(String(preset.grams))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            <div className="ig" style={{ marginBottom: 'var(--s3)' }}>
              <label>Quantite en grammes</label>
              <input
                type="number"
                step="5"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={{ fontSize: 22 }}
              />
            </div>

            {live && (
              <div className="macro-preview">
                {[
                  { val: live.kcal, lbl: 'kcal', color: 'var(--acc)' },
                  { val: `${live.protein}g`, lbl: 'prot.', color: 'var(--p-color)' },
                  { val: `${live.carbs}g`, lbl: 'gluc.', color: 'var(--c-color)' },
                  { val: `${live.fat}g`, lbl: 'lip.', color: 'var(--f-color)' },
                ].map((item) => (
                  <div className="mp-item" key={item.lbl} style={{ borderColor: added ? 'var(--ok)' : undefined }}>
                    <span className="mp-val" style={{ color: item.color }}>{item.val}</span>
                    <span className="mp-lbl">{item.lbl}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 'var(--s3)' }}>
              Source produit : Open Food Facts{product.barcodeMatched && product.barcode !== product.barcodeMatched ? ` · code reconnu ${product.barcodeMatched}` : ''}
            </div>

            <div style={{ display: 'flex', gap: 'var(--s2)' }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setPhase('scan'); setProduct(null) }}>
                Scanner un autre produit
              </button>
              <button className={`save-btn ${added ? 'saved' : ''}`} style={{ flex: 2 }} onClick={handleAdd}>
                {added ? 'Ajoute au jour' : 'Ajouter a aujourd hui'}
              </button>
            </div>

            {added && (
              <button
                className="btn-ghost"
                style={{ marginTop: 'var(--s2)', borderColor: 'var(--border-acc)', color: 'var(--acc)' }}
                onClick={onGoToday}
              >
                Voir mon jour
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
