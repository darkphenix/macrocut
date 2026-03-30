import { useState, useEffect } from 'react'
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
          stroke={over ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)'}
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
    return { cleanName: rawName.replace(/\s*\(plan repas\)\s*$/i, ''), label: 'Plan' }
  }

  if (item?.source === 'photo' || /\(photo repas\)\s*$/i.test(rawName)) {
    return { cleanName: rawName.replace(/\s*\(photo repas\)\s*$/i, ''), label: 'Photo' }
  }

  if (item?.source === 'scanner') {
    return { cleanName: rawName, label: 'Scan' }
  }

  return { cleanName: rawName, label: '' }
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

export default function Today({
  targets,
  todayLog,
  onSave,
  onRemoveItem,
  onOpenPlanner = () => {},
  tdee,
  streak,
  currentWeight,
  progressPct,
  settings,
}) {
  const [weight, setWeight] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (todayLog?.weight != null) setWeight(String(todayLog.weight))
    else setWeight('')
  }, [todayLog?.date, todayLog?.weight])

  const totals = logTotals(todayLog)
  const items = todayLog?.items ?? []
  const remaining = (targets?.targetKcal ?? 0) - (totals?.kcal ?? 0)
  const remainingLabel = remaining >= 0
    ? `${remaining.toLocaleString('fr-FR')} kcal restantes`
    : `${Math.abs(remaining).toLocaleString('fr-FR')} kcal au-dessus`

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  function saveWeight() {
    const nextWeight = parseFloat(weight)
    onSave({ date: todayStr(), weight: Number.isNaN(nextWeight) ? null : nextWeight })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <div className="view today-view">
      <section className="today-hero card">
        <header className="view-header today-hero-header">
          <div>
            <div className="view-title">Jour</div>
            <div className="view-subtitle">{dateLabel}</div>
          </div>
        </header>

        <div className="today-hero-badges">
          {streak > 0 && <div className="badge badge-streak">Serie {streak}j</div>}
          <div className="badge badge-dim">{progressPct}% objectif</div>
        </div>

        <div className="today-hero-body">
          <div className="today-hero-priority">
            <div className="today-hero-priority-card">
              <div className="section-eyebrow">Poids</div>
              <div className="section-title">Pesee du matin</div>
              <div className="inline-input-row">
                <div className="ig">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    placeholder={currentWeight.toFixed(1)}
                    value={weight}
                    onChange={(event) => {
                      setWeight(event.target.value)
                      setSaved(false)
                    }}
                  />
                </div>
                <button className={`inline-save-btn ${saved ? 'saved' : ''}`} onClick={saveWeight}>
                  OK
                </button>
              </div>
            </div>

            <div className="dq today-dq-card today-hero-dq-card">
              <span className="dq-lbl">Progression</span>
              <div className="dq-track">
                <div className="dq-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="dq-pct">{progressPct}%</span>
            </div>
          </div>

          <div className="today-hero-summary">
            <div className="today-hero-kicker">Budget</div>
            <div className="today-hero-remaining">{remainingLabel}</div>
            <div className="today-hero-note">
              {totals.kcal.toLocaleString('fr-FR')} / {targets.targetKcal.toLocaleString('fr-FR')} kcal
            </div>
          </div>
        </div>
      </section>

      <section className="today-primary-card">
        <div className="section-heading today-macros-heading">
          <div className="today-macros-heading-copy">
            <div className="section-eyebrow">Budget et macros</div>
            <div className="section-title">Repères du jour</div>
          </div>
          <button className="btn-ghost btn-ghost-inline today-macros-planner-btn" onClick={onOpenPlanner}>
            Plan repas
          </button>
        </div>

        <div className="today-primary-card-grid">
          <div className="center-section today-kpi-card">
            <KcalRing consumed={totals.kcal} target={targets.targetKcal} />
            <div className="tdee-panel">
              <div className="tdee-row">
                <span className="tdee-lbl">Reste</span>
                <span className={`tdee-val ${remaining >= 0 ? 'accent' : ''}`}>
                  {remaining >= 0 ? `${remaining} kcal` : `+${Math.abs(remaining)} kcal`}
                </span>
              </div>
              <div className="tdee-row">
                <span className="tdee-lbl">Cible</span>
                <span className="tdee-val">{targets.targetKcal} kcal</span>
              </div>
              <div className="tdee-row">
                <span className="tdee-lbl">Maintien</span>
                <span className="tdee-val muted">{tdee} kcal</span>
              </div>
              <div className="tdee-row">
                <span className="tdee-lbl">Poids</span>
                <span className="tdee-val muted">
                  {currentWeight.toFixed(1)} / {settings.goalWeight} kg
                </span>
              </div>
            </div>
          </div>

          <div className="today-macros-panel">
            <MacroBar label="Proteines" consumed={totals.protein} target={targets.protein} color="var(--p-color)" />
            <MacroBar label="Glucides" consumed={totals.carbs} target={targets.carbs} color="var(--c-color)" />
            <MacroBar label="Lipides" consumed={totals.fat} target={targets.fat} color="var(--f-color)" />
          </div>
        </div>
      </section>

      <section className="log-form today-meals-card">
        <div className="section-heading section-heading-inline">
          <div>
            <div className="section-eyebrow">Journal</div>
            <div className="section-title">
              Repas du jour
              {items.length > 0 && (
                <span className="section-meta">
                  {items.length} item{items.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="today-empty-food">
            <div className="today-empty-icon">&#9633;</div>
            <div>Aucun repas logge.</div>
            <div className="today-empty-note">Passe par Ajouter pour scanner, photo ou saisie manuelle.</div>
          </div>
        ) : (
          <div className="food-list">
            {items.map((item) => (
              <FoodItem key={item.id} item={item} onRemove={() => onRemoveItem(todayStr(), item.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
