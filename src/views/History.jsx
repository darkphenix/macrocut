import { formatDate } from '../store'
import { logTotals } from '../store'

export default function History({ logs, onDelete, targets }) {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  if (!logs.length) return (
    <div className="view">
      <div className="view-header"><div>
        <div className="view-title">JOURNAL</div>
        <div className="view-subtitle">Aucune entrée</div>
      </div></div>
      <div className="empty">
        <div className="empty-icon">📋</div>
        <div className="empty-txt">Commence par ajouter un repas ou ton poids dans Aujourd'hui.</div>
      </div>
    </div>
  )

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">JOURNAL</div>
          <div className="view-subtitle">{logs.length} jour{logs.length > 1 ? 's' : ''} enregistres</div>
        </div>
      </div>

      <div className="history-list">
        {sorted.map((log) => {
          const tot   = logTotals(log)
          const hasK  = tot.kcal > 0
          const ok    = hasK && tot.kcal <= targets.targetKcal
          const over  = hasK && tot.kcal > targets.targetKcal

          return (
            <div key={log.date} className="h-entry">
              <div className="h-date">{formatDate(log.date)}</div>
              <div className="h-vals">
                <div className={`h-kcal ${ok ? 'ok' : over ? 'over' : ''}`}>
                  {hasK ? `${tot.kcal.toLocaleString('fr-FR')} kcal` : '— kcal'}
                </div>
                <div className="h-macros">
                  P{tot.protein || '—'} · G{tot.carbs || '—'} · L{tot.fat || '—'}
                </div>
              </div>
              <div className="h-weight">
                {log.weight != null ? `${log.weight.toFixed(1)} kg` : '—'}
              </div>
              <button className="h-del" onClick={() => onDelete(log.date)}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
