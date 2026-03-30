import { computeBMR, computeBMI, idealWeight, ACTIVITY_LEVELS } from '../algo'

function qualityTone(level) {
  if (level === 'elevee') return 'var(--ok)'
  if (level === 'bonne') return 'var(--acc)'
  if (level === 'moyenne') return 'var(--info)'
  return 'var(--danger)'
}

export default function Metabolism({
  settings,
  currentWeight,
  initialTDEE,
  tdee,
  targets,
  dq,
  quality,
  energyModel,
}) {
  const bmr = computeBMR({
    weight: currentWeight,
    height: settings.height,
    age: settings.age,
    sex: settings.sex,
  })
  const bmi = computeBMI(currentWeight, settings.height)
  const iw = idealWeight(settings.height, settings.sex)
  const act = ACTIVITY_LEVELS.find((item) => item.value === settings.activityLevel) ?? ACTIVITY_LEVELS[1]
  const tdeeAdapted = energyModel?.useAdaptive ?? false
  const signalColor = qualityTone(quality?.level)

  const bmiColor = !bmi
    ? 'var(--tx)'
    : bmi.bmi < 18.5
      ? 'var(--info)'
      : bmi.bmi < 25
        ? 'var(--ok)'
        : bmi.bmi < 30
          ? 'var(--f-color)'
          : 'var(--danger)'

  const cascade = [
    {
      label: 'BMR',
      val: bmr ?? '-',
      unit: 'kcal/j',
      note: 'Repos complet',
      color: 'var(--tx)',
    },
    {
      label: `TDEE base x${settings.activityLevel}`,
      val: initialTDEE,
      unit: 'kcal/j',
      note: act.label,
      color: 'var(--tx)',
    },
    {
      label: tdeeAdapted ? 'TDEE adaptatif' : 'TDEE prudent',
      val: tdee,
      unit: 'kcal/j',
      note: tdeeAdapted
        ? `Signal ${energyModel?.confidenceLabel ?? 'Faible'}`
        : `Signal ${dq}%`,
      color: 'var(--acc)',
    },
    {
      label: 'Cible',
      val: targets.targetKcal,
      unit: 'kcal/j',
      note: `Deficit ${targets.deficitDay} kcal/j`,
      color: 'var(--ok)',
    },
  ]

  const macroRows = [
    { label: 'Proteines', val: targets.protein, unit: 'g', color: 'var(--p-color)' },
    { label: 'Glucides', val: targets.carbs, unit: 'g', color: 'var(--c-color)' },
    { label: 'Lipides', val: targets.fat, unit: 'g', color: 'var(--f-color)' },
  ]

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Metabolisme</div>
          <div className="view-subtitle">BMR, TDEE, cible</div>
        </div>
      </div>

      <div className="stat-grid">
        {[
          { lbl: 'Poids', val: currentWeight.toFixed(1), unit: 'kg' },
          { lbl: 'Taille', val: settings.height, unit: 'cm' },
          { lbl: 'Age', val: settings.age, unit: 'ans' },
          { lbl: 'Sexe', val: settings.sex === 'male' ? 'Homme' : 'Femme', unit: '' },
        ].map((item) => (
          <div className="stat-card" key={item.lbl}>
            <div className="stat-lbl">{item.lbl}</div>
            <div className="stat-val" style={{ fontSize: 20 }}>
              {item.val}
              {item.unit && <span className="stat-unit">{item.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Signal</div>
        <div className="today-confidence-top">
          <span className={`quality-dot quality-dot-${quality?.level ?? 'faible'}`} />
          <span className="today-confidence-label">{energyModel?.confidenceLabel ?? quality?.label ?? 'Faible'}</span>
        </div>
        <div className="today-confidence-note" style={{ marginTop: 'var(--s2)' }}>
          {tdeeAdapted
            ? `${energyModel?.sampleCount ?? 0} logs complets sur ${energyModel?.spanDays ?? 0} jours`
            : 'Signal encore trop court pour adapter fortement le TDEE'}
        </div>
        <div className="meta-row">
          <div className="meta-lbl">Qualite</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <div className="meta-val" style={{ color: signalColor }}>{dq}</div>
            <div className="meta-unit">/100</div>
          </div>
          <div className="meta-note">
            {quality?.completeDays ?? 0} jours complets · {quality?.weightDays ?? 0} pesees · {quality?.kcalDays ?? 0} jours kcal
          </div>
        </div>
      </div>

      {bmi && (
        <div className="card">
          <div className="card-title">IMC</div>
          <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', marginBottom: 'var(--s3)' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: 44,
                  fontWeight: 500,
                  color: bmiColor,
                  lineHeight: 1,
                }}
              >
                {bmi.bmi}
              </div>
              <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 3, letterSpacing: 1 }}>KG/M2</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: bmiColor, marginBottom: 4 }}>
                {bmi.cat}
              </div>
              {iw && (
                <div style={{ fontSize: 12, color: 'var(--tx-3)', fontFamily: 'var(--f-mono)' }}>
                  Ideal estime · {iw} kg
                </div>
              )}
              {iw && (
                <div style={{ fontSize: 12, color: 'var(--tx-3)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
                  Objectif · {settings.goalWeight} kg
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Cascade</div>
        {cascade.map((step) => (
          <div key={step.label} className="meta-row">
            <div className="meta-lbl">{step.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div className="meta-val" style={{ color: step.color }}>{step.val}</div>
              <div className="meta-unit">{step.unit}</div>
            </div>
            <div className="meta-note">{step.note}</div>
          </div>
        ))}

        <div className="metabolism-macros-block">
          <div className="card-title metabolism-macros-title">Macros cibles</div>
          <div className="metabolism-macros-grid">
            {macroRows.map((macro) => (
              <div key={macro.label} className="metabolism-macro-card">
                <div className="metabolism-macro-label" style={{ color: macro.color }}>
                  {macro.label}
                </div>
                <div className="metabolism-macro-value" style={{ color: macro.color }}>
                  {macro.val}
                  <span className="metabolism-macro-unit">{macro.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
