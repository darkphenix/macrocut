import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../store'
import { ACTIVITY_LEVELS } from '../algo'
import {
  requestPermission,
  getPermission,
  sendTestNotification,
  saveNotifSettings,
} from '../notifications'

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.34 2.62 9.78 4.2a1.9 1.9 0 0 1-2.25 1.2L5.9 5a1.9 1.9 0 0 0-2.3 2.3l.4 1.63a1.9 1.9 0 0 1-1.2 2.25l-1.58.56a1.9 1.9 0 0 0 0 3.52l1.58.56a1.9 1.9 0 0 1 1.2 2.25l-.4 1.63a1.9 1.9 0 0 0 2.3 2.3l1.63-.4a1.9 1.9 0 0 1 2.25 1.2l.56 1.58a1.9 1.9 0 0 0 3.52 0l.56-1.58a1.9 1.9 0 0 1 2.25-1.2l1.63.4a1.9 1.9 0 0 0 2.3-2.3l-.4-1.63a1.9 1.9 0 0 1 1.2-2.25l1.58-.56a1.9 1.9 0 0 0 0-3.52l-1.58-.56a1.9 1.9 0 0 1-1.2-2.25l.4-1.63a1.9 1.9 0 0 0-2.3-2.3l-1.63.4a1.9 1.9 0 0 1-2.25-1.2l-.56-1.58a1.9 1.9 0 0 0-3.52 0Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 20a7 7 0 0 0-14 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  )
}

function Toggle({ checked, onChange, name, desc, disabled = false }) {
  return (
    <div className="toggle-row" style={disabled ? { opacity: 0.72 } : undefined}>
      <div className="toggle-info">
        <div className="toggle-name">{name}</div>
        {desc && <div className="toggle-desc">{desc}</div>}
      </div>
      <label className="toggle" style={disabled ? { cursor: 'not-allowed' } : undefined}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="toggle-track" />
      </label>
    </div>
  )
}

function AppSettingsSection({
  storageInfo,
  importBusy,
  triggerImport,
  handleImportFile,
  handleExportBackup,
  backupMsg,
  backupErr,
  fileInputRef,
  permBannerClass,
  permText,
  permission,
  handleRequestPerm,
  theme,
  onThemeChange,
  notif,
  updateNotif,
  onReplayOnboarding,
}) {
  const storageSummary =
    storageInfo?.status === 'warning'
      ? 'Pense a exporter bientot.'
      : storageInfo?.status === 'blocked'
        ? "Le stockage local n'est pas accessible."
        : storageInfo?.status === 'unsupported'
          ? "Le stockage n'est pas disponible ici."
          : 'Tes donnees restent sur cet appareil.'

  return (
    <>
      <div className={`card storage-card storage-card-${storageInfo?.status ?? 'ok'}`}>
        <div className="card-title">Sauvegarde</div>
        <div className="storage-summary">
          <strong>{storageInfo?.message ?? 'Stockage local actif.'}</strong>
          <span>{storageSummary}</span>
        </div>
        <div className="storage-grid">
          <div className="storage-metric">
            <span className="storage-label">Volume</span>
            <strong>{storageInfo?.storageLabel ?? '-'}</strong>
          </div>
          <div className="storage-metric">
            <span className="storage-label">Elements</span>
            <strong>{storageInfo?.keyCount ?? 0}</strong>
          </div>
        </div>

        <div className="storage-actions">
          <button className="save-btn" onClick={handleExportBackup} disabled={!storageInfo?.supportsBackup}>
            Exporter
          </button>
          <button className="btn-ghost" onClick={triggerImport} disabled={importBusy}>
            {importBusy ? 'Import...' : 'Importer'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            hidden
          />
        </div>

        {backupMsg && <div className="storage-feedback ok">{backupMsg}</div>}
        {backupErr && <div className="storage-feedback err">{backupErr}</div>}
      </div>

      <div className={permBannerClass}>
        <div>
          <div className="notif-banner-title">{permText.title}</div>
          <div className="notif-banner-body">{permText.body}</div>
        </div>
        {permission === 'default' && (
          <button className="save-btn" onClick={handleRequestPerm}>
            Autoriser les rappels
          </button>
        )}
      </div>

      <div className="sgroup">
        <div className="sgroup-title">Apparence</div>
        <div className="seg-tabs">
          <button className={`seg-btn ${theme === 'system' ? 'active' : ''}`} onClick={() => onThemeChange('system')}>
            Systeme
          </button>
          <button className={`seg-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => onThemeChange('light')}>
            Clair
          </button>
          <button className={`seg-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => onThemeChange('dark')}>
            Sombre
          </button>
        </div>
      </div>

      <div className="sgroup">
        <div className="sgroup-title">Routine et rappels</div>

        <Toggle
          name="Notifications"
          desc="Matin et soir"
          checked={notif.enabled}
          disabled={permission !== 'granted'}
          onChange={(value) => updateNotif('enabled', value)}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--s3)',
            padding: '10px 0',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>Mode</span>
          <strong>Automatique</strong>
        </div>

        {permission === 'granted' && notif.enabled && (
          <>
            <div className="time-row">
              <span className="time-label">Heure preferee du matin</span>
              <input
                type="time"
                value={notif.morningTime}
                onChange={(event) => updateNotif('morningTime', event.target.value)}
              />
            </div>

            <div className="time-row">
              <span className="time-label">Heure de fermeture du soir</span>
              <input
                type="time"
                value={notif.eveningTime}
                onChange={(event) => updateNotif('eveningTime', event.target.value)}
              />
            </div>

            <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6 }}>
              Rappel principal le matin, fermeture le soir.
            </div>
          </>
        )}

        {permission === 'denied' && (
          <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6 }}>
            Pour reactiver les rappels, il faut les autoriser depuis les reglages du navigateur.
          </div>
        )}

        {permission === 'granted' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--s2)' }}>
            <button className="btn-ghost" onClick={() => sendTestNotification('routine')}>
              Tester routine
            </button>
            <button className="btn-ghost" onClick={() => sendTestNotification('closure')}>
              Tester fermeture
            </button>
          </div>
        )}
      </div>

      <div className="sgroup">
        <div className="sgroup-title">Demarrage</div>
        <button className="btn-ghost" onClick={onReplayOnboarding}>
          Revoir le tutoriel
        </button>
      </div>
    </>
  )
}

function ProfileSettingsSection({ form, updateField, deficitDay }) {
  return (
    <>
      <div className="card settings-profile-card">
        <div className="card-title">Profil nutrition</div>
        <div className="settings-profile-copy">
          Regroupe ici tout ce qui influence les calculs: biometrie, activite, objectif, macros et TDEE.
        </div>
      </div>

      <div className="sgroup">
        <div className="sgroup-title">Biometrie</div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Sexe</span></div>
          <div className="sex-toggle">
            {['male', 'female'].map((sex) => (
              <button
                key={sex}
                className={`sex-btn ${form.sex === sex ? 'active' : ''}`}
                onClick={() => updateField('sex', sex)}
              >
                {sex === 'male' ? 'Homme' : 'Femme'}
              </button>
            ))}
          </div>
        </div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Taille (cm)</span></div>
          <input
            type="number"
            step="1"
            value={form.height}
            onChange={(event) => updateField('height', event.target.value)}
            inputMode="numeric"
          />
        </div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Age</span></div>
          <input
            type="number"
            step="1"
            value={form.age}
            onChange={(event) => updateField('age', event.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="sgroup">
        <div className="sgroup-title">Activite</div>
        {ACTIVITY_LEVELS.map((activity) => (
          <button
            key={activity.value}
            className={`activity-btn ${form.activityLevel === activity.value ? 'active' : ''}`}
            onClick={() => updateField('activityLevel', activity.value)}
          >
            <div>
              <div className="activity-btn-name">{activity.label}</div>
              <div className="activity-btn-desc">{activity.desc}</div>
            </div>
            <div className="activity-btn-mult">x{activity.value}</div>
          </button>
        ))}
      </div>

      <div className="sgroup">
        <div className="sgroup-title">Objectif</div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Poids de depart (kg)</span></div>
          <input
            type="number"
            step="0.1"
            value={form.startWeight}
            onChange={(event) => updateField('startWeight', event.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Poids cible (kg)</span></div>
          <input
            type="number"
            step="0.1"
            value={form.goalWeight}
            onChange={(event) => updateField('goalWeight', event.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className="srow">
          <div className="srow-head">
            <span className="srow-name">Perte / semaine (kg)</span>
            <span className="srow-hint">-{deficitDay} kcal/j</span>
          </div>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="1.5"
            value={form.weeklyLoss}
            onChange={(event) => updateField('weeklyLoss', event.target.value)}
            inputMode="decimal"
          />
          {form.weeklyLoss > 1 && (
            <p className="srow-note danger">
              Objectif agressif. Plus la cible est rapide, plus l adherence devient fragile.
            </p>
          )}
        </div>
      </div>

      <div className="sgroup">
        <div className="sgroup-title">Macros</div>

        <div className="srow">
          <div className="srow-head"><span className="srow-name">Proteines (g/kg)</span></div>
          <input
            type="number"
            step="0.1"
            min="1.2"
            max="3.5"
            value={form.proteinPerKg}
            onChange={(event) => updateField('proteinPerKg', event.target.value)}
            inputMode="decimal"
          />
          {form.proteinPerKg > 2.6 && (
            <p className="srow-note">
              Valeur elevee : utile dans certains contextes, mais pas indispensable pour tout le monde.
            </p>
          )}
        </div>

        <div className="srow">
          <div className="srow-head">
            <span className="srow-name">Lipides (% kcal)</span>
            <span className="srow-hint">{form.fatPercent}%</span>
          </div>
          <input
            type="number"
            step="1"
            min="15"
            max="50"
            value={form.fatPercent}
            onChange={(event) => updateField('fatPercent', event.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="sgroup">
        <div className="sgroup-title">TDEE manuel</div>
        <div className="srow">
          <div className="srow-head">
            <span className="srow-name">Valeur fixe (kcal)</span>
            <span className="srow-hint">{form.manualTDEE > 0 ? 'Actif' : 'Auto'}</span>
          </div>
          <input
            type="number"
            step="50"
            min="0"
            value={form.manualTDEE}
            onChange={(event) => updateField('manualTDEE', event.target.value)}
            inputMode="numeric"
            placeholder="0 = calcule auto"
          />
          <p className="srow-note">0 = auto</p>
        </div>
      </div>
    </>
  )
}

export default function Settings({
  mode = 'app',
  settings,
  onSave,
  notifSettings,
  onSaveNotif,
  storageInfo,
  onExportBackup,
  onImportBackup,
  importBusy = false,
  onReplayOnboarding = () => {},
  theme = 'system',
  onThemeChange = () => {},
  onOpenProfile = () => {},
  onOpenApp = () => {},
  onClose = () => {},
}) {
  const [form, setForm] = useState({ ...settings })
  const [saved, setSaved] = useState(false)
  const [notif, setNotif] = useState({ ...notifSettings })
  const [permission, setPermission] = useState(notifSettings?.permissionState ?? getPermission())
  const [backupMsg, setBackupMsg] = useState('')
  const [backupErr, setBackupErr] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    setForm({ ...settings })
  }, [settings])

  useEffect(() => {
    setNotif({ ...notifSettings })
    setPermission(notifSettings?.permissionState ?? getPermission())
  }, [notifSettings])

  function updateField(field, value) {
    const parsed = field === 'sex' ? value : parseFloat(value)
    setForm((current) => ({ ...current, [field]: Number.isNaN(parsed) ? value : parsed }))
    setSaved(false)
  }

  function pushNotifUpdate(next) {
    setNotif(next)
    setPermission(next.permissionState ?? getPermission())
    onSaveNotif(next)
    saveNotifSettings(next)
  }

  function updateNotif(field, value) {
    pushNotifUpdate({ ...notif, [field]: value, permissionState: permission })
  }

  async function handleRequestPerm() {
    const result = await requestPermission()
    const askedAt = new Date().toISOString()
    pushNotifUpdate({
      ...notif,
      enabled: result === 'granted',
      permissionAskedAt: askedAt,
      permissionState: result,
    })
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBackupErr('')
    setBackupMsg('')
    try {
      const result = await onImportBackup?.(file)
      setBackupMsg(result?.message ?? 'Sauvegarde importee.')
    } catch (error) {
      setBackupErr(String(error?.message ?? error ?? 'Import impossible.'))
    } finally {
      event.target.value = ''
    }
  }

  function triggerImport() {
    fileInputRef.current?.click()
  }

  function handleExportBackup() {
    setBackupErr('')
    setBackupMsg('')
    try {
      const result = onExportBackup?.()
      setBackupMsg(result?.message ?? 'Sauvegarde exportee.')
    } catch (error) {
      setBackupErr(String(error?.message ?? error ?? 'Export impossible.'))
    }
  }

  function saveMain() {
    onSave({ ...form })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  function reset() {
    if (confirm('Remettre tous les reglages par defaut ?')) {
      setForm({ ...DEFAULT_SETTINGS })
      onSave({ ...DEFAULT_SETTINGS })
    }
  }

  const deficitDay = Math.round(((form.weeklyLoss || 0) * 7700) / 7)
  const permBannerClass =
    permission === 'granted'
      ? 'notif-banner granted'
      : permission === 'denied'
        ? 'notif-banner denied'
        : 'notif-banner prompt'

  const permText =
    permission === 'granted'
      ? {
          title: 'Rappels disponibles',
          body: 'Le coach peut te relancer pour la routine du matin et la fermeture du soir.',
        }
      : permission === 'denied'
        ? {
            title: 'Rappels bloques',
            body: 'Le navigateur bloque actuellement les notifications. Tu peux toujours utiliser le coach sans elles.',
          }
        : permission === 'unsupported'
          ? {
              title: 'Notifications non supportees',
              body: 'Le navigateur ne peut pas afficher de rappels locaux ici.',
            }
          : {
              title: 'Activer le coach de routine',
              body: 'Autorise les rappels pour garder un petit rythme quotidien sans compter sur la motivation du moment.',
            }

  const isProfileMode = mode === 'profile'

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">{isProfileMode ? 'Profil' : 'Reglages'}</div>
          <div className="view-subtitle">
            {isProfileMode ? 'Biometrie, objectifs, macros' : 'App, sauvegarde, rappels'}
          </div>
        </div>
        <div className="settings-header-actions">
          <button
            className={`settings-switch-btn ${!isProfileMode ? 'active' : ''}`}
            onClick={onOpenApp}
            aria-label="Ouvrir les reglages de l app"
          >
            <SettingsIcon />
          </button>
          <button
            className={`settings-switch-btn ${isProfileMode ? 'active' : ''}`}
            onClick={onOpenProfile}
            aria-label="Ouvrir le profil"
          >
            <ProfileIcon />
          </button>
          <button className="btn-ghost btn-ghost-inline" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>

      {isProfileMode ? (
        <ProfileSettingsSection form={form} updateField={updateField} deficitDay={deficitDay} />
      ) : (
        <AppSettingsSection
          storageInfo={storageInfo}
          importBusy={importBusy}
          triggerImport={triggerImport}
          handleImportFile={handleImportFile}
          handleExportBackup={handleExportBackup}
          backupMsg={backupMsg}
          backupErr={backupErr}
          fileInputRef={fileInputRef}
          permBannerClass={permBannerClass}
          permText={permText}
          permission={permission}
          handleRequestPerm={handleRequestPerm}
          theme={theme}
          onThemeChange={onThemeChange}
          notif={notif}
          updateNotif={updateNotif}
          onReplayOnboarding={onReplayOnboarding}
        />
      )}

      {isProfileMode && (
        <>
          <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={saveMain}>
            {saved ? 'Sauvegarde' : 'Sauvegarder'}
          </button>
          <button className="btn-ghost" onClick={reset}>Reinitialiser par defaut</button>
        </>
      )}
    </div>
  )
}
