import { computeBMR, computeBMI, idealWeight, ACTIVITY_LEVELS } from '../algo'

export default function Metabolism({ settings, currentWeight, initialTDEE, tdee, targets, dq }) {
  const bmr  = computeBMR({ weight: currentWeight, height: settings.height, age: settings.age, sex: settings.sex })
  const bmi  = computeBMI(currentWeight, settings.height)
  const iw   = idealWeight(settings.height, settings.sex)
  const act  = ACTIVITY_LEVELS.find((a) => a.value === settings.activityLevel) ?? ACTIVITY_LEVELS[1]
  const tdeeAdapted = dq >= 70

  const bmiColor = !bmi ? 'var(--tx)' :
    bmi.bmi < 18.5 ? 'var(--info)' :
    bmi.bmi < 25   ? 'var(--ok)' :
    bmi.bmi < 30   ? 'var(--f-color)' : 'var(--danger)'

  const cascade = [
    {
      label: 'BMR — repos absolu',
      val: bmr ?? '—', unit: 'kcal/j',
      note: 'Mifflin-St Jeor · énergie minimale vitale',
      color: 'var(--tx)',
    },
    {
      label: `TDEE de base · ×${settings.activityLevel}`,
      val: initialTDEE, unit: 'kcal/j',
      note: act.label + ' — ' + act.desc,
      color: 'var(--tx)',
    },
    {
      label: tdeeAdapted ? 'TDEE adaptatif ●' : 'TDEE estimé ○',
      val: tdee, unit: 'kcal/j',
      note: tdeeAdapted
        ? `Calculé sur tes logs réels (qualité ${dq}%)`
        : 'Données insuffisantes — continue à logger 14j',
      color: 'var(--acc)',
    },
    {
      label: 'Target journalier',
      val: targets.targetKcal, unit: 'kcal/j',
      note: `Déficit −${targets.deficitDay} kcal · −${settings.weeklyLoss}kg/sem`,
      color: 'var(--ok)',
    },
  ]

  const macroRows = [
    { label: 'Protéines', val: targets.protein,    unit: 'g', color: 'var(--p-color)', kcal: targets.protein * 4,    note: `${settings.proteinPerKg}g/kg · préserve la masse musculaire` },
    { label: 'Glucides',  val: targets.carbs,      unit: 'g', color: 'var(--c-color)', kcal: targets.carbs * 4,      note: 'Énergie · complémentaire protéines + lipides' },
    { label: 'Lipides',   val: targets.fat,        unit: 'g', color: 'var(--f-color)', kcal: targets.fat * 9,        note: 'Hormones · santé · satiété' },
    { label: 'TOTAL',     val: targets.targetKcal, unit: 'kcal', color: 'var(--acc)', kcal: null,                    note: '' },
  ]

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">MÉTABO</div>
          <div className="view-subtitle">Analyse énergétique complète</div>
        </div>
      </div>

      {/* ── Biométrie ── */}
      <div className="stat-grid">
        {[
          { lbl: 'Poids actuel',  val: currentWeight.toFixed(1), unit: 'kg' },
          { lbl: 'Taille',        val: settings.height,           unit: 'cm' },
          { lbl: 'Âge',           val: settings.age,              unit: 'ans' },
          { lbl: 'Sexe',          val: settings.sex === 'male' ? 'Homme' : 'Femme', unit: '' },
        ].map((s) => (
          <div className="stat-card" key={s.lbl}>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-val" style={{ fontSize: 20 }}>
              {s.val}
              {s.unit && <span className="stat-unit">{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── IMC ── */}
      {bmi && (
        <div className="card">
          <div className="card-title">IMC</div>
          <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', marginBottom: 'var(--s3)' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{
                fontFamily: 'var(--f-mono)', fontSize: 44, fontWeight: 500,
                color: bmiColor, lineHeight: 1,
              }}>{bmi.bmi}</div>
              <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 3, letterSpacing: 1 }}>KG/M²</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: bmiColor, marginBottom: 4 }}>
                {bmi.cat}
              </div>
              {iw && (
                <div style={{ fontSize: 12, color: 'var(--tx-3)', fontFamily: 'var(--f-mono)' }}>
                  Poids idéal estimé · {iw} kg
                </div>
              )}
              {iw && (
                <div style={{ fontSize: 12, color: 'var(--tx-3)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
                  Objectif · {settings.goalWeight} kg
                </div>
              )}
            </div>
          </div>
          {/* Barre IMC colorée */}
          <div style={{ height: 7, display: 'flex', borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {[
              { c: '#60a5fa', w: 20 }, { c: '#34d399', w: 25 },
              { c: '#fbbf24', w: 20 }, { c: '#fb923c', w: 17 }, { c: '#f87171', w: 18 },
            ].map((seg, i) => (
              <div key={i} style={{ width: `${seg.w}%`, background: seg.c }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {['<18.5', '25', '30', '35', '40+'].map((l) => (
              <div key={l} style={{ fontSize: 8, color: 'var(--tx-3)' }}>{l}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cascade énergétique ── */}
      <div className="card">
        <div className="card-title">Cascade énergétique</div>
        {cascade.map((step, i) => (
          <div key={i}>
            <div className="meta-row">
              <div className="meta-lbl">{step.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <div className="meta-val" style={{ color: step.color }}>{step.val}</div>
                <div className="meta-unit">{step.unit}</div>
              </div>
              <div className="meta-note">{step.note}</div>
            </div>
            {i < cascade.length - 1 && (
              <div style={{ textAlign: 'center', color: 'var(--tx-3)', fontSize: 16, margin: '2px 0' }}>↓</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Macros ── */}
      <div className="card">
        <div className="card-title">Targets macros journalières</div>
        {macroRows.map((m, i) => (
          <div key={m.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--s2) 0',
            borderBottom: i < macroRows.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.label}</div>
              {m.note && <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 1 }}>{m.note}</div>}
              {m.kcal != null && <div style={{ fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--f-mono)' }}>{Math.round(m.kcal)} kcal</div>}
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 20, color: m.color, fontWeight: 500 }}>
              {m.val} <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{m.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Algo expliqué ── */}
      <div className="card">
        <div className="card-title">Comment l'algo adaptatif fonctionne</div>
        <div style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          <p><strong style={{ color: 'var(--tx)' }}>Phase 1 · Estimation (0–13j)</strong><br />
          TDEE calculé depuis ton BMR Mifflin-St Jeor × coefficient d'activité. C'est une approximation.</p>
          <p><strong style={{ color: 'var(--tx)' }}>Phase 2 · Adaptation (14j+)</strong><br />
          L'algo compare le poids moyen semaine N vs N−1 et déduit ton TDEE réel :</p>
          <div className="code-block">
            TDEE = avg_kcal(7j) − (Δpoids × 7700 ÷ 7)
          </div>
          <p>La moyenne glissante 7j lisse les variations d'eau et glycogène. Plus tu logs, plus le TDEE adaptatif est précis.</p>
        </div>
      </div>
    </div>
  )
}
