import { useEffect, useMemo, useRef, useState } from 'react'

const HF_MODEL = 'Xenova/detr-resnet-50-panoptic'
const HF_INIT_TIMEOUT_MS = 12000

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Lecture image impossible.'))
    reader.readAsDataURL(file)
  })
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function guessFoodFromLabel(label) {
  const text = String(label || '').toLowerCase()

  const map = [
    { keys: ['banana'], item: { name: 'Banane', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, baseQty: 120 } },
    { keys: ['apple'], item: { name: 'Pomme', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, baseQty: 150 } },
    { keys: ['orange'], item: { name: 'Orange', kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1, baseQty: 140 } },
    { keys: ['broccoli'], item: { name: 'Brocoli', kcal: 35, protein: 2.8, carbs: 7, fat: 0.4, baseQty: 120 } },
    { keys: ['carrot'], item: { name: 'Carotte', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, baseQty: 100 } },
    { keys: ['pizza'], item: { name: 'Pizza', kcal: 266, protein: 11, carbs: 33, fat: 10, baseQty: 140 } },
    { keys: ['sandwich'], item: { name: 'Sandwich', kcal: 250, protein: 12, carbs: 25, fat: 10, baseQty: 160 } },
    { keys: ['hot dog'], item: { name: 'Hot dog', kcal: 290, protein: 10, carbs: 24, fat: 17, baseQty: 150 } },
    { keys: ['cake', 'donut'], item: { name: 'Gateau', kcal: 380, protein: 4.5, carbs: 50, fat: 18, baseQty: 90 } },
    { keys: ['bowl'], item: { name: 'Bol compose', kcal: 140, protein: 6, carbs: 18, fat: 5, baseQty: 280 } },
    { keys: ['salad'], item: { name: 'Salade composee', kcal: 85, protein: 3.5, carbs: 7, fat: 4, baseQty: 220 } },
    { keys: ['rice'], item: { name: 'Riz cuit', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, baseQty: 180 } },
    { keys: ['pasta'], item: { name: 'Pates cuites', kcal: 158, protein: 5.8, carbs: 31, fat: 1, baseQty: 180 } },
    { keys: ['bread'], item: { name: 'Pain', kcal: 265, protein: 8.5, carbs: 49, fat: 3.2, baseQty: 60 } },
    { keys: ['egg'], item: { name: 'Oeufs', kcal: 155, protein: 13, carbs: 1.1, fat: 11, baseQty: 110 } },
    { keys: ['chicken'], item: { name: 'Poulet', kcal: 165, protein: 31, carbs: 0, fat: 3.6, baseQty: 140 } },
    { keys: ['steak', 'beef'], item: { name: 'Boeuf', kcal: 250, protein: 26, carbs: 0, fat: 15, baseQty: 150 } },
    { keys: ['fish', 'salmon'], item: { name: 'Poisson', kcal: 190, protein: 22, carbs: 0, fat: 11, baseQty: 140 } },
    { keys: ['fries'], item: { name: 'Frites', kcal: 312, protein: 3.4, carbs: 41, fat: 15, baseQty: 120 } },
  ]

  const found = map.find((entry) => entry.keys.some((key) => text.includes(key)))
  return found?.item ?? null
}

function deriveConfidence(score = 0) {
  if (score >= 0.8) return { label: 'elevee', note: 'Bonne reconnaissance visuelle' }
  if (score >= 0.55) return { label: 'moyenne', note: 'A verifier avant ajout' }
  return { label: 'faible', note: 'Suggestion tres approximative' }
}

function computeMacros(base, qty) {
  const ratio = (Number(qty) || 0) / 100
  return {
    kcal: Math.round((base?.kcal ?? 0) * ratio),
    protein: round1((base?.protein ?? 0) * ratio),
    carbs: round1((base?.carbs ?? 0) * ratio),
    fat: round1((base?.fat ?? 0) * ratio),
  }
}

async function loadDetector() {
  const [{ pipeline, env }] = await Promise.all([
    import('@huggingface/transformers'),
  ])

  env.allowLocalModels = false
  env.useBrowserCache = true

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HF_INIT_TIMEOUT_MS)

  try {
    return await pipeline('image-segmentation', HF_MODEL, {
      progress_callback: undefined,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export default function Labo({ onAddItem, onGoToday }) {
  const [imageSrc, setImageSrc] = useState('')
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [detections, setDetections] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [qty, setQty] = useState('150')
  const [added, setAdded] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [engineStatus, setEngineStatus] = useState('idle')

  const fileRef = useRef(null)
  const detectorRef = useRef(null)
  const detectorPromiseRef = useRef(null)

  useEffect(() => {
    return () => {
      detectorRef.current = null
      detectorPromiseRef.current = null
    }
  }, [])

  async function ensureDetector() {
    if (detectorRef.current) return detectorRef.current
    if (!detectorPromiseRef.current) {
      setEngineStatus('loading')
      detectorPromiseRef.current = loadDetector()
        .then((detector) => {
          detectorRef.current = detector
          setEngineStatus('ready')
          return detector
        })
        .catch((err) => {
          detectorPromiseRef.current = null
          setEngineStatus('error')
          throw err
        })
    }
    return detectorPromiseRef.current
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setAdded(false)
    setPhase('preview')
    setDetections([])
    setSelectedIndex(0)

    try {
      const src = await readFileAsDataURL(file)
      setImageSrc(src)
    } catch (err) {
      setError(String(err?.message ?? err ?? 'Image impossible a charger.'))
      setPhase('error')
    } finally {
      event.target.value = ''
    }
  }

  async function analyzeImage() {
    if (!imageSrc) return
    setError('')
    setPhase('analyzing')

    try {
      const detector = await ensureDetector()
      const raw = await detector(imageSrc)
      const next = (Array.isArray(raw) ? raw : [])
        .map((item, index) => {
          const guess = guessFoodFromLabel(item?.label)
          if (!guess) return null
          const confidence = deriveConfidence(Number(item?.score || 0))
          return {
            id: `${item?.label || 'item'}-${index}`,
            rawLabel: String(item?.label || 'aliment'),
            score: Number(item?.score || 0),
            confidence,
            ...guess,
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)

      if (!next.length) {
        throw new Error("Je n'ai pas reussi a reconnaitre clairement le repas. Essaie une photo plus nette ou passe en ajout manuel.")
      }

      setDetections(next)
      setSelectedIndex(0)
      setQty(String(clamp(next[0].baseQty || 150, 50, 600)))
      setPhase('result')
    } catch (err) {
      setError(String(err?.message ?? err ?? 'Analyse impossible.'))
      setPhase('error')
    }
  }

  const selected = useMemo(
    () => detections[selectedIndex] ?? null,
    [detections, selectedIndex]
  )

  const live = useMemo(
    () => (selected ? computeMacros(selected, parseFloat(qty) || selected.baseQty || 150) : null),
    [selected, qty]
  )

  function addSelected() {
    if (!selected || !live) return
    const grams = parseFloat(qty) || selected.baseQty || 150
    onAddItem({
      name: selected.name,
      qty: grams,
      source: 'photo',
      ...live,
    })
    setAdded(true)
    setTimeout(() => {
      setAdded(false)
      setPhase('idle')
      setImageSrc('')
      setDetections([])
      setSelectedIndex(0)
    }, 1600)
  }

  function openPicker() {
    fileRef.current?.click()
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">PHOTO REPAS</div>
          <div className="view-subtitle">Une estimation rapide a partir d'une photo de ton assiette</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Le plus simple</div>
        <div className="settings-warning-list">
          <p>Prends une photo nette, avec le plat bien visible.</p>
          <p>Choisis la suggestion la plus proche.</p>
          <p>Ajuste la portion avant d'ajouter.</p>
        </div>
      </div>

      <div className="storage-actions" style={{ marginBottom: 'var(--s4)' }}>
        <button className="save-btn" onClick={openPicker}>
          Choisir une photo
        </button>
        {imageSrc && phase !== 'analyzing' && (
          <button className="btn-ghost" onClick={analyzeImage}>
            Analyser la photo
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          hidden
        />
      </div>

      {phase === 'idle' && (
        <div className="empty">
          <div className="empty-icon">[]</div>
          <div className="empty-txt">Ajoute une photo pour obtenir une suggestion de repas.</div>
        </div>
      )}

      {(phase === 'preview' || phase === 'analyzing' || phase === 'result' || phase === 'error') && imageSrc && (
        <div className="card">
          <div className="card-title">Photo choisie</div>
          <img
            src={imageSrc}
            alt="Repas a analyser"
            style={{ width: '100%', borderRadius: 14, display: 'block', objectFit: 'cover', maxHeight: 320 }}
          />
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="empty">
          <div className="empty-icon spin">[]</div>
          <div className="empty-txt">Analyse de la photo en cours...</div>
        </div>
      )}

      {phase === 'error' && (
        <>
          <div className="empty">
            <div className="empty-icon">!</div>
            <div className="empty-txt">{error}</div>
          </div>
          <button className="btn-ghost" onClick={() => setPhase(imageSrc ? 'preview' : 'idle')}>
            Revenir
          </button>
        </>
      )}

      {phase === 'result' && selected && (
        <>
          <div className="card">
            <div className="card-title">Suggestion principale</div>
            <div className="product-name" style={{ marginBottom: 4 }}>{selected.name}</div>
            <div className="product-extra">
              Reconnu comme "{selected.rawLabel}" · confiance {Math.round(selected.score * 100)}% · {selected.confidence.note}
            </div>
          </div>

          {detections.length > 1 && (
            <div className="card">
              <div className="card-title">Autres suggestions</div>
              <div className="qty-presets">
                {detections.map((item, index) => (
                  <button
                    key={item.id}
                    className={`qty-preset ${index === selectedIndex ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedIndex(index)
                      setQty(String(clamp(item.baseQty || 150, 50, 600)))
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="log-form">
            <div className="form-title">Ajuster la portion</div>

            <div className="qty-presets">
              {[100, 150, 200, selected.baseQty, 300].filter(Boolean).map((grams) => (
                <button
                  key={grams}
                  className={`qty-preset ${String(grams) === qty ? 'active' : ''}`}
                  onClick={() => setQty(String(grams))}
                >
                  {grams}g
                </button>
              ))}
            </div>

            <div className="ig" style={{ marginBottom: 'var(--s3)' }}>
              <label>Portion estimee</label>
              <input
                type="number"
                step="10"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
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

            <div style={{ display: 'flex', gap: 'var(--s2)' }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setPhase('preview')}>
                Changer de photo
              </button>
              <button className={`save-btn ${added ? 'saved' : ''}`} style={{ flex: 2 }} onClick={addSelected}>
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

      <details className="card" open={showAdvanced} onToggle={(e) => setShowAdvanced(e.currentTarget.open)}>
        <summary className="card-title" style={{ cursor: 'pointer', listStyle: 'none' }}>
          Details avances
        </summary>
        <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.7, display: 'grid', gap: 'var(--s3)' }}>
          <p>
            Cette fonction utilise un modele visuel embarque dans le navigateur pour proposer un type d'aliment proche.
            L'estimation reste indicative et fonctionne mieux sur des aliments simples ou bien visibles.
          </p>
          <p>
            Moteur charge : {HF_MODEL}
          </p>
          <p>
            Etat du moteur : {engineStatus === 'ready' ? 'pret' : engineStatus === 'loading' ? 'chargement' : engineStatus === 'error' ? 'erreur' : 'inactif'}
          </p>
          <p>
            Conseil : pour un plat complexe, verifie toujours la suggestion ou complete avec une saisie manuelle.
          </p>
        </div>
      </details>
    </div>
  )
}
