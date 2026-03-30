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
      'Routine preselectionnee: ouvrir MacroCut et faire ton check-in.',
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
      <section className="card onboarding-card">
        <div className="onboarding-progress">
          {STEPS.map((item, index) => (
            <span
              key={item.eyebrow}
              className={`onboarding-progress-step ${index === step ? 'active' : index < step ? 'done' : ''}`}
            />
          ))}
        </div>

        <div className="section-eyebrow">{current.eyebrow}</div>
        <div className="onboarding-title">{current.title}</div>
        <div className="onboarding-body">{current.body}</div>

        <div className="onboarding-points">
          {current.points.map((point) => (
            <div key={point} className="onboarding-point">
              <span className="onboarding-point-mark">+</span>
              <span>{point}</span>
            </div>
          ))}
        </div>

        {isLast && (
          <div className="onboarding-status">
            <div className="onboarding-status-label">Etat rappels</div>
            <strong>{statusLabel}</strong>
            <span className="onboarding-status-copy">
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
