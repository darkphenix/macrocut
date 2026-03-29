import { useState, useEffect, useMemo } from 'react'
import { todayStr, logTotals } from '../store'

function KcalRing({ consumed, target }) {
  const c = consumed ?? 0
  const r = 53
  const circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, c / target) : 0
  const dash = pct * circ
  const over = c > target
  const remaining = target - c

  return (
    <div className="kcal-ring-wrap">
      <svg viewBox="0 0 130 130">
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke={over ? 'rgba(255,77,109,0.08)' : 'rgba(245,166,35,0.05)'}
          strokeWidth="14"
        />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="9"
        />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke={over ? 'var(--danger)' : 'url(#ringGrad)'}
          strokeWidth="9"
          strokeLinecap="round"
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
            : `-${remaining.toLocaleString('fr-FR')}`}
        </div>
      </div>
    </div>
  )
}

function MacroBar({ label, consumed, target, color }) {
  const c = consumed ?? 0
  const pct = target > 0 ? Math.min(100, (c / target) * 100) : 0
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
        <div
          className="bar-fill"
          style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }}
        />
      </div>
    </div>
  )
}

function formatFoodNumber(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0'
  const rounded = Math.round(numeric * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString('fr-FR')
}

function formatFoodQty(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return ''
  const rounded = numeric >= 10 ? Math.round(numeric) : Math.round(numeric * 10) / 10
  return `${rounded.toLocaleString('fr-FR')} g`
}

function resolveFoodSource(item) {
  const rawName = String(item?.name ?? 'Aliment').trim()

  if (item?.source === 'planner' || /\(plan repas\)\s*$/i.test(rawName)) {
    return {
      cleanName: rawName.replace(/\s*\(plan repas\)\s*$/i, ''),
      label: 'Plan',
    }
  }

  if (item?.source === 'photo' || /\(photo repas\)\s*$/i.test(rawName)) {
    return {
      cleanName: rawName.replace(/\s*\(photo repas\)\s*$/i, ''),
      label: 'Photo',
    }
  }

  if (item?.source === 'scanner') {
    return {
      cleanName: rawName,
      label: 'Scanner',
    }
  }

  return {
    cleanName: rawName,
    label: '',
  }
}

function FoodStat({ label, value, tone = 'neutral' }) {
  return <span className={`food-stat food-stat-${tone}`}>{label}{value}</span>
}

function FoodItem({ item, onRemove }) {
  const source = resolveFoodSource(item)
  const qtyLabel = formatFoodQty(item.qty)

  return (
    <div className="food-item">
      <div className="food-item-info">
        <div className="food-item-head">
          <div className="food-item-name">{source.cleanName}</div>
          {source.label && <span className="food-item-source">{source.label}</span>}
        </div>
        <div className="food-item-macros">
          {qtyLabel && <span>{qtyLabel}</span>}
          <span>{Math.round(Number(item.kcal) || 0)} kcal</span>
        </div>
        <div className="food-item-stats">
          <FoodStat label="" value={`${Math.round(Number(item.kcal) || 0)} kcal`} tone="kcal" />
          <FoodStat label="P" value={`${formatFoodNumber(item.protein)}g`} tone="protein" />
          <FoodStat label="G" value={`${formatFoodNumber(item.carbs)}g`} tone="carbs" />
          <FoodStat label="L" value={`${formatFoodNumber(item.fat)}g`} tone="fat" />
        </div>
      </div>
      <button className="h-del" onClick={onRemove} aria-label="Supprimer l'aliment">
        x
      </button>
    </div>
  )
}

function MealGuidance({ itemsCount, onOpenAdd, onGoHistory }) {
  const steps = useMemo(() => {
    if (itemsCount === 0) {
      return [
        { title: '1. Ajoute ton premier repas', text: 'Utilise scanner, photo ou plan repas selon ton niveau d energie.' },
        { title: '2. Verifie le budget', text: 'Le total du jour se met a jour automatiquement.' },
        { title: '3. Continue demain', text: 'Un suivi simple chaque jour rend le coach plus fiable.' },
      ]
    }

    if (itemsCount < 3) {
      return [
        { title: 'Continue', text: 'Ajoute les aliments restants pour completer ta journee.' },
        { title: 'Besoin d aller vite ?', text: 'La saisie manuelle des totaux reste disponible.' },
        { title: 'Ensuite', text: 'Ouvre le journal pour comparer les jours precedents.' },
      ]
    }

    return [
      { title: 'Journal bien lance', text: 'Tes repas du jour sont deja enregistres.' },
      { title: 'Derniere verification', text: 'Ajuste ou supprime un aliment si besoin.' },
      { title: 'Suivi', text: 'Passe ensuite dans Analyse pour suivre la tendance.' },
    ]
  }, [itemsCount])

  return (
    <div className="card today-guidance-card">
      <div className="section-heading">
        <div>
          <div className="section-eyebrow">Guide rapide</div>
          <div className="section-title">Que faire maintenant ?</div>
        </div>
      </div>

      <div className="today-guidance-list">
        {steps.map((step) => (
          <div key={step.title} className="today-guidance-step">
            <div className="today-guidance-step-title">{step.title}</div>
            <div className="today-guidance-step-text">{step.text}</div>
          </div>
        ))}
      </div>

      <div className="today-guidance-actions">
        <button className="today-quick-btn today-quick-btn-primary" onClick={() => onOpenAdd('scanner')}>
          Ajouter un repas
        </button>
        <button className="today-quick-btn" onClick={onGoHistory}>
          Voir l historique
        </button>
      </div>
    </div>
  )
}

export default function Today({
  targets,
  todayLog,
  onSave,
  onRemoveItem,
  onOpenAdd = () => {},
  onGoHistory = () => {},
  tdee,
  dq,
  streak,
  currentWeight,
  progressPct,
  settings,
  quality,
  energyModel,
  onOpenCoach = () => {},
}) {
  const [weight, setWeight] = useState('')
  const [wSaved, setWSaved] = useState(false)
  const [foodTab, setFoodTab] = useState('items')
  const [manual, setManual] = useState({ kcal: '', protein: '', fat: '', carbs: '' })
  const [mSaved, setMSaved] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (todayLog?.weight) setWeight(String(todayLog.weight))
    if (todayLog?.manual) {
      setManual({
        kcal: todayLog.manual.kcal != null ? String(todayLog.manual.kcal) : '',
        protein: todayLog.manual.protein != null ? String(todayLog.manual.protein) : '',
        fat: todayLog.manual.fat != null ? String(todayLog.manual.fat) : '',
        carbs: todayLog.manual.carbs != null ? String(todayLog.manual.carbs) : '',
      })
    }
  }, [todayLog?.date]) // eslint-disable-line

  const totals = logTotals(todayLog)
  const items = todayLog?.items ?? []
  const tdeeAdapted = energyModel?.useAdaptive ?? (dq >= 70)
  const confidenceLabel = energyModel?.confidenceLabel ?? quality?.label ?? 'Faible'
  const qualityLevel = quality?.level ?? 'faible'
  const remaining = (targets?.targetKcal ?? 0) - (totals?.kcal ?? 0)
  const remainingLabel = remaining >= 0
    ? `${remaining.toLocaleString('fr-FR')} kcal disponibles aujourd hui`
    : `${Math.abs(remaining).toLocaleString('fr-FR')} kcal depassees aujourd hui`
  const remainingTone = remaining >= 0 ? 'ok' : 'alert'
  const manualFilled = ['kcal', 'protein', 'carbs', 'fat'].some((field) => manual[field] !== '')

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  function saveWeight() {
    const w = parseFloat(weight)
    onSave({ date: todayStr(), weight: isNaN(w) ? null : w })
    setWSaved(true)
    setTimeout(() => setWSaved(false), 1600)
  }

  function saveManual() {
    const p = (value, fn) => (value !== '' ? fn(value) : null)
    onSave({
      date: todayStr(),
      manual: {
        kcal: p(manual.kcal, parseInt),
        protein: p(manual.protein, parseInt),
        fat: p(manual.fat, parseInt),
        carbs: p(manual.carbs, parseInt),
      },
    })
    setMSaved(true)
    setTimeout(() => setMSaved(false), 1600)
  }

  return (
    <div className="view today-view">
      <section className="today-hero card">
        <header className="view-header today-hero-header">
          <div>
            <div className="view-title">Aujourd hui</div>
            <div className="view-subtitle">{dateLabel}</div>
          </div>
          <div className="header-right">
            {streak > 0 && <div className="badge badge-streak">Feu {streak}j</div>}
            <div className={`badge ${tdeeAdapted ? 'badge-ok' : 'badge-dim'}`}>
              {tdeeAdapted ? 'Coach adapte' : 'Coach en estimation'}
            </div>
          </div>
        </header>

        <div className="today-hero-body">
          <div className="today-hero-summary">
            <div className="today-hero-kicker">Budget du jour</div>
            <div className="today-hero-remaining">{remainingLabel}</div>
            <div className="today-hero-note">
              {totals.kcal.toLocaleString('fr-FR')} / {targets.targetKcal.toLocaleString('fr-FR')} kcal consommees
            </div>
              <div className={`badge ${remainingTone === 'ok' ? 'badge-ok' : 'badge-dim'}`}>
                Objectif poids: {currentWeight.toFixed(1)} {'->'} {settings.goalWeight} kg ({progressPct}%)
              </div>
          </div>

          <div className="today-quick-actions">
            <button className="today-quick-btn today-quick-btn-primary" onClick={() => onOpenAdd('scanner')}>
              Ajouter un repas
            </button>
            <button className="today-quick-btn" onClick={onOpenCoach}>
              Ouvrir coach
            </button>
          </div>
        </div>
      </section>

      <section className="today-primary-grid">
        <div className="center-section today-kpi-card">
          <KcalRing consumed={totals.kcal} target={targets.targetKcal} />
          <div className="tdee-panel">
            <div className="tdee-row">
              <span className="tdee-lbl">Reste a viser</span>
              <span className={`tdee-val ${remaining >= 0 ? 'accent' : ''}`}>
                {remaining >= 0 ? `${remaining} kcal` : `+${Math.abs(remaining)} kcal`}
              </span>
            </div>
            <div className="tdee-row">
              <span className="tdee-lbl">Budget du jour</span>
              <span className="tdee-val">{targets.targetKcal} kcal</span>
            </div>
            <div className="tdee-row">
              <span className="tdee-lbl">Depense maintien</span>
              <span className="tdee-val muted">{tdee} kcal</span>
            </div>
            <div className="tdee-row">
              <span className="tdee-lbl">Confiance coach</span>
              <span className="tdee-val muted">{confidenceLabel}</span>
            </div>
          </div>
        </div>

        <div className="macros-card today-macros-card">
          <div className="section-heading">
            <div>
              <div className="section-eyebrow">Nutrition</div>
              <div className="section-title">Tes reperes du jour</div>
            </div>
          </div>
          <MacroBar label="Proteines" consumed={totals.protein} target={targets.protein} color="var(--p-color)" />
          <MacroBar label="Glucides" consumed={totals.carbs} target={targets.carbs} color="var(--c-color)" />
          <MacroBar label="Lipides" consumed={totals.fat} target={targets.fat} color="var(--f-color)" />
        </div>
      </section>

      <section className="log-form today-meals-card">
        <div className="section-heading section-heading-inline">
          <div>
            <div className="section-eyebrow">Repas</div>
            <div className="section-title">
              Journal du jour
              {items.length > 0 && (
                <span className="section-meta">
                  {items.length} aliment{items.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="seg-tabs today-seg-tabs">
            <button className={`seg-btn ${foodTab === 'items' ? 'active' : ''}`} onClick={() => setFoodTab('items')}>
              Liste
            </button>
            <button className={`seg-btn ${foodTab === 'manual' ? 'active' : ''}`} onClick={() => setFoodTab('manual')}>
              Totaux
            </button>
          </div>
        </div>

        {foodTab === 'items' && (
          <>
            {items.length === 0 ? (
              <div className="today-empty-food">
                <div className="today-empty-icon">&#9633;</div>
                <div>
                  Rien pour le moment. Commence par <strong>Ajouter</strong> puis choisis scanner ou photo repas.
                </div>
                <button className="btn-ghost today-empty-cta" onClick={() => onOpenAdd('scanner')}>
                  Ajouter maintenant
                </button>
              </div>
            ) : (
              <div className="food-list">
                {items.map((item) => (
                  <FoodItem key={item.id} item={item} onRemove={() => onRemoveItem(todayStr(), item.id)} />
                ))}
              </div>
            )}
            <div className="today-quick-actions">
              <button className="today-quick-btn" onClick={onGoHistory}>
                Voir historique
              </button>
              <button className="today-quick-btn" onClick={() => setFoodTab('manual')}>
                Entrer totaux
              </button>
            </div>
          </>
        )}

        {foodTab === 'manual' && (
          <>
            <div className="today-manual-intro">
              Sers-toi de cette zone si tu connais deja les totaux de ton repas ou de ta journee.
            </div>
            <div className="form-grid today-manual-grid">
              {[
                { field: 'kcal', label: 'Calories', placeholder: targets.targetKcal },
                { field: 'protein', label: 'Proteines (g)', placeholder: targets.protein },
                { field: 'carbs', label: 'Glucides (g)', placeholder: targets.carbs },
                { field: 'fat', label: 'Lipides (g)', placeholder: targets.fat },
              ].map(({ field, label, placeholder }) => (
                <div className="ig" key={field}>
                  <label>{label}</label>
                  <input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={manual[field]}
                    onChange={(e) => {
                      setManual((form) => ({ ...form, [field]: e.target.value }))
                      setMSaved(false)
                    }}
                  />
                </div>
              ))}
            </div>
            <button className={`save-btn ${mSaved ? 'saved' : ''}`} onClick={saveManual}>
              {mSaved ? 'Enregistre' : manualFilled ? 'Sauvegarder les totaux' : 'Sauvegarder'}
            </button>
          </>
        )}
      </section>

      <section className="today-secondary-grid">
        <div className="log-form today-weight-card">
          <div className="section-heading">
            <div>
              <div className="section-eyebrow">Suivi</div>
              <div className="section-title">Poids du matin</div>
            </div>
          </div>
          <div className="inline-input-row">
            <div className="ig">
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={currentWeight.toFixed(1)}
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value)
                  setWSaved(false)
                }}
              />
            </div>
            <button className={`inline-save-btn ${wSaved ? 'saved' : ''}`} onClick={saveWeight}>
              OK
            </button>
          </div>
        </div>

        <div className="dq today-dq-card">
          <span className="dq-lbl">Regularite 21j</span>
          <div className="dq-track">
            <div className="dq-fill" style={{ width: `${dq}%` }} />
          </div>
          <span className="dq-pct">{dq}%</span>
        </div>

        <div className="card today-confidence-card">
          <button className="today-advanced-toggle" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? 'Masquer details coach' : 'Afficher details coach'}
          </button>
          {showAdvanced && (
            <>
              <div className="card-title">Coach energie</div>
              <div className="today-confidence-top">
                <span className={`quality-dot quality-dot-${qualityLevel}`} />
                <span className="today-confidence-label">{confidenceLabel}</span>
              </div>
              <div className="today-confidence-note">
                {tdeeAdapted
                  ? `Le coach s appuie sur ${energyModel?.spanDays ?? 0} jours et ${energyModel?.sampleCount ?? 0} logs complets.`
                  : `Continue a logger poids + kcal. ${quality?.completeDays ?? 0} jours complets recents pour l instant.`}
              </div>
            </>
          )}
        </div>
      </section>

      <MealGuidance itemsCount={items.length} onOpenAdd={onOpenAdd} onGoHistory={onGoHistory} />
    </div>
  )
}
