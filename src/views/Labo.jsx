import { useMemo, useState } from 'react'
import { LABO_DEFAULT_MODEL_ID, LABO_TOPK } from '../features'
import { classifyMealImage, resetClassifierCache } from '../labo/vision'
import {
  computeMacros,
  normalizeLabel,
  resolveNutritionMatch,
  suggestPortionFromScore,
} from '../labo/nutrition'
import { fetchMacrosFromOpenFoodFacts } from '../labo/offSearch'

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function confidencePct(score) {
  return `${Math.round((Number(score) || 0) * 100)}%`
}

function roundTotal(value) {
  return Math.round(Number(value) * 10) / 10
}

function resolvePredictionRows(predictions) {
  const seen = new Set()
  const rows = []

  for (const pred of predictions) {
    const score = Number(pred?.score ?? 0)
    if (score < 0.03) continue

    const normalized = normalizeLabel(pred.label)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)

    const nutrition = resolveNutritionMatch(normalized)
    rows.push({
      id: `${Date.now()}_${normalized}_${rows.length}`,
      label: normalized,
      confidence: score,
      name: nutrition.name,
      per100: nutrition.per100,
      source: nutrition.source,
      grams: suggestPortionFromScore(score),
    })
  }

  return rows
}

export default function Labo({ onAddItem, onGoToday }) {
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [runtimeHint, setRuntimeHint] = useState('auto')
  const [modelId, setModelId] = useState(LABO_DEFAULT_MODEL_ID)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [addedCount, setAddedCount] = useState(0)
  const [meta, setMeta] = useState(null)
  const [rows, setRows] = useState([])
  const [offBusyById, setOffBusyById] = useState({})

  const totals = useMemo(() => {
    return rows.reduce((acc, row) => {
      const calc = computeMacros(row.per100, row.grams)
      acc.kcal += calc.kcal
      acc.protein += calc.protein
      acc.carbs += calc.carbs
      acc.fat += calc.fat
      return acc
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  }, [rows])

  async function handleImagePicked(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setAddedCount(0)
    setRows([])
    setMeta(null)
    try {
      setStatus('Preparation de la photo...')
      const dataUrl = await fileToDataUrl(file)
      setImageDataUrl(dataUrl)
      setStatus('Photo chargee. Lance l analyse.')
    } catch {
      setError('Impossible de lire cette image.')
      setStatus('')
    } finally {
      event.target.value = ''
    }
  }

  async function runAnalysis() {
    if (!imageDataUrl) {
      setError('Ajoute une photo avant de lancer l analyse.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Chargement du modele IA...')

    try {
      const result = await classifyMealImage(imageDataUrl, {
        modelId,
        runtime: runtimeHint,
        topk: LABO_TOPK,
      })

      setStatus('Reconnaissance terminee.')
      setMeta({ runtime: result.runtime, modelId: result.modelId })
      setRows(resolvePredictionRows(result.predictions))
    } catch (err) {
      const msg = String(err?.message ?? err ?? '')
      setError(
        msg.includes('fetch')
          ? 'Telechargement du modele impossible (reseau).'
          : `Echec analyse IA: ${msg || 'inconnu'}`
      )
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function updateRowPortion(id, grams) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, grams: Math.max(20, Math.min(1200, Number(grams) || 0)) }
          : row
      )
    )
  }

  function addOne(row) {
    const qty = Number(row.grams) || 0
    if (!qty) return
    const macros = computeMacros(row.per100, qty)
    onAddItem({
      name: `${row.name} [LABO]`,
      qty,
      ...macros,
    })
    setAddedCount((n) => n + 1)
  }

  function addTopRows() {
    const top = rows.slice(0, 3)
    for (const row of top) addOne(row)
  }

  async function enrichWithOpenFoodFacts(row) {
    setOffBusyById((prev) => ({ ...prev, [row.id]: true }))
    setError('')
    try {
      const enrich = await fetchMacrosFromOpenFoodFacts(row.label)
      if (!enrich?.per100) {
        setError('Pas de correspondance Open Food Facts fiable pour cette prediction.')
        return
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                name: enrich.name || r.name,
                per100: enrich.per100,
                source: enrich.source || 'openfoodfacts',
              }
            : r
        )
      )
    } catch {
      setError('Open Food Facts indisponible pour le moment. Garde les macros locales.')
    } finally {
      setOffBusyById((prev) => ({ ...prev, [row.id]: false }))
    }
  }

  function resetModelCache() {
    resetClassifierCache()
    setStatus('Cache modele vide. Prochaine analyse recharge le modele.')
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">LABO</div>
          <div className="view-subtitle">Vision IA locale photo vers macros (experimental)</div>
        </div>
      </div>

      <div className="card labo-alert">
        <div className="card-title">Mode experimental</div>
        <div className="labo-alert-text">
          La reconnaissance photo aide a pre-remplir. Valide toujours les portions avant ajout.
        </div>
      </div>

      <div className="log-form">
        <div className="form-title">1. Photo du repas</div>
        <label className="labo-pick-btn">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImagePicked}
            style={{ display: 'none' }}
          />
          Prendre / choisir une photo
        </label>

        {imageDataUrl && (
          <div className="labo-preview-wrap">
            <img src={imageDataUrl} alt="Repas a analyser" className="labo-preview" />
          </div>
        )}
      </div>

      <div className="log-form">
        <div className="form-title">2. Parametres IA</div>

        <div className="seg-tabs" style={{ marginBottom: 'var(--s3)' }}>
          <button
            className={`seg-btn ${runtimeHint === 'auto' ? 'active' : ''}`}
            onClick={() => setRuntimeHint('auto')}
          >
            Auto
          </button>
          <button
            className={`seg-btn ${runtimeHint === 'webgpu' ? 'active' : ''}`}
            onClick={() => setRuntimeHint('webgpu')}
          >
            WebGPU
          </button>
          <button
            className={`seg-btn ${runtimeHint === 'wasm' ? 'active' : ''}`}
            onClick={() => setRuntimeHint('wasm')}
          >
            WASM
          </button>
        </div>

        <div className="ig" style={{ marginBottom: 'var(--s3)' }}>
          <label>Modele (HF ID ou chemin local)</label>
          <input
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder={LABO_DEFAULT_MODEL_ID}
          />
        </div>

        <div className="labo-cta-row">
          <button className={`save-btn ${busy ? 'saved' : ''}`} onClick={runAnalysis} disabled={busy}>
            {busy ? 'Analyse...' : 'Analyser la photo'}
          </button>
          <button className="btn-ghost" onClick={resetModelCache}>
            Vider cache modele
          </button>
        </div>

        {status && <div className="labo-status">{status}</div>}
        {error && <div className="labo-error">{error}</div>}
        {meta && (
          <div className="labo-meta">
            Runtime: <strong>{meta.runtime}</strong> · Modele: <strong>{meta.modelId}</strong>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="log-form">
          <div className="labo-head">
            <div className="form-title" style={{ marginBottom: 0 }}>3. Aliments detectes</div>
            <button className="btn-ghost labo-add-top" onClick={addTopRows}>
              Ajouter top 3
            </button>
          </div>

          <div className="labo-list">
            {rows.map((row) => {
              const calc = computeMacros(row.per100, row.grams)
              const offBusy = !!offBusyById[row.id]

              return (
                <div key={row.id} className="labo-item">
                  <div className="labo-item-top">
                    <div>
                      <div className="labo-item-name">{row.name}</div>
                      <div className="labo-item-sub">
                        {row.label} · confiance {confidencePct(row.confidence)} · source {row.source}
                      </div>
                    </div>
                    <button className="btn-ghost labo-mini-btn" onClick={() => addOne(row)}>
                      Ajouter
                    </button>
                  </div>

                  <div className="labo-item-controls">
                    <div className="ig" style={{ marginBottom: 0 }}>
                      <label>Portion (g)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        step="5"
                        min="20"
                        max="1200"
                        value={row.grams}
                        onChange={(e) => updateRowPortion(row.id, e.target.value)}
                      />
                    </div>
                    <button
                      className="btn-ghost labo-mini-btn"
                      onClick={() => enrichWithOpenFoodFacts(row)}
                      disabled={offBusy}
                    >
                      {offBusy ? 'OFF...' : 'Enrichir OFF'}
                    </button>
                  </div>

                  <div className="macro-preview" style={{ marginBottom: 0 }}>
                    <div className="mp-item"><span className="mp-val" style={{ color: 'var(--acc)' }}>{calc.kcal}</span><span className="mp-lbl">kcal</span></div>
                    <div className="mp-item"><span className="mp-val" style={{ color: 'var(--p-color)' }}>{calc.protein}g</span><span className="mp-lbl">prot.</span></div>
                    <div className="mp-item"><span className="mp-val" style={{ color: 'var(--c-color)' }}>{calc.carbs}g</span><span className="mp-lbl">gluc.</span></div>
                    <div className="mp-item"><span className="mp-val" style={{ color: 'var(--f-color)' }}>{calc.fat}g</span><span className="mp-lbl">lip.</span></div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="labo-total">
            Total apercu · {Math.round(totals.kcal)} kcal · P{roundTotal(totals.protein)} · G{roundTotal(totals.carbs)} · L{roundTotal(totals.fat)}
          </div>
        </div>
      )}

      {addedCount > 0 && (
        <button className="btn-ghost" onClick={onGoToday}>
          Voir Aujourd hui ({addedCount} ajout{addedCount > 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}
