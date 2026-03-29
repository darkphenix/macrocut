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
      label: 'BMR - repos absolu',
      val: bmr ?? '-',
      unit: 'kcal/j',
      note: 'Mifflin-St Jeor · energie minimale vitale',
      color: 'var(--tx)',
    },
    {
      label: `TDEE de base · x${settings.activityLevel}`,
      val: initialTDEE,
      unit: 'kcal/j',
      note: `${act.label} - ${act.desc}`,
      color: 'var(--tx)',
    },
    {
      label: tdeeAdapted ? 'TDEE adaptatif' : 'TDEE prudent',
      val: tdee,
      unit: 'kcal/j',
      note: tdeeAdapted
        ? `Fusion avec tes logs reels · confiance ${energyModel?.confidenceLabel ?? 'Faible'}`
        : `Signal insuffisant ou bruit trop eleve · qualite ${dq}%`,
      color: 'var(--acc)',
    },
    {
      label: 'Target journalier',
      val: targets.targetKcal,
      unit: 'kcal/j',
      note: `Deficit -${targets.deficitDay} kcal · -${settings.weeklyLoss}kg/sem`,
      color: 'var(--ok)',
    },
  ]

  const macroRows = [
    {
      label: 'Proteines',
      val: targets.protein,
      unit: 'g',
      color: 'var(--p-color)',
      kcal: targets.protein * 4,
      note: `${settings.proteinPerKg}g/kg · preserve la masse musculaire`,
    },
    {
      label: 'Glucides',
      val: targets.carbs,
      unit: 'g',
      color: 'var(--c-color)',
      kcal: targets.carbs * 4,
      note: 'Energie complementaire proteines + lipides',
    },
    {
      label: 'Lipides',
      val: targets.fat,
      unit: 'g',
      color: 'var(--f-color)',
      kcal: targets.fat * 9,
      note: 'Hormones · sante · satiete',
    },
    {
      label: 'TOTAL',
      val: targets.targetKcal,
      unit: 'kcal',
      color: 'var(--acc)',
      kcal: null,
      note: '',
    },
  ]

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">METABO</div>
          <div className="view-subtitle">Analyse energetique complete</div>
        </div>
      </div>

      <div className="stat-grid">
        {[
          { lbl: 'Poids actuel', val: currentWeight.toFixed(1), unit: 'kg' },
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
        <div className="card-title">Fiabilite du signal</div>
        <div className="today-confidence-top">
          <span className={`quality-dot quality-dot-${quality?.level ?? 'faible'}`} />
          <span className="today-confidence-label">{energyModel?.confidenceLabel ?? quality?.label ?? 'Faible'}</span>
        </div>
        <div className="today-confidence-note" style={{ marginTop: 'var(--s2)' }}>
          {tdeeAdapted
            ? `Adaptation active sur ${energyModel?.sampleCount ?? 0} logs complets recents, fenetre ${energyModel?.spanDays ?? 0} jours.`
            : 'Le moteur reste proche du TDEE de base tant que le signal est trop court, incomplet ou bruité.'}
        </div>
        <div className="meta-row">
          <div className="meta-lbl">Qualite des donnees</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <div className="meta-val" style={{ color: signalColor }}>{dq}</div>
            <div className="meta-unit">/100</div>
          </div>
          <div className="meta-note">
            {quality?.completeDays ?? 0} jours complets, {quality?.weightDays ?? 0} pesees, {quality?.kcalDays ?? 0} jours kcal sur {quality?.windowDays ?? 21} jours.
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
                  Poids ideal estime · {iw} kg
                </div>
              )}
              {iw && (
                <div style={{ fontSize: 12, color: 'var(--tx-3)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
                  Objectif · {settings.goalWeight} kg
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 7, display: 'flex', borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {[
              { c: '#60a5fa', w: 20 },
              { c: '#34d399', w: 25 },
              { c: '#fbbf24', w: 20 },
              { c: '#fb923c', w: 17 },
              { c: '#f87171', w: 18 },
            ].map((seg, index) => (
              <div key={index} style={{ width: `${seg.w}%`, background: seg.c }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {['<18.5', '25', '30', '35', '40+'].map((label) => (
              <div key={label} style={{ fontSize: 8, color: 'var(--tx-3)' }}>{label}</div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Cascade energetique</div>
        {cascade.map((step, index) => (
          <div key={step.label}>
            <div className="meta-row">
              <div className="meta-lbl">{step.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <div className="meta-val" style={{ color: step.color }}>{step.val}</div>
                <div className="meta-unit">{step.unit}</div>
              </div>
              <div className="meta-note">{step.note}</div>
            </div>
            {index < cascade.length - 1 && (
              <div style={{ textAlign: 'center', color: 'var(--tx-3)', fontSize: 16, margin: '2px 0' }}>↓</div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Targets macros journalieres</div>
        {macroRows.map((macro, index) => (
          <div
            key={macro.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--s2) 0',
              borderBottom: index < macroRows.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: macro.color }}>{macro.label}</div>
              {macro.note && <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 1 }}>{macro.note}</div>}
              {macro.kcal != null && (
                <div style={{ fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--f-mono)' }}>
                  {Math.round(macro.kcal)} kcal
                </div>
              )}
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 20, color: macro.color, fontWeight: 500 }}>
              {macro.val} <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{macro.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Comment l'algo adaptatif fonctionne</div>
        <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          <p>
            <strong style={{ color: 'var(--tx)' }}>Phase 1 · Base prudente</strong><br />
            TDEE calcule depuis ton BMR Mifflin-St Jeor x coefficient d'activite.
          </p>
          <p>
            <strong style={{ color: 'var(--tx)' }}>Phase 2 · Signal reel</strong><br />
            Le moteur observe une fenetre recente, filtre les outliers simples, puis compare la tendance de poids au niveau de calories logge.
          </p>
          <div className="code-block">
            TDEE brut = avg_kcal - (delta_poids x 7700 / nb_jours)
          </div>
          <p>
            Au lieu de basculer brutalement, COUPURE fusionne ce TDEE brut avec le TDEE de base selon la confiance du signal. Plus les logs sont reguliers, plus le modele ose s'adapter.
          </p>
        </div>
      </div>
    </div>
  )
}
