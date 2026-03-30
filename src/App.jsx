import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import Today from './views/Today'
import Settings from './views/Settings'
import Onboarding from './views/Onboarding'
import { loadSettings, loadLogs, saveSettings, saveLogs, todayStr, logTotals } from './store'
import { computeNutritionPipeline } from './algo'
import { getBackupSummary, downloadBackupFile, parseBackupFile, restoreBackupPayload } from './storage'
import {
  loadNotifSettings,
  saveNotifSettings,
  checkAndSendNotifications,
  requestPermission,
  getPermission,
} from './notifications'
import { loadHabit, saveHabit, loadHabitLogs, computeStreak, createDefaultCoachHabit } from './habitStore'
import { loadOnboardingState, saveOnboardingState } from './onboarding'
import { toDateKey } from './date'
import { ENABLE_VISION_FOOD } from './features'

const Scanner = lazy(() => import('./views/Scanner'))
const Metabolism = lazy(() => import('./views/Metabolism'))
const History = lazy(() => import('./views/History'))
const Habit = lazy(() => import('./views/Habit'))
const MealPlanner = lazy(() => import('./views/MealPlanner'))
const VisionFood = ENABLE_VISION_FOOD ? lazy(() => import('./views/Labo')) : null

const TAB_KEY = 'coupure_tab_v1'
const ADD_KEY = 'coupure_add_tab_v1'
const THEME_KEY = 'coupure_theme_v1'

function SettingsIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
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

function ProfileIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
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

const NAV_TABS = [
  { id: 'today', label: 'Jour', icon: '\u25CF' },
  { id: 'add', label: 'Ajouter', icon: '+' },
  { id: 'metabolism', label: 'Metabo', icon: <SettingsIcon /> },
  { id: 'motivation', label: 'Motiv.', icon: '\u{1F525}' },
  { id: 'journal', label: 'Journal', icon: '\u{1F4D2}' },
]

const ALL_TABS = [
  ...NAV_TABS,
  { id: 'settings', label: 'Reglages', icon: <SettingsIcon /> },
  { id: 'profile', label: 'Profil', icon: <ProfileIcon /> },
  { id: 'planner', label: 'Plan', icon: '\u{1F372}' },
]
const THEMES = ['system', 'dark', 'light']

const ADD_TABS = [
  { id: 'scanner', label: 'Scanner' },
  { id: 'photo', label: 'Photo IA' },
  { id: 'manual', label: 'Manuel' },
]

function isValidTab(value) {
  return ALL_TABS.some((tabItem) => tabItem.id === value)
}

function isValidAddTab(value) {
  return ADD_TABS.some((tabItem) => tabItem.id === value)
}

function migrateLegacyTab(tab, fallbackAdd = 'scanner') {
  if (!tab) return 'today'
  if (isValidTab(tab)) return tab
  if (tab === 'progress') return 'journal'
  if (tab === 'coach') return 'motivation'
  if (tab === 'planner') return 'add'
  if (tab === 'settings') return 'settings'
  if (tab === 'profile') return 'profile'
  if (tab === 'add') return 'add'
  if (tab === 'today') return 'today'
  if (tab === 'history') return 'journal'
  if (tab === 'metabolism') return 'metabolism'
  if (tab === 'trend') return 'metabolism'
  if (fallbackAdd && isValidAddTab(fallbackAdd)) return 'add'
  return 'today'
}

function loadTabPreference() {
  try {
    const stored = localStorage.getItem(TAB_KEY)
    const fallbackAdd = localStorage.getItem(ADD_KEY)
    return migrateLegacyTab(stored, fallbackAdd)
  } catch {
    return 'today'
  }
}

function loadThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return THEMES.includes(stored) ? stored : 'light'
  } catch {
    return 'light'
  }
}

function loadAddPreference() {
  try {
    const stored = localStorage.getItem(ADD_KEY)
    if (stored === 'photo' && !ENABLE_VISION_FOOD) return 'scanner'
    return isValidAddTab(stored) ? stored : (ENABLE_VISION_FOOD ? 'photo' : 'scanner')
  } catch {
    return ENABLE_VISION_FOOD ? 'photo' : 'scanner'
  }
}

function LoadingView({ text = 'Chargement...' }) {
  return (
    <div className="view">
      <div className="empty">
        <div className="empty-txt">{text}</div>
      </div>
    </div>
  )
}

function QuickManualEntry({ targets, onSave, compact = false }) {
  const [manual, setManual] = useState({ kcal: '', protein: '', fat: '', carbs: '' })
  const [saved, setSaved] = useState(false)

  function saveManual() {
    const parse = (value, parser) => (value !== '' ? parser(value) : null)
    onSave({
      date: todayStr(),
      manual: {
        kcal: parse(manual.kcal, parseInt),
        protein: parse(manual.protein, parseInt),
        fat: parse(manual.fat, parseInt),
        carbs: parse(manual.carbs, parseInt),
      },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <section className={`card quick-manual-card ${compact ? 'quick-manual-card-compact' : ''}`}>
      {!compact && (
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">Manuel</div>
            <div className="section-title">Entrer les totaux</div>
          </div>
        </div>
      )}

      <div className="form-grid today-manual-grid">
        {[
          { field: 'kcal', label: 'Calories', placeholder: targets.targetKcal },
          { field: 'protein', label: 'Proteines', placeholder: targets.protein },
          { field: 'carbs', label: 'Glucides', placeholder: targets.carbs },
          { field: 'fat', label: 'Lipides', placeholder: targets.fat },
        ].map(({ field, label, placeholder }) => (
          <div className="ig" key={field}>
            <label>{label}</label>
            <input
              type="number"
              step="1"
              inputMode="numeric"
              placeholder={placeholder}
              value={manual[field]}
              onChange={(event) => {
                setManual((current) => ({ ...current, [field]: event.target.value }))
                setSaved(false)
              }}
            />
          </div>
        ))}
      </div>

      <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={saveManual}>
        {saved ? 'Enregistre' : 'Sauvegarder'}
      </button>
    </section>
  )
}

function AddWorkspace({
  title,
  subtitle,
  addTab,
  setAddTab,
  onAddItem,
  onGoToday,
  onSaveManual,
  targets,
  onOpenPlanner,
  compact = false,
}) {
  const availableTabs = ENABLE_VISION_FOOD ? ADD_TABS : ADD_TABS.filter((tabItem) => tabItem.id !== 'photo')
  const activeTab = availableTabs.some((tabItem) => tabItem.id === addTab) ? addTab : 'scanner'

  return (
    <div className={`view ${compact ? 'add-workspace-inline' : ''}`}>
      <section className={`card add-hub-card ${compact ? 'add-hub-card-compact' : ''}`}>
        <div className="section-heading section-heading-inline">
          <div>
            <div className="section-eyebrow">{title}</div>
            <div className="section-title">{subtitle}</div>
          </div>
          {!compact && (
            <button className="btn-ghost add-planner-btn" onClick={onOpenPlanner}>
              Plan repas
            </button>
          )}
        </div>

        <div className="seg-tabs add-hub-tabs">
          {availableTabs.map((subtab) => (
            <button
              key={subtab.id}
              className={`seg-btn ${activeTab === subtab.id ? 'active' : ''}`}
              onClick={() => setAddTab(subtab.id)}
            >
              {subtab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'scanner' && (
        <Suspense fallback={<LoadingView text="Chargement du scanner..." />}>
          <Scanner onAddItem={onAddItem} onGoToday={onGoToday} compact={compact} />
        </Suspense>
      )}

      {activeTab === 'photo' && ENABLE_VISION_FOOD && VisionFood && (
        <Suspense fallback={<LoadingView text="Chargement de la photo..." />}>
          <VisionFood onAddItem={onAddItem} onGoToday={onGoToday} compact={compact} />
        </Suspense>
      )}

      {activeTab === 'manual' && (
        <QuickManualEntry targets={targets} onSave={onSaveManual} compact={compact} />
      )}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState(loadTabPreference)
  const [addTab, setAddTab] = useState(loadAddPreference)
  const [settings, setSettings] = useState(loadSettings)
  const [logs, setLogs] = useState(loadLogs)
  const [notifSettings, setNotifSettings] = useState(loadNotifSettings)
  const [onboardingState, setOnboardingState] = useState(loadOnboardingState)
  const [onboardingOpen, setOnboardingOpen] = useState(() => !loadOnboardingState().seen)
  const [onboardingBusy, setOnboardingBusy] = useState(false)
  const [storageInfo, setStorageInfo] = useState(getBackupSummary)
  const [theme, setTheme] = useState(loadThemePreference)

  useEffect(() => { saveSettings(settings) }, [settings])
  useEffect(() => {
    saveLogs(logs)
    setStorageInfo(getBackupSummary())
  }, [logs])
  useEffect(() => { saveNotifSettings(notifSettings) }, [notifSettings])
  useEffect(() => { saveOnboardingState(onboardingState) }, [onboardingState])
  useEffect(() => { setStorageInfo(getBackupSummary()) }, [settings, notifSettings, onboardingState])
  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab) } catch {}
  }, [tab])
  useEffect(() => {
    try { localStorage.setItem(ADD_KEY, addTab) } catch {}
  }, [addTab])
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme) } catch {}
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const applyTheme = () => {
      const resolved = theme === 'system'
        ? (media?.matches ? 'dark' : 'light')
        : theme
      document.documentElement.dataset.theme = resolved
    }

    applyTheme()
    if (theme !== 'system' || !media?.addEventListener) return
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [theme])

  const currentWeight = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
    const found = sorted.find((log) => log.weight != null)
    return found ? found.weight : settings.startWeight
  }, [logs, settings.startWeight])

  const enrichedLogs = useMemo(
    () => logs.map((log) => ({ ...log, totalKcal: logTotals(log).kcal || null })),
    [logs]
  )

  const nutrition = useMemo(
    () => computeNutritionPipeline({
      settings,
      logs: enrichedLogs,
      currentWeight,
    }),
    [settings, enrichedLogs, currentWeight]
  )

  const initialTDEE = nutrition.initialTDEE
  const quality = nutrition.quality
  const energyModel = nutrition.energyModel
  const targets = nutrition.targets
  const forecast = nutrition.forecast
  const tdee = energyModel.tdee

  const todayLog = useMemo(
    () => logs.find((log) => log.date === todayStr()) ?? null,
    [logs]
  )

  const dq = quality.score

  const streak = useMemo(() => {
    let streakCount = 0
    const cursor = new Date()
    while (streakCount < 365) {
      const dateKey = toDateKey(cursor)
      const log = logs.find((entry) => entry.date === dateKey)
      const totals = log ? logTotals(log) : null
      if (totals && totals.kcal > 0) {
        streakCount++
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }
    return streakCount
  }, [logs])

  const progressPct = useMemo(() => {
    const total = settings.startWeight - settings.goalWeight
    if (total <= 0) return 100
    return Math.max(0, Math.min(100, Math.round(
      ((settings.startWeight - currentWeight) / total) * 100
    )))
  }, [settings, currentWeight])

  const habitStreak = useMemo(() => {
    const habitLogs = loadHabitLogs()
    return computeStreak(habitLogs).streak
  }, [tab, onboardingOpen])

  function upsertLog(entry) {
    setLogs((prev) => {
      const existing = prev.find((log) => log.date === entry.date) ?? {}
      const merged = { ...existing, ...entry }
      return [...prev.filter((log) => log.date !== entry.date), merged]
        .sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  function addFoodItem(item) {
    const date = todayStr()
    setLogs((prev) => {
      const existing = prev.find((log) => log.date === date) ?? { date, items: [], manual: {} }
      const updated = { ...existing, items: [...(existing.items ?? []), { ...item, id: Date.now() }] }
      return [...prev.filter((log) => log.date !== date), updated]
        .sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  function addPlannedMealToToday(meal) {
    if (!meal) return
    addFoodItem({
      name: meal.title,
      qty: meal.adultServingWeight || 1,
      kcal: meal.adultServingMacros.kcal,
      protein: meal.adultServingMacros.protein,
      carbs: meal.adultServingMacros.carbs,
      fat: meal.adultServingMacros.fat,
      source: 'planner',
    })
  }

  function removeFoodItem(date, itemId) {
    setLogs((prev) =>
      prev.map((log) =>
        log.date === date
          ? { ...log, items: (log.items ?? []).filter((item) => item.id !== itemId) }
          : log
      )
    )
  }

  function deleteLog(date) {
    setLogs((prev) => prev.filter((log) => log.date !== date))
  }

  function openAdd(next = 'scanner') {
    setTab('add')
    if (isValidAddTab(next)) {
      if (next === 'photo' && !ENABLE_VISION_FOOD) setAddTab('scanner')
      else setAddTab(next)
    }
  }

  function openPlanner() {
    setTab('planner')
  }

  function openSettings() {
    setTab('settings')
  }

  function openProfile() {
    setTab('profile')
  }

  const applyExternalRoute = useCallback((route) => {
    if (!route) return
    if (route === 'motivation' || route === 'coach') setTab('motivation')
    else if (route === 'today') setTab('today')
    else if (route === 'planner') setTab('planner')
    else if (route === 'profile') setTab('profile')
    else if (route === 'history' || route === 'journal') setTab('journal')
    else if (route === 'scanner') openAdd('scanner')
    else if (route === 'photo' || route === 'labo') openAdd('photo')
    else if (route === 'metabolism' || route === 'trend') setTab('metabolism')

    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }, [])

  const checkNotifs = useCallback(() => {
    if (onboardingOpen) return
    const habit = loadHabit()
    const habitLogs = loadHabitLogs()
    const updated = checkAndSendNotifications({
      settings: notifSettings,
      logs,
      habit,
      habitLogs,
    })
    if (updated) setNotifSettings(updated)
  }, [notifSettings, logs, onboardingOpen])

  useEffect(() => {
    checkNotifs()
    const onVisible = () => {
      if (!document.hidden) checkNotifs()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [checkNotifs])

  useEffect(() => {
    applyExternalRoute(window.location.hash.replace(/^#/, ''))

    const onMessage = (event) => {
      const data = event.data ?? {}
      if (data.type === 'OPEN_TAB') applyExternalRoute(data.tab)
    }

    const onHashChange = () => applyExternalRoute(window.location.hash.replace(/^#/, ''))

    navigator.serviceWorker?.addEventListener?.('message', onMessage)
    window.addEventListener('hashchange', onHashChange)

    return () => {
      navigator.serviceWorker?.removeEventListener?.('message', onMessage)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [applyExternalRoute])

  async function finishOnboarding(enableNotifications) {
    setOnboardingBusy(true)

    try {
      let seeded = false
      if (!loadHabit()) {
        saveHabit(createDefaultCoachHabit(notifSettings.morningTime))
        seeded = true
      }

      const nowIso = new Date().toISOString()
      let permissionState = getPermission()
      let nextNotif = { ...notifSettings, permissionState }

      if (enableNotifications) {
        permissionState = await requestPermission()
        nextNotif = {
          ...nextNotif,
          enabled: permissionState === 'granted',
          permissionAskedAt: nowIso,
          permissionState,
        }
      } else {
        nextNotif = {
          ...nextNotif,
          enabled: permissionState === 'granted' ? nextNotif.enabled : false,
          permissionState,
        }
      }

      setNotifSettings(nextNotif)

      setOnboardingState((prev) => ({
        ...prev,
        seen: true,
        completedAt: nowIso,
        habitSeeded: prev.habitSeeded || seeded,
        permissionStepShown: true,
      }))

      setOnboardingOpen(false)
      setTab('motivation')
    } finally {
      setOnboardingBusy(false)
    }
  }

  function replayOnboarding() {
    setOnboardingOpen(true)
  }

  function handleExportBackup() {
    const result = downloadBackupFile()
    setStorageInfo(getBackupSummary())
    return {
      message: `Sauvegarde exportee (${result.filename}).`,
    }
  }

  async function handleImportBackup(file) {
    const payload = await parseBackupFile(file)
    restoreBackupPayload(payload)
    window.location.reload()
    return {
      message: 'Sauvegarde importee. Rechargement...',
    }
  }

  const sharedProps = { targets, settings, currentWeight, progressPct, initialTDEE, forecast }

  const coachReminder = useMemo(() => {
    if (notifSettings.permissionState === 'unsupported') {
      return {
        title: 'Rappels indisponibles',
        body: "Le navigateur ne gere pas les notifications ici.",
      }
    }

    if (notifSettings.permissionState === 'denied') {
      return {
        title: 'Rappels bloques',
        body: 'Relance-les depuis Reglages si tu veux les retrouver.',
      }
    }

    if (notifSettings.permissionState === 'granted' && !notifSettings.enabled) {
      return {
        title: 'Rappels coupes',
        body: "La chaine continue meme sans notification.",
      }
    }

    if (notifSettings.permissionState === 'default') {
      return {
        title: 'Active les rappels',
        body: 'Un rappel suffit souvent a revenir dans la chaine.',
      }
    }

    return null
  }, [notifSettings])

  const addWorkspaceProps = {
    addTab,
    setAddTab,
    onAddItem: addFoodItem,
    onGoToday: () => setTab('today'),
    onSaveManual: upsertLog,
    targets,
    onOpenPlanner: openPlanner,
  }

  if (onboardingOpen) {
    return (
      <div className="app">
        <main className="main-content">
          <Onboarding
            busy={onboardingBusy}
            permissionState={notifSettings.permissionState}
            onFinish={finishOnboarding}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      {tab !== 'settings' && tab !== 'profile' && (
        <>
          <button className="shell-profile-btn" onClick={openProfile} aria-label="Ouvrir le profil">
            <ProfileIcon />
          </button>
          <button className="shell-settings-btn" onClick={openSettings} aria-label="Ouvrir les reglages">
            <SettingsIcon />
          </button>
        </>
      )}

      <main className="main-content">
        {tab === 'today' && (
          <Today
            {...sharedProps}
            todayLog={todayLog}
            onSave={upsertLog}
            onRemoveItem={removeFoodItem}
            onOpenPlanner={openPlanner}
            tdee={tdee}
            dq={dq}
            quality={quality}
            energyModel={energyModel}
            forecast={forecast}
            streak={streak}
          />
        )}

        {tab === 'add' && (
          <AddWorkspace
            {...addWorkspaceProps}
            title="Ajouter"
            subtitle="Choisis ton entree"
          />
        )}

        {tab === 'planner' && (
          <Suspense fallback={<LoadingView text="Chargement du plan repas..." />}>
            <MealPlanner targets={targets} onAddMealToToday={addPlannedMealToToday} />
          </Suspense>
        )}

        {tab === 'motivation' && (
          <Suspense fallback={<LoadingView />}>
            <Habit
              coachReminder={coachReminder}
              onOpenSettings={openSettings}
              onReplayOnboarding={replayOnboarding}
            />
          </Suspense>
        )}

        {tab === 'metabolism' && (
          <Suspense fallback={<LoadingView />}>
            <Metabolism
              settings={settings}
              currentWeight={currentWeight}
              initialTDEE={initialTDEE}
              tdee={tdee}
              targets={targets}
              dq={dq}
              quality={quality}
              energyModel={energyModel}
              forecast={forecast}
            />
          </Suspense>
        )}

        {tab === 'journal' && (
          <Suspense fallback={<LoadingView />}>
            <History logs={enrichedLogs} onDelete={deleteLog} targets={targets} />
          </Suspense>
        )}

        {tab === 'settings' && (
          <Settings
            mode="app"
            settings={settings}
            onSave={setSettings}
            notifSettings={notifSettings}
            onSaveNotif={setNotifSettings}
            storageInfo={storageInfo}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onReplayOnboarding={replayOnboarding}
            theme={theme}
            onThemeChange={setTheme}
            onOpenProfile={openProfile}
            onClose={() => setTab('today')}
          />
        )}

        {tab === 'profile' && (
          <Settings
            mode="profile"
            settings={settings}
            onSave={setSettings}
            notifSettings={notifSettings}
            onSaveNotif={setNotifSettings}
            storageInfo={storageInfo}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onReplayOnboarding={replayOnboarding}
            theme={theme}
            onThemeChange={setTheme}
            onOpenApp={openSettings}
            onClose={() => setTab('today')}
          />
        )}
      </main>

      {tab !== 'settings' && (
        <nav className="bottom-nav">
          {NAV_TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              className={`nav-btn ${tab === tabItem.id ? 'active' : ''}`}
              onClick={() => setTab(tabItem.id)}
              aria-label={tabItem.label}
              aria-current={tab === tabItem.id ? 'page' : undefined}
            >
              <span className="nav-icon">{tabItem.id === 'motivation' && habitStreak > 0 ? '\u{1F525}' : tabItem.icon}</span>
              <span className="nav-label">{tabItem.label}</span>
              {tabItem.id === 'motivation' && habitStreak > 0 && (
                <span className="habit-counter">{habitStreak}</span>
              )}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
