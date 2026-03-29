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

const Trend = lazy(() => import('./views/Trend'))
const History = lazy(() => import('./views/History'))
const Metabolism = lazy(() => import('./views/Metabolism'))
const Scanner = lazy(() => import('./views/Scanner'))
const Habit = lazy(() => import('./views/Habit'))
const MealPlanner = lazy(() => import('./views/MealPlanner'))
const VisionFood = ENABLE_VISION_FOOD ? lazy(() => import('./views/Labo')) : null

const TAB_KEY = 'coupure_tab_v1'
const INSIGHT_KEY = 'coupure_insight_tab_v1'
const ADD_KEY = 'coupure_add_tab_v1'
const THEME_KEY = 'coupure_theme_v1'

const NAV_TABS = [
  { id: 'today', label: "Aujourd'hui", icon: '\u25CF' },
  { id: 'add', label: 'Ajouter', icon: '+' },
  { id: 'progress', label: 'Analyse', icon: '\u{1F4CA}' },
  { id: 'settings', label: 'Reglages', icon: '\u2699' },
]

const ALL_TABS = [...NAV_TABS, { id: 'planner', label: 'Plan', icon: '\u{1F372}' }, { id: 'coach', label: 'Coach', icon: '\u{1F525}' }]
const THEMES = ['system', 'dark', 'light']

const ADD_TABS = [
  { id: 'scanner', label: 'Scanner' },
  { id: 'photo', label: 'Photo repas' },
  { id: 'manual', label: 'Saisie manuelle' },
]

const INSIGHT_TABS = [
  { id: 'trend', label: 'Courbe' },
  { id: 'history', label: 'Journal' },
  { id: 'metabolism', label: 'Metabolisme' },
]

function isValidTab(value) {
  return ALL_TABS.some((tabItem) => tabItem.id === value)
}

function isValidAddTab(value) {
  return ADD_TABS.some((tabItem) => tabItem.id === value)
}

function isValidInsightTab(value) {
  return INSIGHT_TABS.some((tabItem) => tabItem.id === value)
}

function loadTabPreference() {
  try {
    const stored = localStorage.getItem(TAB_KEY)
    return isValidTab(stored) ? stored : 'today'
  } catch {
    return 'today'
  }
}

function loadThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return THEMES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function loadAddPreference() {
  try {
    const stored = localStorage.getItem(ADD_KEY)
    if (stored === 'photo' && !ENABLE_VISION_FOOD) return 'scanner'
    return isValidAddTab(stored) ? stored : 'scanner'
  } catch {
    return 'scanner'
  }
}

function loadInsightPreference() {
  try {
    const stored = localStorage.getItem(INSIGHT_KEY)
    return isValidInsightTab(stored) ? stored : 'trend'
  } catch {
    return 'trend'
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

function AddHub({ addTab, setAddTab, onAddItem, onGoToday, onOpenPlanner, onOpenCoach }) {
  const availableTabs = ENABLE_VISION_FOOD ? ADD_TABS : ADD_TABS.filter((tabItem) => tabItem.id !== 'photo')
  const activeTab = availableTabs.some((tabItem) => tabItem.id === addTab) ? addTab : 'scanner'

  return (
    <div className="view">
      <section className="card add-hub-card">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">Ajouter</div>
            <div className="section-title">Choisis une methode rapide</div>
            <div className="view-subtitle">Objectif: enregistrer ton repas en moins de 20 secondes.</div>
          </div>
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

        <div className="today-quick-actions">
          <button className="today-quick-btn today-quick-btn-primary" onClick={onOpenPlanner}>
            Plan repas
          </button>
          <button className="today-quick-btn" onClick={onOpenCoach}>
            Coach routine
          </button>
        </div>

        {activeTab === 'manual' && (
          <div className="add-hub-manual">
            <div className="empty">
              <div className="empty-txt">Passe par Aujourd'hui pour saisir tes totaux ou completer ton journal.</div>
              <button className="btn-ghost" onClick={onGoToday}>
                Ouvrir Aujourd'hui
              </button>
            </div>
          </div>
        )}
      </section>

      {activeTab === 'scanner' && (
        <Suspense fallback={<LoadingView text="Chargement du scanner..." />}>
          <Scanner onAddItem={onAddItem} onGoToday={onGoToday} />
        </Suspense>
      )}

      {activeTab === 'photo' && ENABLE_VISION_FOOD && VisionFood && (
        <Suspense fallback={<LoadingView text="Chargement de la photo repas..." />}>
          <VisionFood onAddItem={onAddItem} onGoToday={onGoToday} />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState(loadTabPreference)
  const [addTab, setAddTab] = useState(loadAddPreference)
  const [insightTab, setInsightTab] = useState(loadInsightPreference)
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
    try { localStorage.setItem(INSIGHT_KEY, insightTab) } catch {}
  }, [insightTab])
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

  const historyCount = logs.length
  const metaboLabel = energyModel.useAdaptive ? energyModel.confidenceLabel : `${dq}%`

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

  function openInsights(next = 'trend') {
    setTab('progress')
    if (isValidInsightTab(next)) setInsightTab(next)
  }

  function openPlanner() {
    setTab('planner')
  }

  function openCoach() {
    setTab('coach')
  }

  const applyExternalRoute = useCallback((route) => {
    if (!route) return
    if (route === 'coach') setTab('coach')
    else if (route === 'today') setTab('today')
    else if (route === 'planner') setTab('planner')
    else if (route === 'history') openInsights('history')
    else if (route === 'scanner') openAdd('scanner')

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
      setTab('coach')
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
        title: 'Rappels indisponibles ici',
        body: "Ce navigateur ne supporte pas les notifications locales. Tu peux quand meme garder ta routine dans l'onglet Coach.",
      }
    }

    if (notifSettings.permissionState === 'denied') {
      return {
        title: 'Rappels bloques',
        body: 'Les rappels sont coupes par le navigateur. Reviens dans Reglages pour relancer la routine si tu veux etre accompagne.',
      }
    }

    if (notifSettings.permissionState === 'granted' && !notifSettings.enabled) {
      return {
        title: 'Rappels coupes',
        body: "La routine existe deja. Reactive les rappels pour garder l'elan les jours charges.",
      }
    }

    if (notifSettings.permissionState === 'default') {
      return {
        title: 'Active le coach de routine',
        body: "Un rappel le matin et une fermeture douce le soir suffisent souvent a ne pas lacher.",
      }
    }

    return null
  }, [notifSettings])

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
      <main className="main-content">
        {tab === 'today' && (
          <Today
            {...sharedProps}
            todayLog={todayLog}
            onSave={upsertLog}
            onRemoveItem={removeFoodItem}
            onOpenAdd={openAdd}
            onGoHistory={() => openInsights('history')}
            tdee={tdee}
            dq={dq}
            quality={quality}
            energyModel={energyModel}
            forecast={forecast}
            streak={streak}
            onOpenCoach={openCoach}
          />
        )}

        {tab === 'add' && (
          <AddHub
            addTab={addTab}
            setAddTab={setAddTab}
            onAddItem={addFoodItem}
            onGoToday={() => setTab('today')}
            onOpenPlanner={openPlanner}
            onOpenCoach={openCoach}
          />
        )}

        {tab === 'planner' && (
          <Suspense fallback={<LoadingView text="Chargement du plan repas..." />}>
            <MealPlanner targets={targets} onAddMealToToday={addPlannedMealToToday} />
          </Suspense>
        )}

        {tab === 'coach' && (
          <Suspense fallback={<LoadingView />}>
            <Habit
              coachReminder={coachReminder}
              onOpenSettings={() => setTab('settings')}
              onReplayOnboarding={replayOnboarding}
            />
          </Suspense>
        )}

        {tab === 'progress' && (
          <>
            <div className="insight-nav-wrap">
              <div className="seg-tabs insight-tabs">
                <button
                  className={`seg-btn insight-btn ${insightTab === 'trend' ? 'active' : ''}`}
                  onClick={() => setInsightTab('trend')}
                >
                  Courbe
                </button>
                <button
                  className={`seg-btn insight-btn ${insightTab === 'history' ? 'active' : ''}`}
                  onClick={() => setInsightTab('history')}
                >
                  Journal
                  <span className="insight-pill">{historyCount}</span>
                </button>
                <button
                  className={`seg-btn insight-btn ${insightTab === 'metabolism' ? 'active' : ''}`}
                  onClick={() => setInsightTab('metabolism')}
                >
                  Metabolisme
                  <span className="insight-pill">{metaboLabel}</span>
                </button>
              </div>
            </div>

            {insightTab === 'trend' && (
              <Suspense fallback={<LoadingView />}>
                <Trend {...sharedProps} logs={enrichedLogs} quality={quality} energyModel={energyModel} />
              </Suspense>
            )}
            {insightTab === 'history' && (
              <Suspense fallback={<LoadingView />}>
                <History logs={enrichedLogs} onDelete={deleteLog} targets={targets} />
              </Suspense>
            )}
            {insightTab === 'metabolism' && (
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
          </>
        )}

        {tab === 'settings' && (
          <Settings
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
          />
        )}
      </main>

      <nav className="bottom-nav">
        {NAV_TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            className={`nav-btn ${tab === tabItem.id ? 'active' : ''}`}
            onClick={() => setTab(tabItem.id)}
            aria-label={tabItem.label}
            aria-current={tab === tabItem.id ? 'page' : undefined}
          >
            <span className="nav-icon">{tabItem.id === 'coach' && habitStreak > 0 ? '\u{1F525}' : tabItem.icon}</span>
            <span className="nav-label">{tabItem.label}</span>
            {tabItem.id === 'coach' && habitStreak > 0 && (
              <span className="habit-counter">{habitStreak}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
