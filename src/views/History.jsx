import { formatDate } from '../store'
import { logTotals } from '../store'

export default function History({ logs, onDelete, targets }) {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  if (!logs.length) {
    return (
      <div className="view">
        <div className="view-header">
          <div>
            <div className="view-title">Journal</div>
            <div className="view-subtitle">Aucune entree</div>
          </div>
        </div>
        <div className="empty">
          <div className="empty-icon">[]</div>
          <div className="empty-txt">Ajoute un repas ou un poids pour commencer.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Journal</div>
          <div className="view-subtitle">{logs.length} jour{logs.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="history-list">
        {sorted.map((log) => {
          const total = logTotals(log)
          const hasKcal = total.kcal > 0
          const ok = hasKcal && total.kcal <= targets.targetKcal
          const over = hasKcal && total.kcal > targets.targetKcal

          return (
            <div key={log.date} className="h-entry">
              <div className="h-date">{formatDate(log.date)}</div>
              <div className="h-vals">
                <div className={`h-kcal ${ok ? 'ok' : over ? 'over' : ''}`}>
                  {hasKcal ? `${total.kcal.toLocaleString('fr-FR')} kcal` : '— kcal'}
                </div>
                <div className="h-macros">
                  P{total.protein || '—'} · G{total.carbs || '—'} · L{total.fat || '—'}
                </div>
              </div>
              <div className="h-weight">
                {log.weight != null ? `${log.weight.toFixed(1)} kg` : '—'}
              </div>
              <button className="h-del" onClick={() => onDelete(log.date)} aria-label={`Supprimer ${log.date}`}>
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
