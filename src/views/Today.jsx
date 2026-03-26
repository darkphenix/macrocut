import { useState, useEffect } from 'react'
import { todayStr, logTotals } from '../store'

function KcalRing({ consumed, target }) {
  const c    = consumed ?? 0
  const r    = 53
  const circ = 2 * Math.PI * r
  const pct  = target > 0 ? Math.min(1, c / target) : 0
  const dash = pct * circ
  const over = c > target
  const remaining = target - c

  return (
    <div className="kcal-ring-wrap">
      <svg viewBox="0 0 130 130">
        {/* Glow track */}
        <circle cx="65" cy="65" r={r} fill="none"
          stroke={over ? 'rgba(255,77,109,0.08)' : 'rgba(245,166,35,0.05)'}
          strokeWidth="14" />
        {/* Track */}
        <circle cx="65" cy="65" r={r} fill="none"
          stroke="var(--surface-3)" strokeWidth="9" />
        {/* Fill */}
        <circle cx="65" cy="65" r={r} fill="none"
          stroke={over ? 'var(--danger)' : 'url(#ringGrad)'}
          strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 0.6s var(--ease)' }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--acc)" />
            <stop offset="100%" stopColor="var(--acc-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="kcal-ring-center">
        <div className="kcal-num">{c.toLocaleString('fr-FR')}</div>
        <div className="kcal-unit">kcal</div>
        <div className="kcal-rest" style={{ color: over ? 'var(--danger)' : 'var(--tx-3)' }}>
          {over
            ? `+${Math.abs(remaining).toLocaleString('fr-FR')}`
            : `−${remaining.toLocaleString('fr-FR')}`}
        </div>
      </div>
    </div>
  )
}

function MacroBar({ label, consumed, target, color }) {
  const c    = consumed ?? 0
  const pct  = target > 0 ? Math.min(100, (c / target) * 100) : 0
  const over = c > target
  return (
    <div className="macro-row">
      <div className="macro-head">
        <span className="macro-name">{label}</span>
        <span className="macro-nums">
          <span style={{ color: over ? 'var(--danger)' : 'var(--tx)' }}>{c}</span>
          <span className="macro-sep"> / </span>
          <span className="macro-tgt">{target}g</span>
        </span>
      </div>
      <div className="bar-track">
        <div className="bar-fill"
          style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }} />
      </div>
    </div>
  )
}

function FoodItem({ item, onRemove }) {
  return (
    <div className="food-item">
      <div className="food-item-info">
        <div className="food-item-name">{item.name}</div>
        <div className="food-item-macros">
          {item.qty}g &middot; {item.kcal} kcal &middot;
          P{item.protein}g &middot; G{item.carbs}g &middot; L{item.fat}g
        </div>
      </div>
      <button className="h-del" onClick={onRemove} aria-label="Supprimer l'aliment">✕</button>
    </div>
  )
}

export default function Today({
  targets, todayLog, onSave, onRemoveItem, onGoScanner = () => {}, onGoHistory = () => {}, tdee, dq, streak,
  currentWeight, progressPct, settings,
}) {
  const [weight, setWeight] = useState('')
  const [wSaved, setWSaved] = useState(false)
  const [foodTab, setFoodTab] = useState('items')
  const [manual, setManual]   = useState({ kcal: '', protein: '', fat: '', carbs: '' })
  const [mSaved, setMSaved]   = useState(false)

  useEffect(() => {
    if (todayLog?.weight) setWeight(String(todayLog.weight))
    if (todayLog?.manual) {
      setManual({
        kcal:    todayLog.manual.kcal    != null ? String(todayLog.manual.kcal)    : '',
        protein: todayLog.manual.protein != null ? String(todayLog.manual.protein) : '',
        fat:     todayLog.manual.fat     != null ? String(todayLog.manual.fat)     : '',
        carbs:   todayLog.manual.carbs   != null ? String(todayLog.manual.carbs)   : '',
      })
    }
  }, [todayLog?.date]) // eslint-disable-line

  const totals = logTotals(todayLog)
  const items  = todayLog?.items ?? []
  const tdeeAdapted = dq >= 70

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  function saveWeight() {
    const w = parseFloat(weight)
    onSave({ date: todayStr(), weight: isNaN(w) ? null : w })
    setWSaved(true); setTimeout(() => setWSaved(false), 1600)
  }

  function saveManual() {
    const p = (v, fn) => v !== '' ? fn(v) : null
    onSave({
      date: todayStr(),
      manual: {
        kcal:    p(manual.kcal,    parseInt),
        protein: p(manual.protein, parseInt),
        fat:     p(manual.fat,     parseInt),
        carbs:   p(manual.carbs,   parseInt),
      },
    })
    setMSaved(true); setTimeout(() => setMSaved(false), 1600)
  }

  return (
    <div className="view">
      {/* ── Header ── */}
      <header className="view-header">
        <div>
          <div className="view-title">COUPURE</div>
          <div className="view-subtitle">{dateLabel}</div>
        </div>
        <div className="header-right">
          {streak > 0 && <div className="badge badge-streak">🔥 {streak}j</div>}
          <div className={`badge ${tdeeAdapted ? 'badge-ok' : 'badge-dim'}`}>
            {tdeeAdapted ? '● TDEE adapté' : '○ TDEE estimé'}
          </div>
        </div>
      </header>

      {/* ── Progression ── */}
      <div className="progress-banner">
        <div className="progress-banner-text">
          <span className="progress-banner-label">Objectif</span>
          <span className="progress-banner-val">
            {currentWeight.toFixed(1)} → {settings.goalWeight} kg
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="progress-pct">{progressPct}%</div>
      </div>
      <div className="today-quick-actions">
        <button className="today-quick-btn today-quick-btn-primary" onClick={onGoScanner}>
          + Ajouter via scanner
        </button>
        <button className="today-quick-btn" onClick={onGoHistory}>
          Voir historique
        </button>
      </div>

      {/* ── Ring + TDEE ── */}
      <div className="center-section">
        <KcalRing consumed={totals.kcal} target={targets.targetKcal} />
        <div className="tdee-panel">
          <div className="tdee-row">
            <span className="tdee-lbl">Target</span>
            <span className="tdee-val accent">{targets.targetKcal} kcal</span>
          </div>
          <div className="tdee-row">
            <span className="tdee-lbl">{tdeeAdapted ? 'TDEE adapté' : 'TDEE estimé'}</span>
            <span className="tdee-val">{tdee} kcal</span>
          </div>
          <div className="tdee-row">
            <span className="tdee-lbl">Déficit</span>
            <span className="tdee-val muted">−{targets.deficitDay} kcal/j</span>
          </div>
        </div>
      </div>

      {/* ── Macros ── */}
      <div className="macros-card">
        <MacroBar label="Protéines" consumed={totals.protein} target={targets.protein}
          color="var(--p-color)" />
        <MacroBar label="Glucides"  consumed={totals.carbs}   target={targets.carbs}
          color="var(--c-color)" />
        <MacroBar label="Lipides"   consumed={totals.fat}     target={targets.fat}
          color="var(--f-color)" />
      </div>

      {/* ── Poids ── */}
      <div className="log-form">
        <div className="form-title">Poids du matin (kg)</div>
        <div className="inline-input-row">
          <div className="ig">
            <input type="number" step="0.1" inputMode="decimal"
              placeholder={currentWeight.toFixed(1)}
              value={weight}
              onChange={(e) => { setWeight(e.target.value); setWSaved(false) }}
            />
          </div>
          <button
            className={`inline-save-btn ${wSaved ? 'saved' : ''}`}
            onClick={saveWeight}
          >
            {wSaved ? '✓' : 'OK'}
          </button>
        </div>
      </div>

      {/* ── Aliments ── */}
      <div className="log-form">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s3)' }}>
          <div className="form-title" style={{ marginBottom: 0 }}>
            Repas du jour
            {items.length > 0 && (
              <span style={{ marginLeft: 6, fontFamily: 'var(--f-mono)', fontSize: 10,
                color: 'var(--acc)', fontWeight: 400 }}>
                {items.length} aliment{items.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="seg-tabs">
            <button className={`seg-btn ${foodTab === 'items' ? 'active' : ''}`}
              onClick={() => setFoodTab('items')}>Liste</button>
            <button className={`seg-btn ${foodTab === 'manual' ? 'active' : ''}`}
              onClick={() => setFoodTab('manual')}>Manuel</button>
          </div>
        </div>

        {foodTab === 'items' && (
          <>
            {items.length === 0 ? (
              <div className="today-empty-food">
                <div className="today-empty-icon">&#9633;</div>
                <div>
                  Scanner un aliment depuis l'onglet <strong>Scanner</strong>
                </div>
                <button className="btn-ghost today-empty-cta" onClick={onGoScanner}>
                  Ouvrir Scanner
                </button>
              </div>
            ) : (
              <div className="food-list">
                {items.map((it) => (
                  <FoodItem key={it.id} item={it}
                    onRemove={() => onRemoveItem(todayStr(), it.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {foodTab === 'manual' && (
          <>
            <div className="form-grid" style={{ marginBottom: 'var(--s3)' }}>
              {[
                { field: 'kcal',    label: 'Calories', placeholder: targets.targetKcal },
                { field: 'protein', label: 'Protéines (g)', placeholder: targets.protein },
                { field: 'carbs',   label: 'Glucides (g)',  placeholder: targets.carbs },
                { field: 'fat',     label: 'Lipides (g)',   placeholder: targets.fat },
              ].map(({ field, label, placeholder }) => (
                <div className="ig" key={field}>
                  <label>{label}</label>
                  <input type="number" step="1" inputMode="numeric"
                    placeholder={placeholder}
                    value={manual[field]}
                    onChange={(e) => {
                      setManual(f => ({ ...f, [field]: e.target.value }))
                      setMSaved(false)
                    }}
                  />
                </div>
              ))}
            </div>
            <button className={`save-btn ${mSaved ? 'saved' : ''}`} onClick={saveManual}>
              {mSaved ? '✓ Enregistré' : 'Sauvegarder totaux'}
            </button>
          </>
        )}
      </div>

      {/* ── Data quality ── */}
      <div className="dq">
        <span className="dq-lbl">Données 7j</span>
        <div className="dq-track"><div className="dq-fill" style={{ width: `${dq}%` }} /></div>
        <span className="dq-pct">{dq}%</span>
      </div>
    </div>
  )
}
