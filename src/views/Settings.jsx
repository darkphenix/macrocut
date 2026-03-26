import { useState } from 'react'
import { DEFAULT_SETTINGS } from '../store'
import { ACTIVITY_LEVELS } from '../algo'
import {
  requestPermission, getPermission, sendTestNotification,
  saveNotifSettings,
} from '../notifications'

function Toggle({ checked, onChange, name, desc }) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-name">{name}</div>
        {desc && <div className="toggle-desc">{desc}</div>}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-track" />
      </label>
    </div>
  )
}

export default function Settings({ settings, onSave, notifSettings, onSaveNotif }) {
  const [form, setForm]         = useState({ ...settings })
  const [saved, setSaved]       = useState(false)
  const [notif, setNotif]       = useState({ ...notifSettings })
  const [permission, setPerm]   = useState(getPermission)

  function setF(field, val) {
    const parsed = field === 'sex' ? val : parseFloat(val)
    setForm((f) => ({ ...f, [field]: isNaN(parsed) ? val : parsed }))
    setSaved(false)
  }
  function setN(field, val) {
    const updated = { ...notif, [field]: val }
    setNotif(updated)
    onSaveNotif(updated)
    saveNotifSettings(updated)
  }

  async function handleRequestPerm() {
    const result = await requestPermission()
    setPerm(result)
    if (result === 'granted') {
      setN('enabled', true)
      // Register periodic sync if available
      if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
        try {
          const sw = await navigator.serviceWorker.ready
          await sw.periodicSync.register('coupure-daily', { minInterval: 24 * 60 * 60 * 1000 })
        } catch {}
      }
    }
  }

  function saveMain() {
    onSave({ ...form })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  function reset() {
    if (confirm('Remettre tous les réglages par défaut ?')) {
      setForm({ ...DEFAULT_SETTINGS })
      onSave({ ...DEFAULT_SETTINGS })
    }
  }

  const deficitDay = Math.round(((form.weeklyLoss || 0) * 7700) / 7)

  const permBannerClass = permission === 'granted'
    ? 'notif-banner granted'
    : permission === 'denied'
    ? 'notif-banner denied'
    : 'notif-banner prompt'

  const permText = permission === 'granted'
    ? { title: '✓ Notifications activées', body: 'Tu recevras des rappels et messages de motivation.' }
    : permission === 'denied'
    ? { title: '✗ Notifications bloquées', body: 'Autorise les notifications dans les paramètres du navigateur.' }
    : { title: '🔔 Activer les notifications', body: 'Rappels poids du matin, log du soir et messages de motivation.' }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">RÉGLAGES</div>
          <div className="view-subtitle">Configuration personnelle</div>
        </div>
      </div>

      {/* ── Notifications ── */}
      <div className={permBannerClass}>
        <div>
          <div className="notif-banner-title">{permText.title}</div>
          <div className="notif-banner-body">{permText.body}</div>
        </div>
        {permission === 'default' && (
          <button className="save-btn" onClick={handleRequestPerm}>
            Autoriser
          </button>
        )}
      </div>

      {permission === 'granted' && (
        <div className="sgroup">
          <div className="sgroup-title">Notifications</div>

          <Toggle
            name="Rappels activés" desc="Poids matin, log soir"
            checked={notif.enabled}
            onChange={(v) => setN('enabled', v)}
          />

          {notif.enabled && (
            <>
              <div className="time-row">
                <span className="time-label">⚖️ Rappel poids (matin)</span>
                <input type="time" value={notif.morningTime}
                  onChange={(e) => setN('morningTime', e.target.value)} />
              </div>
              <div className="time-row">
                <span className="time-label">🍽️ Rappel repas (soir)</span>
                <input type="time" value={notif.eveningTime}
                  onChange={(e) => setN('eveningTime', e.target.value)} />
              </div>
              <Toggle
                name="Messages de motivation"
                desc="Apparaissent aléatoirement à l'ouverture après midi"
                checked={notif.motivationEnabled}
                onChange={(v) => setN('motivationEnabled', v)}
              />
            </>
          )}

          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <button className="btn-ghost" style={{ flex: 1 }}
              onClick={() => sendTestNotification('motivation')}>
              Test motivationnelle
            </button>
            <button className="btn-ghost" style={{ flex: 1 }}
              onClick={() => sendTestNotification('morning')}>
              Test rappel
            </button>
          </div>
        </div>
      )}

      {/* ── Biométrie ── */}
      <div className="sgroup">
        <div className="sgroup-title">Biométrie</div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Sexe</span></div>
          <div className="sex-toggle">
            {['male', 'female'].map((s) => (
              <button key={s}
                className={`sex-btn ${form.sex === s ? 'active' : ''}`}
                onClick={() => setF('sex', s)}
              >
                {s === 'male' ? '♂ Homme' : '♀ Femme'}
              </button>
            ))}
          </div>
        </div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Taille (cm)</span></div>
          <input type="number" step="1" value={form.height}
            onChange={(e) => setF('height', e.target.value)} inputMode="numeric" />
        </div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Âge</span></div>
          <input type="number" step="1" value={form.age}
            onChange={(e) => setF('age', e.target.value)} inputMode="numeric" />
        </div>
      </div>

      {/* ── Activité ── */}
      <div className="sgroup">
        <div className="sgroup-title">Niveau d'activité</div>
        {ACTIVITY_LEVELS.map((a) => (
          <button key={a.value}
            className={`activity-btn ${form.activityLevel === a.value ? 'active' : ''}`}
            onClick={() => setF('activityLevel', a.value)}
          >
            <div>
              <div className="activity-btn-name">{a.label}</div>
              <div className="activity-btn-desc">{a.desc}</div>
            </div>
            <div className="activity-btn-mult">×{a.value}</div>
          </button>
        ))}
      </div>

      {/* ── Objectif ── */}
      <div className="sgroup">
        <div className="sgroup-title">Objectif poids</div>
        <div className="srow">
          <div className="srow-head"><span className="srow-name">Poids de départ (kg)</span></div>
          <input type="number" step="0.1" value={form.startWeight}
            onChange={(e) => setF('startWeight', e.target.value)} inputMode="decimal" />
        </div>
        <div className="srow">
          <div className="srow-head"><span className="srow-name">Poids cible (kg)</span></div>
          <input type="number" step="0.1" value={form.goalWeight}
            onChange={(e) => setF('goalWeight', e.target.value)} inputMode="decimal" />
        </div>
        <div className="srow">
          <div className="srow-head">
            <span className="srow-name">Perte hebdomadaire (kg)</span>
            <span className="srow-hint">−{deficitDay} kcal/j</span>
          </div>
          <input type="number" step="0.1" min="0.1" max="1.5"
            value={form.weeklyLoss}
            onChange={(e) => setF('weeklyLoss', e.target.value)} inputMode="decimal" />
        </div>
      </div>

      {/* ── Macros ── */}
      <div className="sgroup">
        <div className="sgroup-title">Macros</div>
        <div className="srow">
          <div className="srow-head"><span className="srow-name">Protéines (g/kg)</span></div>
          <input type="number" step="0.1" min="1.2" max="3.5"
            value={form.proteinPerKg}
            onChange={(e) => setF('proteinPerKg', e.target.value)} inputMode="decimal" />
        </div>
        <div className="srow">
          <div className="srow-head">
            <span className="srow-name">Lipides (% kcal)</span>
            <span className="srow-hint">{form.fatPercent}%</span>
          </div>
          <input type="number" step="1" min="15" max="50"
            value={form.fatPercent}
            onChange={(e) => setF('fatPercent', e.target.value)} inputMode="numeric" />
        </div>
      </div>

      {/* ── TDEE manuel ── */}
      <div className="sgroup">
        <div className="sgroup-title">TDEE manuel (optionnel)</div>
        <div className="srow">
          <div className="srow-head">
            <span className="srow-name">Valeur fixe (kcal)</span>
            <span className="srow-hint">{form.manualTDEE > 0 ? 'Actif' : 'Auto'}</span>
          </div>
          <input type="number" step="50" min="0" value={form.manualTDEE}
            onChange={(e) => setF('manualTDEE', e.target.value)} inputMode="numeric"
            placeholder="0 = calculé auto" />
          <p className="srow-note">
            Laisse à 0 pour laisser l'algo calculer (BMR × activité puis adaptatif).
          </p>
        </div>
      </div>

      <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={saveMain}>
        {saved ? '✓ Sauvegardé' : 'Sauvegarder les réglages'}
      </button>
      <button className="btn-ghost" onClick={reset}>Réinitialiser par défaut</button>
    </div>
  )
}
