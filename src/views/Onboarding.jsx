import { useMemo, useState } from 'react'

const STEPS = [
  {
    eyebrow: 'Bienvenue',
    title: 'On vise la constance',
    body: "Tu sais deja quoi faire. L'objectif ici est de rendre le suivi assez simple pour le tenir chaque jour.",
    points: [
      'Pas de perfection demandee.',
      'Une boucle quotidienne courte vaut mieux qu un grand plan abandonne.',
    ],
  },
  {
    eyebrow: 'Methode',
    title: 'Trois gestes rapides',
    body: "Ouvre l'app, enregistre ton jour, puis ferme. Meme en version mini, la repetition fait la difference.",
    points: [
      'Version mini acceptee les jours compliques.',
      'La repetition construit la confiance et la motivation.',
    ],
  },
  {
    eyebrow: 'Coach',
    title: 'Rappels utiles, pas intrusifs',
    body: "Le coach relance doucement pour t'aider a revenir, sans culpabiliser.",
    points: [
      'Matin: rappel de routine.',
      'Fin de journee: fermeture du suivi si besoin.',
    ],
  },
  {
    eyebrow: 'Activation',
    title: 'Pret a demarrer',
    body: 'On initialise une routine simple. Tu pourras tout ajuster ensuite dans Reglages.',
    points: [
      'Routine preselectionnee: ouvrir COUPURE et faire ton check-in.',
      'Notifications locales pour t aider a tenir petit a petit.',
    ],
  },
]

export default function Onboarding({ busy = false, permissionState = 'default', onFinish }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const statusLabel = useMemo(() => {
    if (permissionState === 'granted') return 'Rappels deja autorises'
    if (permissionState === 'denied') return 'Rappels actuellement bloques'
    if (permissionState === 'unsupported') return 'Notifications non supportees ici'
    return 'Permission demandee a l activation'
  }, [permissionState])

  return (
    <div className="view" style={{ minHeight: '100%', justifyContent: 'center' }}>
      <section
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s4)',
          padding: 'var(--s5)',
          background:
            'radial-gradient(circle at top right, rgba(245, 166, 35, 0.16), transparent 34%), linear-gradient(180deg, rgba(20, 20, 38, 0.98), rgba(16, 16, 31, 0.96))',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          {STEPS.map((item, index) => (
            <span
              key={item.eyebrow}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                background:
                  index === step
                    ? 'linear-gradient(90deg, var(--acc), var(--acc-2))'
                    : index < step
                      ? 'rgba(245,166,35,0.4)'
                      : 'rgba(255,255,255,0.08)',
                transform: index === step ? 'scaleY(1.2)' : 'none',
                transition: 'background var(--t-fast), transform var(--t-fast)',
              }}
            />
          ))}
        </div>

        <div className="section-eyebrow">{current.eyebrow}</div>
        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, color: 'var(--tx)' }}>{current.title}</div>
        <div style={{ fontSize: 14, color: 'var(--tx-2)', lineHeight: 1.7 }}>{current.body}</div>

        <div style={{ display: 'grid', gap: 'var(--s2)' }}>
          {current.points.map((point) => (
            <div
              key={point}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 12,
                borderRadius: 'var(--r2)',
                border: '1px solid var(--border)',
                background: 'rgba(8, 8, 16, 0.34)',
                color: 'var(--tx)',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <span style={{ color: 'var(--acc)', fontFamily: 'var(--f-mono)', fontSize: 14, lineHeight: 1.2 }}>+</span>
              <span>{point}</span>
            </div>
          ))}
        </div>

        {isLast && (
          <div
            style={{
              display: 'grid',
              gap: 4,
              padding: 'var(--s3)',
              borderRadius: 'var(--r2)',
              border: '1px solid var(--border-acc)',
              background: 'rgba(245, 166, 35, 0.08)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx-3)' }}>
              Etat rappels
            </div>
            <strong>{statusLabel}</strong>
            <span style={{ color: 'var(--tx-2)', fontSize: 12, lineHeight: 1.6 }}>
              Tu peux commencer sans permission puis activer les rappels plus tard.
            </span>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gap: 'var(--s2)' }}>
        {step > 0 && (
          <button className="btn-ghost" onClick={() => setStep((currentStep) => currentStep - 1)} disabled={busy}>
            Retour
          </button>
        )}

        {!isLast && (
          <button className="save-btn" onClick={() => setStep((currentStep) => currentStep + 1)}>
            Continuer
          </button>
        )}

        {isLast && (
          <>
            <button className="save-btn" onClick={() => onFinish(true)} disabled={busy}>
              {busy ? 'Activation...' : 'Creer ma routine et activer les rappels'}
            </button>
            <button className="btn-ghost" onClick={() => onFinish(false)} disabled={busy}>
              Commencer sans notifications
            </button>
          </>
        )}
      </div>
    </div>
  )
}
