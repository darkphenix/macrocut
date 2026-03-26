import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import Today from './views/Today'
import Settings from './views/Settings'
import { loadSettings, loadLogs, saveSettings, saveLogs, todayStr, logTotals } from './store'
import { computeAdaptiveTDEE, computeTargets, computeInitialTDEE, dataQuality } from './algo'
import { loadNotifSettings, saveNotifSettings, checkAndSendNotifications, checkHabitNotification } from './notifications'
import { loadHabit, saveHabit, loadHabitLogs, computeStreak } from './habitStore'
import { toDateKey } from './date'
import { ENABLE_LABO } from './features'

const Trend = lazy(() => import('./views/Trend'))
const History = lazy(() => import('./views/History'))
const Metabolism = lazy(() => import('./views/Metabolism'))
const Scanner = lazy(() => import('./views/Scanner'))
const Habit = lazy(() => import('./views/Habit'))
const Labo = ENABLE_LABO ? lazy(() => import('./views/Labo')) : null

const TAB_KEY = 'coupure_tab_v1'
const INSIGHT_KEY = 'coupure_insight_tab_v1'

const BASE_TABS = [
  { id: 'today', label: "Aujourd'hui", icon: '\u25CF' },
  { id: 'scanner', label: 'Scanner', icon: '\u25A1' },
  { id: 'habit', label: 'Habitude', icon: '\u{1F525}' },
  { id: 'trend', label: 'Insights', icon: '\u{1F4CA}' },
  { id: 'settings', label: 'Reglages', icon: '\u2699' },
]

const TABS = ENABLE_LABO
  ? [
      BASE_TABS[0],
      BASE_TABS[1],
      { id: 'labo', label: 'LABO', icon: '\u2697' },
      BASE_TABS[2],
      BASE_TABS[3],
      BASE_TABS[4],
    ]
  : BASE_TABS

const INSIGHT_TABS = [
  { id: 'trend', label: 'Tendance' },
  { id: 'history', label: 'Historique' },
  { id: 'metabolism', label: 'Metabo' },
]

function isValidTab(value) {
  return TABS.some((tab) => tab.id === value)
}

function isValidInsightTab(value) {
  return INSIGHT_TABS.some((tab) => tab.id === value)
}

function loadTabPreference() {
  try {
    const stored = localStorage.getItem(TAB_KEY)
    return isValidTab(stored) ? stored : 'today'
  } catch {
    return 'today'
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

export default function App() {
  const [tab, setTab] = useState(loadTabPreference)
  const [insightTab, setInsightTab] = useState(loadInsightPreference)
  const [settings, setSettings] = useState(loadSettings)
  const [logs, setLogs] = useState(loadLogs)
  const [notifSettings, setNotifS] = useState(loadNotifSettings)

  useEffect(() => { saveSettings(settings) }, [settings])
  useEffect(() => { saveLogs(logs) }, [logs])
  useEffect(() => { saveNotifSettings(notifSettings) }, [notifSettings])
  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab) } catch {}
  }, [tab])
  useEffect(() => {
    try { localStorage.setItem(INSIGHT_KEY, insightTab) } catch {}
  }, [insightTab])

  const checkNotifs = useCallback(() => {
    const updated = checkAndSendNotifications(notifSettings)
    if (updated) setNotifS(updated)
    if (!notifSettings.enabled) return
    const currentHabit = loadHabit()
    if (!currentHabit) return
    const updatedHabit = checkHabitNotification(currentHabit)
    if (updatedHabit) saveHabit(updatedHabit)
  }, [notifSettings])

  useEffect(() => {
    checkNotifs()
    const onVisible = () => { if (!document.hidden) checkNotifs() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, []) // eslint-disable-line

  const currentWeight = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
    const found = sorted.find((l) => l.weight != null)
    return found ? found.weight : settings.startWeight
  }, [logs, settings.startWeight])

  const initialTDEE = useMemo(
    () => computeInitialTDEE(settings, currentWeight),
    [settings, currentWeight]
  )

  const enrichedLogs = useMemo(
    () => logs.map((l) => ({ ...l, totalKcal: logTotals(l).kcal || null })),
    [logs]
  )

  const tdee = useMemo(
    () => computeAdaptiveTDEE(enrichedLogs, initialTDEE),
    [enrichedLogs, initialTDEE]
  )

  const targets = useMemo(
    () => computeTargets(tdee, settings, currentWeight),
    [tdee, settings, currentWeight]
  )

  const todayLog = useMemo(
    () => logs.find((l) => l.date === todayStr()) ?? null,
    [logs]
  )

  const dq = useMemo(() => dataQuality(enrichedLogs), [enrichedLogs])

  const streak = useMemo(() => {
    let s = 0
    const d = new Date()
    while (s < 365) {
      const ds = toDateKey(d)
      const log = logs.find((l) => l.date === ds)
      const tot = log ? logTotals(log) : null
      if (tot && tot.kcal > 0) {
        s++
        d.setDate(d.getDate() - 1)
      } else {
        break
      }
    }
    return s
  }, [logs])

  const progressPct = useMemo(() => {
    const total = settings.startWeight - settings.goalWeight
    if (total <= 0) return 100
    return Math.max(0, Math.min(100, Math.round(
      ((settings.startWeight - currentWeight) / total) * 100
    )))
  }, [settings, currentWeight])

  const habitStreak = useMemo(() => {
    const hlogs = loadHabitLogs()
    return computeStreak(hlogs).streak
  }, [tab])

  const historyCount = logs.length
  const metaboLabel = dq >= 70 ? 'Pret' : `${dq}%`

  function upsertLog(entry) {
    setLogs((prev) => {
      const existing = prev.find((l) => l.date === entry.date) ?? {}
      const merged = { ...existing, ...entry }
      return [...prev.filter((l) => l.date !== entry.date), merged]
        .sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  function addFoodItem(item) {
    const date = todayStr()
    setLogs((prev) => {
      const existing = prev.find((l) => l.date === date) ?? { date, items: [], manual: {} }
      const updated = { ...existing, items: [...(existing.items ?? []), { ...item, id: Date.now() }] }
      return [...prev.filter((l) => l.date !== date), updated]
        .sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  function removeFoodItem(date, itemId) {
    setLogs((prev) =>
      prev.map((l) =>
        l.date === date
          ? { ...l, items: (l.items ?? []).filter((it) => it.id !== itemId) }
          : l
      )
    )
  }

  function deleteLog(date) {
    setLogs((prev) => prev.filter((l) => l.date !== date))
  }

  function openInsights(next = 'trend') {
    setTab('trend')
    if (isValidInsightTab(next)) setInsightTab(next)
  }

  const sharedProps = { targets, settings, currentWeight, progressPct, initialTDEE }

  return (
    <div className="app">
      <main className="main-content">
        {tab === 'today' && (
          <Today
            {...sharedProps}
            todayLog={todayLog}
            onSave={upsertLog}
            onRemoveItem={removeFoodItem}
            onGoScanner={() => setTab('scanner')}
            onGoHistory={() => openInsights('history')}
            tdee={tdee}
            dq={dq}
            streak={streak}
          />
        )}

        {tab === 'scanner' && (
          <Suspense fallback={<LoadingView text="Chargement du scanner..." />}>
            <Scanner onAddItem={addFoodItem} onGoToday={() => setTab('today')} />
          </Suspense>
        )}

        {ENABLE_LABO && Labo && tab === 'labo' && (
          <Suspense fallback={<LoadingView text="Chargement du labo..." />}>
            <Labo onAddItem={addFoodItem} onGoToday={() => setTab('today')} />
          </Suspense>
        )}

        {tab === 'habit' && (
          <Suspense fallback={<LoadingView />}>
            <Habit />
          </Suspense>
        )}

        {tab === 'trend' && (
          <>
            <div className="insight-nav-wrap">
              <div className="seg-tabs insight-tabs">
                <button
                  className={`seg-btn insight-btn ${insightTab === 'trend' ? 'active' : ''}`}
                  onClick={() => setInsightTab('trend')}
                >
                  Tendance
                </button>
                <button
                  className={`seg-btn insight-btn ${insightTab === 'history' ? 'active' : ''}`}
                  onClick={() => setInsightTab('history')}
                >
                  Historique
                  <span className="insight-pill">{historyCount}</span>
                </button>
                <button
                  className={`seg-btn insight-btn ${insightTab === 'metabolism' ? 'active' : ''}`}
                  onClick={() => setInsightTab('metabolism')}
                >
                  Metabo
                  <span className="insight-pill">{metaboLabel}</span>
                </button>
              </div>
            </div>

            {insightTab === 'trend' && (
              <Suspense fallback={<LoadingView />}>
                <Trend {...sharedProps} logs={enrichedLogs} />
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
            onSaveNotif={setNotifS}
          />
        )}
      </main>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-label={t.label}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="nav-icon">{t.id === 'habit' && habitStreak > 0 ? '\u{1F525}' : t.icon}</span>
            <span className="nav-label">{t.label}</span>
            {t.id === 'habit' && habitStreak > 0 && (
              <span className="habit-counter">{habitStreak}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
