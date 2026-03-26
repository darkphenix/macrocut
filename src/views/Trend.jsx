import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { formatDateShort } from '../store'
import { getRollingAvgWeight } from '../algo'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#141428', border: '1px solid #1d1d38',
      borderRadius: 8, padding: '7px 11px',
      fontFamily: 'DM Mono, monospace', fontSize: 12,
    }}>
      <div style={{ color: '#5c5c7a', marginBottom: 4 }}>{formatDateShort(label)}</div>
      {payload.map((p) => p.value != null && (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number'
            ? p.dataKey === 'kcal' ? p.value.toLocaleString('fr-FR') : p.value.toFixed(1)
            : p.value}
          {p.dataKey === 'kcal' ? ' kcal' : ' kg'}
        </div>
      ))}
    </div>
  )
}

export default function Trend({ logs, settings, currentWeight, progressPct, targets }) {
  const sorted = useMemo(() => [...logs].sort((a, b) => a.date.localeCompare(b.date)), [logs])
  const last30 = sorted.slice(-30)

  const weightData = useMemo(() => getRollingAvgWeight(sorted, 7).slice(-30), [sorted])
  const kcalData   = useMemo(() => last30.map((l) => ({ date: l.date, kcal: l.totalKcal })), [last30])

  const totalLost = settings.startWeight - currentWeight
  const remaining = Math.max(0, currentWeight - settings.goalWeight)

  const avgKcal7 = useMemo(() => {
    const vals = sorted.slice(-7).map((l) => l.totalKcal).filter((v) => v != null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }, [sorted])

  const weeksToGoal = remaining > 0 ? Math.ceil(remaining / settings.weeklyLoss) : 0

  if (!logs.length) {
    return (
      <div className="view">
        <div className="view-header"><div><div className="view-title">TENDANCE</div></div></div>
        <div className="empty">
          <div className="empty-icon">📉</div>
          <div className="empty-txt">Log quelques jours pour voir tes tendances apparaître ici.</div>
        </div>
      </div>
    )
  }

  const axisTick = { fill: '#5c5c7a', fontSize: 10, fontFamily: 'DM Mono, monospace' }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">TENDANCE</div>
          <div className="view-subtitle">30 derniers jours</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-lbl">Perdu</div>
          <div className="stat-val" style={{ color: totalLost >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
            {totalLost >= 0 ? '−' : '+'}{Math.abs(totalLost).toFixed(1)}
            <span className="stat-unit">kg</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Restant</div>
          <div className="stat-val">
            {remaining.toFixed(1)}<span className="stat-unit">kg</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Moy. kcal 7j</div>
          <div className="stat-val">
            {avgKcal7 ?? '—'}<span className="stat-unit">{avgKcal7 ? 'k' : ''}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Semaines restantes</div>
          <div className="stat-val" style={{ color: weeksToGoal === 0 ? 'var(--ok)' : undefined }}>
            {weeksToGoal > 0 ? weeksToGoal : '✓'}
            {weeksToGoal > 0 && <span className="stat-unit">sem</span>}
          </div>
        </div>
      </div>

      {/* Weight chart */}
      <div className="card">
        <div className="card-title">Poids (kg)</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="#1d1d38" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={axisTick} axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={axisTick} axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={settings.goalWeight} stroke="var(--ok)" strokeDasharray="4 4" opacity={0.6} />
              {/* Points bruts */}
              <Line
                type="monotone" dataKey="weight" name="poids"
                stroke="rgba(92,92,122,0.5)" strokeWidth={1}
                dot={{ fill: 'rgba(92,92,122,0.7)', r: 2 }} activeDot={false}
                connectNulls={false}
              />
              {/* Moyenne 7j */}
              <Line
                type="monotone" dataKey="rollingAvg" name="moy.7j"
                stroke="var(--acc)" strokeWidth={2.5}
                dot={false} connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--acc)' }} />
            <span className="legend-label">Moy. 7 jours</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'rgba(92,92,122,0.6)' }} />
            <span className="legend-label">Poids brut</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--ok)', opacity: 0.6 }} />
            <span className="legend-label">Objectif {settings.goalWeight} kg</span>
          </div>
        </div>
      </div>

      {/* Kcal chart */}
      <div className="card">
        <div className="card-title">Calories (kcal/j)</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kcalData} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#1d1d38" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={axisTick} axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={axisTick} axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={targets.targetKcal} stroke="var(--acc)" strokeDasharray="4 4" opacity={0.5} />
              <Line
                type="monotone" dataKey="kcal" name="kcal"
                stroke="var(--p-color)" strokeWidth={2}
                dot={{ fill: 'var(--p-color)', r: 2.5 }}
                activeDot={{ r: 4, fill: 'var(--p-color)' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--p-color)' }} />
            <span className="legend-label">Kcal consommées</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--acc)', opacity: 0.6 }} />
            <span className="legend-label">Target {targets.targetKcal} kcal</span>
          </div>
        </div>
      </div>

      {/* Progress bar objectif */}
      <div className="card">
        <div className="card-title">Progression objectif</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--muted)', minWidth: 42 }}>
            {settings.startWeight} kg
          </span>
          <div className="progress-track" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--muted)', minWidth: 42, textAlign: 'right' }}>
            {settings.goalWeight} kg
          </span>
        </div>
        <div style={{ textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 14, color: 'var(--acc)' }}>
          {progressPct}% · actuellement {currentWeight.toFixed(1)} kg
        </div>
      </div>
    </div>
  )
}
