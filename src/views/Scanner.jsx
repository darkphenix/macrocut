import { useState, useRef, useEffect, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

const OFF_CACHE_KEY = 'coupure_off_cache_v1'
const OFF_CACHE_TTL = 1000 * 60 * 60 * 24 * 90
const OFF_CACHE_MAX = 250

function normalizeBarcode(value) {
  return String(value ?? '').replace(/\D/g, '').trim()
}

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(OFF_CACHE_KEY))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
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

async function fetchProduct(barcode) {
  const cached = getCachedProduct(barcode)
  if (cached) return { ...cached, fromCache: true, stale: false }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments,image_front_small_url`
    )
    const data = await res.json()
    if (data.status !== 1) throw new Error('PRODUCT_NOT_FOUND')
    const p = data.product
    const n = p.nutriments ?? {}
    const product = {
      barcode,
      name: p.product_name || p.brands || 'Produit inconnu',
      brand: p.brands ?? '',
      image: p.image_front_small_url ?? null,
      per100: {
        kcal: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
        protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
        carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
        fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
      },
    }
    setCachedProduct(barcode, product)
    return { ...product, fromCache: false, stale: false }
  } catch (error) {
    const stale = getCachedProduct(barcode, { allowStale: true })
    if (stale) return { ...stale, fromCache: true, stale: true }
    throw error
  }
}

function calcFor(per100, qty) {
  const r = qty / 100
  return {
    kcal: Math.round(per100.kcal * r),
    protein: Math.round(per100.protein * r * 10) / 10,
    carbs: Math.round(per100.carbs * r * 10) / 10,
    fat: Math.round(per100.fat * r * 10) / 10,
  }
}

export default function Scanner({ onAddItem, onGoToday }) {
  const [phase, setPhase] = useState('scan')
  const [product, setProduct] = useState(null)
  const [qty, setQty] = useState('100')
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)
  const [manualCode, setManualCode] = useState('')

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
      const p = await fetchProduct(cleaned)
      setProduct(p)
      setQty('100')
      setPhase('result')
    } catch {
      setError(`Code "${cleaned}" introuvable sur Open Food Facts.`)
      setPhase('error')
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (scanning.current || !videoRef.current) return
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
      setError("Impossible d'acceder a la camera. Utilise la saisie manuelle ci-dessus.")
      setPhase('error')
    }
  }, [loadProduct, stopCamera])

  useEffect(() => {
    if (phase === 'scan') startCamera()
    return stopCamera
  }, [phase, startCamera, stopCamera])

  function handleAdd() {
    if (!product) return
    const q = parseFloat(qty) || 100
    const vals = calcFor(product.per100, q)
    onAddItem({ name: product.name, qty: q, ...vals })
    setAdded(true)
    setTimeout(() => {
      setAdded(false)
      setPhase('scan')
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

  const live = product ? calcFor(product.per100, parseFloat(qty) || 100) : null

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">SCANNER</div>
          <div className="view-subtitle">Open Food Facts · 3M+ produits</div>
        </div>
      </div>

      <div className="log-form" style={{ padding: '10px 12px' }}>
        <div className="inline-input-row">
          <div className="ig" style={{ flex: 1 }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Saisir un code-barres EAN-13"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManual()}
            />
          </div>
          <button className="inline-save-btn" onClick={handleManual}>→</button>
        </div>
      </div>

      {phase === 'scan' && (
        <div className="scanner-wrap">
          <video ref={videoRef} className="scanner-video" playsInline muted />
          <div className="scanner-overlay">
            <div className="scanner-frame">
              <div className="scanner-line" />
            </div>
            <div className="scanner-hint">Pointe vers un code-barres</div>
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div className="empty">
          <div className="empty-icon spin">⬡</div>
          <div className="empty-txt">Recherche dans Open Food Facts…</div>
        </div>
      )}

      {phase === 'error' && (
        <>
          <div className="empty">
            <div className="empty-icon">⚠️</div>
            <div className="empty-txt">{error}</div>
          </div>
          <button className="save-btn" onClick={() => { setError(''); setPhase('scan') }}>
            ← Reessayer
          </button>
        </>
      )}

      {phase === 'result' && product && (
        <>
          {product.stale && (
            <div className="card" style={{ borderColor: 'rgba(251,191,36,0.35)' }}>
              <div style={{ fontSize: 11, color: 'var(--f-color)', lineHeight: 1.5 }}>
                Donnees nutritionnelles chargees depuis le cache local (connexion absente ou API indisponible).
              </div>
            </div>
          )}

          <div className="product-card">
            {product.image
              ? <img src={product.image} alt={product.name} className="product-img" />
              : (
                <div className="product-img" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface-3)',
                  fontSize: 28,
                }}
                >
                  🥫
                </div>
              )}
            <div className="product-info">
              <div className="product-name">{product.name}</div>
              {product.brand && <div className="product-brand">{product.brand}</div>}
              <div className="product-per100">
                /100g · {product.per100.kcal} kcal · P{product.per100.protein}g · G{product.per100.carbs}g · L{product.per100.fat}g
              </div>
            </div>
          </div>

          <div className="log-form">
            <div className="form-title">Quantite consommee</div>
            <div className="ig" style={{ marginBottom: 'var(--s3)' }}>
              <label>Grammes (g)</label>
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
                ].map((m) => (
                  <div className="mp-item" key={m.lbl} style={{ borderColor: added ? 'var(--ok)' : undefined }}>
                    <span className="mp-val" style={{ color: m.color }}>{m.val}</span>
                    <span className="mp-lbl">{m.lbl}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--s2)' }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setPhase('scan'); setProduct(null) }}>
                ← Rescanner
              </button>
              <button className={`save-btn ${added ? 'saved' : ''}`} style={{ flex: 2 }} onClick={handleAdd}>
                {added ? '✓ Ajoute !' : 'Ajouter au log'}
              </button>
            </div>

            {added && (
              <button
                className="btn-ghost"
                style={{ marginTop: 'var(--s2)', borderColor: 'var(--border-acc)', color: 'var(--acc)' }}
                onClick={onGoToday}
              >
                Voir Aujourd'hui →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
