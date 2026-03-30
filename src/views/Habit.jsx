import { useState, useMemo } from 'react'
import {
  loadHabit,
  saveHabit,
  loadHabitLogs,
  saveHabitLogs,
  HABIT_SUGGESTIONS,
  GRADUATION_DAYS,
  computeStreak,
  getLast14,
  isGraduated,
  getContextMessage,
  todayStr,
} from '../habitStore'

function CoachNotice({ reminder, onOpenSettings, onReplayOnboarding }) {
  if (!reminder) return null

  return (
    <div className="card coach-notice-card">
      <div className="card-title">Rappels</div>
      <div className="coach-notice-title">{reminder.title}</div>
      <div className="coach-notice-body">{reminder.body}</div>
      <div className="coach-notice-actions">
        <button className="btn-ghost coach-notice-secondary" onClick={onOpenSettings}>
          Ouvrir Reglages
        </button>
        <button className="save-btn coach-notice-primary" onClick={onReplayOnboarding}>
          Revoir le demarrage
        </button>
      </div>
    </div>
  )
}

function ChainDots({ days }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
      {days.map((day) => {
        const color =
          day.status === 'done'
            ? 'var(--acc)'
            : day.status === 'minimum'
              ? 'var(--p-color)'
              : day.status === 'missed'
                ? 'var(--danger)'
                : 'var(--surface-3)'
        const glow =
          day.status === 'done'
            ? '0 0 6px var(--acc-glow)'
            : day.status === 'minimum'
              ? '0 0 6px rgba(167,139,250,0.3)'
              : 'none'

        return (
          <div
            key={day.date}
            title={day.date}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: color,
              boxShadow: glow,
              border: day.date === todayStr() ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
              transition: 'all 0.3s',
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}

function CheckInButtons({ todayLog, onCheck }) {
  if (todayLog) {
    const labels = {
      done: ['Fait', 'var(--ok)', 'OK', "Tu as valide l'action complete."],
      minimum: ['Version mini', 'var(--p-color)', 'Mini', 'La chaine reste vivante avec la version mini.'],
      missed: ['Pas fait', 'var(--danger)', 'Pause', "Tu peux corriger si besoin."],
    }
    const [label, color, mark, note] = labels[todayLog.status] ?? ['-', 'var(--tx-3)', '-', '']

    return (
      <div className="habit-status-card" style={{ borderColor: `${color}22` }}>
        <div className="habit-status-mark" style={{ color }}>{mark}</div>
        <div className="habit-status-label" style={{ color }}>{label}</div>
        <div className="habit-status-note">{note}</div>
        <button className="habit-status-edit" onClick={() => onCheck(null)}>
          Corriger
        </button>
      </div>
    )
  }

  return (
    <div className="habit-checkin-grid">
      <button className="habit-choice-btn habit-choice-btn-done" onClick={() => onCheck('done')}>
        Fait
        <span>Valider l'action complete</span>
      </button>
      <button className="habit-choice-btn habit-choice-btn-mini" onClick={() => onCheck('minimum')}>
        Version mini
        <span>Garder la chaine vivante</span>
      </button>
      <button className="habit-choice-btn habit-choice-btn-missed" onClick={() => onCheck('missed')}>
        Pas fait aujourd hui
        <span>Noter la journee telle quelle</span>
      </button>
    </div>
  )
}

function HabitSetup({ onCreate, coachReminder, onOpenSettings, onReplayOnboarding }) {
  const [step, setStep] = useState('pick')
  const [selected, setSelected] = useState(null)
  const [customFull, setCustomFull] = useState('')
  const [customMini, setCustomMini] = useState('')
  const [time, setTime] = useState('08:00')

  function confirm() {
    const suggestion = selected
    if (!suggestion) return
    const habit = {
      id: `${suggestion.id}_${Date.now()}`,
      emoji: suggestion.emoji,
      name: suggestion.name,
      fullAction: suggestion.id === 'custom' ? customFull : suggestion.full,
      miniAction: suggestion.id === 'custom' ? customMini : suggestion.mini,
      reminderTime: time,
      createdAt: todayStr(),
      graduated: false,
      enabled: true,
      focus: suggestion.focus ?? null,
    }
    onCreate(habit)
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">HABITUDE</div>
          <div className="view-title">Motivation</div>
          <div className="view-subtitle">{step === 'pick' ? 'Choisis ta chaine' : 'Regle la chaine'}</div>
        </div>
      </div>

      <CoachNotice reminder={coachReminder} onOpenSettings={onOpenSettings} onReplayOnboarding={onReplayOnboarding} />

      {step === 'pick' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            {HABIT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => setSelected(suggestion)}
                style={{
                  textAlign: 'left',
                  padding: 'var(--s3) var(--s4)',
                  background: selected?.id === suggestion.id ? 'var(--acc-dim)' : 'var(--surface)',
                  border: `1px solid ${selected?.id === suggestion.id ? 'var(--border-acc)' : 'var(--border)'}`,
                  borderRadius: 'var(--r2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--s3)',
                  transition: 'all var(--t-fast)',
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{suggestion.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 700, fontSize: 15, color: selected?.id === suggestion.id ? 'var(--acc)' : 'var(--tx)' }}>
                    {suggestion.name}
                  </div>
                  {suggestion.id !== 'custom' && (
                    <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{suggestion.full}</div>
                  )}
                </div>
                {selected?.id === suggestion.id && (
                  <span style={{ color: 'var(--acc)', fontSize: 18 }}>✓</span>
                )}
              </button>
            ))}
          </div>
          {selected && (
            <button className="save-btn" onClick={() => setStep('customize')}>
              Continuer
            </button>
          )}
        </>
      )}

      {step === 'customize' && selected && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
            <span style={{ fontSize: 32 }}>{selected.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--tx)' }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'var(--tx-2)', marginTop: 4 }}>
                Une action claire. Une version mini.
              </div>
            </div>
          </div>

          <div className="sgroup">
            <div className="sgroup-title">Actions</div>
            {selected.id === 'custom' ? (
              <>
                <div className="srow">
                  <div className="srow-head"><span className="srow-name">Action complete</span></div>
                  <input
                    type="text"
                    placeholder="Ex : marcher 15 minutes"
                    value={customFull}
                    onChange={(event) => setCustomFull(event.target.value)}
                    style={{
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border-2)',
                      borderRadius: 'var(--r2)',
                      padding: '10px var(--s3)',
                      color: 'var(--tx)',
                      fontFamily: 'var(--f-ui)',
                      fontSize: 15,
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>
                <div className="srow">
                  <div className="srow-head"><span className="srow-name">Version mini</span></div>
                  <input
                    type="text"
                    placeholder="Ex : marcher 3 minutes"
                    value={customMini}
                    onChange={(event) => setCustomMini(event.target.value)}
                    style={{
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border-2)',
                      borderRadius: 'var(--r2)',
                      padding: '10px var(--s3)',
                      color: 'var(--tx)',
                      fontFamily: 'var(--f-ui)',
                      fontSize: 15,
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--tx-3)' }}>Action complete</div>
                  <div style={{ fontFamily: 'var(--f-ui)', fontSize: 14, color: 'var(--tx)', padding: '10px var(--s3)', background: 'var(--bg-2)', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}>
                    {selected.full}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--tx-3)' }}>Version mini</div>
                  <div style={{ fontFamily: 'var(--f-ui)', fontSize: 14, color: 'var(--acc)', padding: '10px var(--s3)', background: 'var(--acc-dim)', borderRadius: 'var(--r2)', border: '1px solid var(--border-acc)' }}>
                    {selected.mini}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="sgroup">
            <div className="sgroup-title">Rappel quotidien</div>
            <div className="time-row">
              <span className="time-label">Heure du rappel</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('pick')}>Retour</button>
            <button
              className="save-btn"
              style={{ flex: 2 }}
              onClick={confirm}
              disabled={selected.id === 'custom' && (!customFull || !customMini)}
            >
              Commencer
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function HabitActive({ habit, logs, onLog, onReset, graduated, coachReminder, onOpenSettings, onReplayOnboarding }) {
  const last14 = useMemo(() => getLast14(logs), [logs])
  const { streak, rescues, perfect } = useMemo(() => computeStreak(logs), [logs])
  const todayLog = logs.find((log) => log.date === todayStr()) ?? null
  const context = getContextMessage(streak, todayLog?.status)
  const progress = Math.min(100, Math.round((streak / GRADUATION_DAYS) * 100))
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">HABITUDE</div>
          <div className="view-title">Motivation</div>
          <div className="view-subtitle">{graduated ? 'Chaine installee' : `Jour ${streak} / ${GRADUATION_DAYS}`}</div>
        </div>
        <div className="header-right">
          {streak > 0 && (
            <div className="badge badge-streak">Feu {streak}j</div>
          )}
        </div>
      </div>

      <CoachNotice reminder={coachReminder} onOpenSettings={onOpenSettings} onReplayOnboarding={onReplayOnboarding} />

      <div className="card habit-focus-card">
        <div className="habit-focus-ghost">{habit.emoji}</div>
        <div className="habit-focus-header">
          <span className="habit-focus-emoji">{habit.emoji}</span>
          <div className="habit-focus-copy">
            <div className="habit-focus-label">Focus du jour</div>
            <div className="habit-focus-title">{habit.fullAction}</div>
            <div className="habit-focus-mini">Mini : {habit.miniAction}</div>
          </div>
        </div>

        <div className="habit-context-banner">
          <span className="habit-context-emoji">{context.emoji}</span>
          <span className="habit-context-text">{context.text}</span>
        </div>

        <div className="habit-checkin-panel">
          <div className="habit-checkin-date">{dateLabel}</div>
          <CheckInButtons todayLog={todayLog} onCheck={onLog} />
        </div>
      </div>

      {!graduated && (
        <div className="card">
          <div className="card-title">Progression</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <div className="progress-track" style={{ flex: 1 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--acc)', minWidth: 32, textAlign: 'right' }}>
              {progress}%
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', textAlign: 'center' }}>
            {streak}/{GRADUATION_DAYS} jours
          </div>
        </div>
      )}

      {graduated && (
        <div
          style={{
            background: 'var(--ok-dim)',
            border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 'var(--r3)',
            padding: 'var(--s4)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ok)', marginBottom: 4 }}>
            Chaine installee
          </div>
          <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 'var(--s3)' }}>
            {streak} jours consecutifs. Tu peux continuer ou lancer une nouvelle habitude.
          </div>
          <button className="save-btn" style={{ background: 'linear-gradient(135deg, var(--ok), #059669)' }} onClick={onReset}>
            Creer une nouvelle habitude
          </button>
        </div>
      )}

      <div className="card habit-summary-card">
        <div className="card-title">Bilan recent</div>
        <ChainDots days={last14} />
        <div className="habit-summary-legend">
          {[
            { color: 'var(--acc)', label: `${perfect} Fait` },
            { color: 'var(--p-color)', label: `${rescues} Mini` },
            { color: 'var(--surface-3)', label: 'Vide', border: '1px solid var(--border)' },
          ].map((legend) => (
            <div key={legend.label} className="habit-summary-legend-item">
              <div className="habit-summary-legend-dot" style={{ background: legend.color, border: legend.border }} />
              <span>{legend.label}</span>
            </div>
          ))}
        </div>

        <div className="habit-summary-stats">
          <div className="stat-card habit-summary-stat-card">
            <div className="stat-lbl">Chaine</div>
            <div className="stat-val">{streak}<span className="stat-unit">j</span></div>
          </div>
          <div className="stat-card habit-summary-stat-card">
            <div className="stat-lbl">Mini</div>
            <div className="stat-val" style={{ color: rescues > 0 ? 'var(--p-color)' : undefined }}>
              {rescues}<span className="stat-unit">mini</span>
            </div>
          </div>
          <div className="stat-card habit-summary-stat-card">
            <div className="stat-lbl">Faits</div>
            <div className="stat-val" style={{ color: 'var(--acc)' }}>
              {perfect}<span className="stat-unit">ok</span>
            </div>
          </div>
          <div className="stat-card habit-summary-stat-card">
            <div className="stat-lbl">Debut</div>
            <div className="stat-val" style={{ fontSize: 14 }}>
              {new Date(`${habit.createdAt}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>
      </div>

      <button
        className="btn-ghost"
        onClick={() => {
          if (confirm("Abandonner cette habitude et en commencer une nouvelle ?")) onReset()
        }}
      >
        Changer d habitude
      </button>
    </div>
  )
}

export default function Habit({ coachReminder = null, onOpenSettings = () => {}, onReplayOnboarding = () => {} }) {
  const [habit, setHabit] = useState(() => loadHabit())
  const [logs, setLogs] = useState(() => loadHabitLogs())

  function createHabit(nextHabit) {
    setHabit(nextHabit)
    saveHabit(nextHabit)
    setLogs([])
    saveHabitLogs([])
  }

  function logToday(status) {
    if (status === null) {
      const updated = logs.filter((log) => log.date !== todayStr())
      setLogs(updated)
      saveHabitLogs(updated)
      return
    }

    const entry = { date: todayStr(), status, ts: Date.now() }
    const updated = [...logs.filter((log) => log.date !== todayStr()), entry]
    setLogs(updated)
    saveHabitLogs(updated)
  }

  function resetHabit() {
    setHabit(null)
    saveHabit(null)
    setLogs([])
    saveHabitLogs([])
  }

  if (!habit) {
    return (
      <HabitSetup
        onCreate={createHabit}
        coachReminder={coachReminder}
        onOpenSettings={onOpenSettings}
        onReplayOnboarding={onReplayOnboarding}
      />
    )
  }

  const graduated = isGraduated(logs)

  return (
    <HabitActive
      habit={habit}
      logs={logs}
      onLog={logToday}
      onReset={resetHabit}
      graduated={graduated}
      coachReminder={coachReminder}
      onOpenSettings={onOpenSettings}
      onReplayOnboarding={onReplayOnboarding}
    />
  )
}
