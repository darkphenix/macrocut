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
    <div
      style={{
        background: 'var(--tooltip-bg)',
        border: '1px solid var(--tooltip-border)',
        borderRadius: 8,
        padding: '7px 11px',
        fontFamily: 'DM Mono, monospace',
        fontSize: 12,
      }}
    >
      <div style={{ color: 'var(--tx-3)', marginBottom: 4 }}>{formatDateShort(label)}</div>
      {payload.map((item) => item.value != null && (
        <div key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {typeof item.value === 'number'
            ? item.dataKey === 'kcal' ? item.value.toLocaleString('fr-FR') : item.value.toFixed(1)
            : item.value}
          {item.dataKey === 'kcal' ? ' kcal' : ' kg'}
        </div>
      ))}
    </div>
  )
}

export default function Trend({ logs, settings, currentWeight, progressPct, targets, forecast, energyModel }) {
  const sorted = useMemo(() => [...logs].sort((a, b) => a.date.localeCompare(b.date)), [logs])
  const last30 = sorted.slice(-30)
  const weightData = useMemo(() => getRollingAvgWeight(sorted, 7).slice(-30), [sorted])
  const kcalData = useMemo(() => last30.map((log) => ({ date: log.date, kcal: log.totalKcal })), [last30])

  const totalLost = settings.startWeight - currentWeight
  const remaining = Math.max(0, currentWeight - settings.goalWeight)
  const avgKcal7 = useMemo(() => {
    const values = sorted.slice(-7).map((log) => log.totalKcal).filter((value) => value != null)
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
  }, [sorted])

  if (!logs.length) {
    return (
      <div className="view">
        <div className="view-header">
          <div>
            <div className="view-title">TENDANCE</div>
          </div>
        </div>
        <div className="empty">
          <div className="empty-icon">[]</div>
          <div className="empty-txt">Log quelques jours pour voir tes tendances apparaitre ici.</div>
        </div>
      </div>
    )
  }

  const axisTick = { fill: 'var(--chart-muted)', fontSize: 10, fontFamily: 'DM Mono, monospace' }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">TENDANCE</div>
          <div className="view-subtitle">Vue simple des 30 derniers jours</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-lbl">Evolution</div>
          <div className="stat-val" style={{ color: totalLost >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
            {totalLost >= 0 ? '-' : '+'}{Math.abs(totalLost).toFixed(1)}
            <span className="stat-unit">kg</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Reste a perdre</div>
          <div className="stat-val">
            {remaining.toFixed(1)}<span className="stat-unit">kg</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Moy. kcal 7j</div>
          <div className="stat-val">
            {avgKcal7 ?? '-'}<span className="stat-unit">{avgKcal7 ? 'kcal' : ''}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Estimation</div>
          <div className="stat-val" style={{ color: forecast?.etaLabel ? 'var(--acc)' : 'var(--tx)' }}>
            {forecast?.etaLabel ?? energyModel?.confidenceLabel ?? '-'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Projection objectif</div>
        <div style={{ display: 'grid', gap: 'var(--s2)' }}>
          <div className="meta-row">
            <div className="meta-lbl">Rythme cible</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div className="meta-val" style={{ color: 'var(--ok)' }}>{targets.effectiveWeeklyLoss ?? 0}</div>
              <div className="meta-unit">kg/sem</div>
            </div>
            <div className="meta-note">Cible effective apres garde-fous</div>
          </div>
          <div className="meta-row">
            <div className="meta-lbl">Rythme observe</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div className="meta-val" style={{ color: 'var(--acc)' }}>
                {forecast?.observedLossPerWeek != null ? forecast.observedLossPerWeek : '-'}
              </div>
              <div className="meta-unit">kg/sem</div>
            </div>
            <div className="meta-note">{forecast?.label ?? 'Signal en construction'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Poids (kg)</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis domain={['auto', 'auto']} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={settings.goalWeight} stroke="var(--ok)" strokeDasharray="4 4" opacity={0.6} />
              <Line
                type="monotone"
                dataKey="weight"
                name="poids"
                stroke="var(--chart-muted)"
                strokeWidth={1}
                dot={{ fill: 'var(--chart-muted)', r: 2 }}
                activeDot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="rollingAvg"
                name="moy.7j"
                stroke="var(--acc)"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Calories (kcal/j)</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kcalData} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis domain={['auto', 'auto']} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={targets.targetKcal} stroke="var(--acc)" strokeDasharray="4 4" opacity={0.5} />
              <Line
                type="monotone"
                dataKey="kcal"
                name="kcal"
                stroke="var(--p-color)"
                strokeWidth={2}
                dot={{ fill: 'var(--p-color)', r: 2.5 }}
                activeDot={{ r: 4, fill: 'var(--p-color)' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Progression objectif</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--tx-2)', minWidth: 42 }}>
            {settings.startWeight} kg
          </span>
          <div className="progress-track" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--tx-2)', minWidth: 42, textAlign: 'right' }}>
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
