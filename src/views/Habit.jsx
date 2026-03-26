import { useState, useMemo } from 'react'
import {
  loadHabit, saveHabit, loadHabitLogs, saveHabitLogs,
  HABIT_SUGGESTIONS, GRADUATION_DAYS,
  computeStreak, getLast14, isGraduated, getContextMessage, todayStr,
} from '../habitStore'

/* ── Dot chain ─────────────────────────────────────────────── */
function ChainDots({ days }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
      {days.map((d) => {
        const color =
          d.status === 'done'    ? 'var(--acc)' :
          d.status === 'minimum' ? 'var(--p-color)' :
          d.status === 'missed'  ? 'var(--danger)' :
          'var(--surface-3)'
        const glow =
          d.status === 'done'    ? '0 0 6px var(--acc-glow)' :
          d.status === 'minimum' ? '0 0 6px rgba(167,139,250,0.3)' : 'none'
        return (
          <div key={d.date} title={d.date} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: color,
            boxShadow: glow,
            border: d.date === todayStr() ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
            transition: 'all 0.3s',
            flexShrink: 0,
          }} />
        )
      })}
    </div>
  )
}

/* ── Action buttons ────────────────────────────────────────── */
function CheckInButtons({ todayLog, onCheck, streak }) {
  if (todayLog) {
    const labels = { done: ['✓ Fait !', 'var(--ok)'], minimum: ['⚡ Version mini', 'var(--p-color)'], missed: ['✗ Raté', 'var(--danger)'] }
    const [label, color] = labels[todayLog.status] ?? ['—', 'var(--tx-3)']
    return (
      <div style={{
        background: 'var(--surface-3)',
        border: `1px solid ${color}22`,
        borderRadius: 'var(--r2)',
        padding: 'var(--s4)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>{label.split(' ')[0]}</div>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color }}>{label}</div>
        <button onClick={() => onCheck(null)}
          style={{ marginTop: 10, background: 'none', border: 'none',
            color: 'var(--tx-3)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
          Corriger
        </button>
      </div>
    )
  }

  // Rescue mode : si hier était raté et pas encore checké aujourd'hui
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
      <button className="save-btn" onClick={() => onCheck('done')}
        style={{ fontSize: 16, padding: 'var(--s4)', letterSpacing: 1 }}>
        ✓ Fait !
      </button>
      <button onClick={() => onCheck('minimum')}
        style={{
          padding: 'var(--s3) var(--s4)',
          background: 'var(--acc-dim)',
          border: '1px solid var(--border-acc)',
          borderRadius: 'var(--r2)',
          color: 'var(--acc)',
          fontFamily: 'var(--f-ui)', fontWeight: 800,
          fontSize: 14, letterSpacing: 1,
          cursor: 'pointer',
        }}>
        ⚡ Version minimale
        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--tx-2)', marginTop: 2, letterSpacing: 0 }}>
          Garder la chaîne vivante
        </div>
      </button>
      <button onClick={() => onCheck('missed')}
        style={{
          padding: 'var(--s2)', background: 'none',
          border: '1px solid var(--border)', borderRadius: 'var(--r2)',
          color: 'var(--tx-3)', fontFamily: 'var(--f-ui)',
          fontSize: 12, cursor: 'pointer', letterSpacing: 0.5,
        }}>
        ✗ Pas fait aujourd'hui
      </button>
    </div>
  )
}

/* ── Onboarding : choisir / créer une habitude ─────────────── */
function HabitSetup({ onCreate }) {
  const [step, setStep]         = useState('pick') // 'pick' | 'customize'
  const [selected, setSelected] = useState(null)
  const [customFull, setCF]     = useState('')
  const [customMini, setCM]     = useState('')
  const [time, setTime]         = useState('08:00')

  function confirm() {
    const s = selected
    const habit = {
      id:          s.id + '_' + Date.now(),
      emoji:       s.emoji,
      name:        s.name,
      fullAction:  s.id === 'custom' ? customFull : s.full,
      miniAction:  s.id === 'custom' ? customMini : s.mini,
      reminderTime: time,
      createdAt:   todayStr(),
      graduated:   false,
    }
    onCreate(habit)
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">HABITUDE</div>
          <div className="view-subtitle">
            {step === 'pick' ? 'Choisis une habitude' : 'Personnalise ton habitude'}
          </div>
        </div>
      </div>

      {step === 'pick' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--tx-3)', lineHeight: 1.6, padding: '0 2px' }}>
            Une seule habitude à la fois. Tu ne pourras pas en ajouter une autre avant 21 jours consécutifs.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            {HABIT_SUGGESTIONS.map((s) => (
              <button key={s.id}
                onClick={() => setSelected(s)}
                style={{
                  textAlign: 'left',
                  padding: 'var(--s3) var(--s4)',
                  background: selected?.id === s.id ? 'var(--acc-dim)' : 'var(--surface)',
                  border: `1px solid ${selected?.id === s.id ? 'var(--border-acc)' : 'var(--border)'}`,
                  borderRadius: 'var(--r2)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                  transition: 'all var(--t-fast)',
                }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{s.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 700, fontSize: 15,
                    color: selected?.id === s.id ? 'var(--acc)' : 'var(--tx)' }}>
                    {s.name}
                  </div>
                  {s.id !== 'custom' && (
                    <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{s.full}</div>
                  )}
                </div>
                {selected?.id === s.id && (
                  <span style={{ color: 'var(--acc)', fontSize: 18 }}>✓</span>
                )}
              </button>
            ))}
          </div>
          {selected && (
            <button className="save-btn" onClick={() => setStep('customize')}>
              Continuer →
            </button>
          )}
        </>
      )}

      {step === 'customize' && selected && (
        <>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r3)',
            padding: 'var(--s4)',
            display: 'flex', alignItems: 'center', gap: 'var(--s3)',
          }}>
            <span style={{ fontSize: 32 }}>{selected.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--tx)' }}>{selected.name}</div>
            </div>
          </div>

          <div className="sgroup">
            <div className="sgroup-title">Actions</div>
            {selected.id === 'custom' ? (
              <>
                <div className="srow">
                  <div className="srow-head"><span className="srow-name">Action complète</span></div>
                  <input type="text"
                    placeholder="ex : Marcher 15 minutes"
                    value={customFull}
                    onChange={(e) => setCF(e.target.value)}
                    style={{
                      background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                      borderRadius: 'var(--r2)', padding: '10px var(--s3)',
                      color: 'var(--tx)', fontFamily: 'var(--f-ui)', fontSize: 14,
                      outline: 'none', width: '100%',
                    }}
                  />
                </div>
                <div className="srow">
                  <div className="srow-head"><span className="srow-name">Version minimale ⚡</span></div>
                  <input type="text"
                    placeholder="ex : Marcher 3 minutes"
                    value={customMini}
                    onChange={(e) => setCM(e.target.value)}
                    style={{
                      background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                      borderRadius: 'var(--r2)', padding: '10px var(--s3)',
                      color: 'var(--tx)', fontFamily: 'var(--f-ui)', fontSize: 14,
                      outline: 'none', width: '100%',
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--tx-3)' }}>Action complète</div>
                  <div style={{ fontFamily: 'var(--f-ui)', fontSize: 14, color: 'var(--tx)', padding: '10px var(--s3)', background: 'var(--bg-2)', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}>
                    {selected.full}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--tx-3)' }}>Version minimale ⚡</div>
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
              <span className="time-label">🔔 Heure du rappel</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('pick')}>← Retour</button>
            <button className="save-btn" style={{ flex: 2 }}
              onClick={confirm}
              disabled={selected.id === 'custom' && (!customFull || !customMini)}
            >
              Commencer 🌱
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Vue habitude active ────────────────────────────────────── */
function HabitActive({ habit, logs, onLog, onReset, graduated }) {
  const today14    = useMemo(() => getLast14(logs), [logs])
  const { streak, rescues, perfect } = useMemo(() => computeStreak(logs), [logs])
  const todayLog   = logs.find((l) => l.date === todayStr()) ?? null
  const ctx        = getContextMessage(streak, todayLog?.status)
  const progress   = Math.min(100, Math.round((streak / GRADUATION_DAYS) * 100))

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">HABITUDE</div>
          <div className="view-subtitle">{graduated ? '✓ Habitude installée' : `Jour ${streak} / ${GRADUATION_DAYS}`}</div>
        </div>
        <div className="header-right">
          {streak > 0 && (
            <div className="badge badge-streak">🔥 {streak}j</div>
          )}
        </div>
      </div>

      {/* Carte habitude */}
      <div className="card" style={{ background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -30, right: -20,
          fontSize: 90, opacity: 0.06, lineHeight: 1,
          pointerEvents: 'none', userSelect: 'none',
        }}>{habit.emoji}</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s3)' }}>
          <span style={{ fontSize: 36, flexShrink: 0 }}>{habit.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--tx)', marginBottom: 4 }}>
              {habit.fullAction}
            </div>
            <div style={{ fontSize: 12, color: 'var(--acc)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⚡</span>
              <span>Mini : {habit.miniAction}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Message contextuel */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r2)',
        padding: 'var(--s3) var(--s4)',
        display: 'flex', alignItems: 'center', gap: 'var(--s3)',
      }}>
        <span style={{ fontSize: 22 }}>{ctx.emoji}</span>
        <span style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.5 }}>{ctx.text}</span>
      </div>

      {/* Check-in du jour */}
      <div className="log-form">
        <div className="form-title">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <CheckInButtons todayLog={todayLog} onCheck={onLog} streak={streak} />
      </div>

      {/* Progression 21j */}
      {!graduated && (
        <div className="card">
          <div className="card-title">Progression vers installation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <div className="progress-track" style={{ flex: 1 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--acc)', minWidth: 32, textAlign: 'right' }}>
              {progress}%
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', textAlign: 'center' }}>
            {streak}/{GRADUATION_DAYS} jours · {Math.max(0, GRADUATION_DAYS - streak)} restants pour installer l'habitude
          </div>
        </div>
      )}

      {graduated && (
        <div style={{
          background: 'var(--ok-dim)', border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: 'var(--r3)', padding: 'var(--s4)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ok)', marginBottom: 4 }}>
            Habitude installée !
          </div>
          <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 'var(--s3)' }}>
            {streak} jours consécutifs. Cette habitude fait partie de toi. Tu peux en créer une nouvelle.
          </div>
          <button className="save-btn" style={{ background: 'linear-gradient(135deg, var(--ok), #059669)' }}
            onClick={onReset}>
            Créer une nouvelle habitude →
          </button>
        </div>
      )}

      {/* Chaîne 14 jours */}
      <div className="card">
        <div className="card-title">Chaîne — 14 derniers jours</div>
        <ChainDots days={today14} />
        <div style={{ display: 'flex', gap: 'var(--s4)', marginTop: 'var(--s3)', justifyContent: 'center' }}>
          {[
            { color: 'var(--acc)',      label: `${perfect} Fait` },
            { color: 'var(--p-color)', label: `${rescues} Mini` },
            { color: 'var(--surface-3)', label: 'Vide', border: '1px solid var(--border)' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, border: l.border, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-lbl">Chaîne actuelle</div>
          <div className="stat-val">{streak}<span className="stat-unit">j</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Rescues utilisés</div>
          <div className="stat-val" style={{ color: rescues > 0 ? 'var(--p-color)' : undefined }}>
            {rescues}<span className="stat-unit">⚡</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Jours parfaits</div>
          <div className="stat-val" style={{ color: 'var(--acc)' }}>
            {perfect}<span className="stat-unit">✓</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Début</div>
          <div className="stat-val" style={{ fontSize: 14 }}>
            {new Date(habit.createdAt + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
        </div>
      </div>

      {/* Réinitialiser */}
      <button className="btn-ghost" onClick={() => {
        if (confirm('Abandonner cette habitude et en commencer une nouvelle ?')) onReset()
      }}>
        Changer d'habitude
      </button>
    </div>
  )
}

/* ── Export principal ───────────────────────────────────────── */
export default function Habit() {
  const [habit, setHabit]     = useState(() => loadHabit())
  const [logs,  setLogs]      = useState(() => loadHabitLogs())

  function createHabit(h) {
    setHabit(h); saveHabit(h)
    setLogs([]); saveHabitLogs([])
  }

  function logToday(status) {
    if (status === null) {
      // Correction : retirer le log du jour
      const updated = logs.filter((l) => l.date !== todayStr())
      setLogs(updated); saveHabitLogs(updated); return
    }
    const entry   = { date: todayStr(), status, ts: Date.now() }
    const updated = [...logs.filter((l) => l.date !== todayStr()), entry]
    setLogs(updated); saveHabitLogs(updated)
  }

  function resetHabit() {
    setHabit(null); saveHabit(null)
    setLogs([]); saveHabitLogs([])
  }

  if (!habit) return <HabitSetup onCreate={createHabit} />

  const graduated = isGraduated(logs)
  return (
    <HabitActive
      habit={habit} logs={logs}
      onLog={logToday} onReset={resetHabit}
      graduated={graduated}
    />
  )
}
