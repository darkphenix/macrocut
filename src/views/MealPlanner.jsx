import { useEffect, useMemo, useState } from 'react'
import { formatDateShort } from '../store'
import {
  enrichMealPackHints,
  enrichWeekPlanPackHints,
  generateRandomMeal,
  generateWeekPlan,
  getDefaultHousehold,
  sanitizeHousehold,
  scaleMeal,
} from '../mealPlanner/generator'
import { deriveMealPlanSummary, loadMealPlanState, saveMealPlanState } from '../mealPlanner/store'
import { MEAL_SLOTS, MEAL_TEMPLATES, SLOT_LABELS } from '../mealPlanner/templates'

const TEMPLATE_BY_ID = new Map(MEAL_TEMPLATES.map((template) => [template.id, template]))

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function formatMetric(value) {
  const numeric = Number(value) || 0
  const rounded = Math.round(numeric * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString('fr-FR')
}

function sumDay(day) {
  return MEAL_SLOTS.reduce(
    (acc, slot) => {
      const meal = day?.[slot]
      if (!meal?.adultServingMacros) return acc
      return {
        mealCount: acc.mealCount + 1,
        kcal: acc.kcal + (meal.adultServingMacros.kcal || 0),
        protein: acc.protein + (meal.adultServingMacros.protein || 0),
        carbs: acc.carbs + (meal.adultServingMacros.carbs || 0),
        fat: acc.fat + (meal.adultServingMacros.fat || 0),
      }
    },
    { mealCount: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function judgeWeekPlan(weekPlan, targets) {
  const totalSlots = weekPlan.length * MEAL_SLOTS.length
  const plannedMeals = weekPlan.flatMap((day) => MEAL_SLOTS.map((slot) => day?.[slot]).filter(Boolean))
  const completionPct = totalSlots ? Math.round((plannedMeals.length / totalSlots) * 100) : 0
  const completeDays = weekPlan.map(sumDay).filter((day) => day.mealCount === MEAL_SLOTS.length)
  const averageDay = completeDays.length
    ? completeDays.reduce(
        (acc, day) => ({
          kcal: acc.kcal + day.kcal,
          protein: acc.protein + day.protein,
          carbs: acc.carbs + day.carbs,
          fat: acc.fat + day.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      )
    : null

  const avgKcal = averageDay ? Math.round(averageDay.kcal / completeDays.length) : 0
  const avgProtein = averageDay ? Math.round((averageDay.protein / completeDays.length) * 10) / 10 : 0
  const uniqueTemplates = new Set(plannedMeals.map((meal) => meal.templateId).filter(Boolean)).size
  const repeatCount = Math.max(0, plannedMeals.length - uniqueTemplates)
  const batchFriendlyCount = plannedMeals.filter((meal) =>
    (TEMPLATE_BY_ID.get(meal.templateId)?.tags ?? []).some((tag) => tag === 'batch' || tag === 'family')
  ).length
  const batchFriendlyPct = plannedMeals.length ? Math.round((batchFriendlyCount / plannedMeals.length) * 100) : 0

  const kcalGapPct = targets?.targetKcal > 0 && avgKcal > 0
    ? Math.abs(avgKcal - targets.targetKcal) / targets.targetKcal
    : 1
  const proteinGapPct = targets?.protein > 0 && avgProtein > 0
    ? Math.abs(avgProtein - targets.protein) / targets.protein
    : 1

  let score = 100
  score -= Math.round((100 - completionPct) * 0.45)
  score -= Math.round(Math.min(kcalGapPct, 0.35) * 70)
  score -= Math.round(Math.min(proteinGapPct, 0.35) * 90)
  score -= Math.max(0, repeatCount - 6) * 4
  score += Math.round(batchFriendlyPct * 0.05)
  score = clamp(score, 0, 100)

  let level = 'faible'
  let title = 'Plan a reajuster'
  let summary = 'Le moteur donne une base utile, mais pas encore assez stable pour piloter toute la semaine sans retouche.'

  if (score >= 85) {
    level = 'elevee'
    title = 'Plan solide'
    summary = 'Bonne base pour tenir la semaine: les creneaux sont couverts, les apports restent credibles et la rotation limite la lassitude.'
  } else if (score >= 70) {
    level = 'bonne'
    title = 'Bonne base'
    summary = 'Le plan est exploitable pour demarrer. Quelques retouches suffisent pour mieux coller a tes cibles ou a tes habitudes.'
  } else if (score >= 50) {
    level = 'moyenne'
    title = 'Plan correct mais fragile'
    summary = 'La structure est la, mais certains jours ou certaines macros s eloignent encore trop de la cible.'
  }

  const notes = []

  if (completionPct < 100) {
    notes.push(`Couverture partielle: ${plannedMeals.length}/${totalSlots} creneaux remplis.`)
  } else {
    notes.push('Semaine complete: tous les repas de base sont renseignes.')
  }

  if (avgKcal > 0) {
    const kcalDelta = avgKcal - (targets?.targetKcal ?? 0)
    const direction = kcalDelta >= 0 ? '+' : '-'
    notes.push(
      Math.abs(kcalDelta) <= 120
        ? `Budget bien cadre: ${avgKcal} kcal en moyenne par jour.`
        : `Budget a ajuster: ${avgKcal} kcal/j en moyenne (${direction}${Math.abs(kcalDelta)} vs cible).`
    )
  } else {
    notes.push('La moyenne quotidienne sera plus fiable une fois plusieurs jours complets generes.')
  }

  if (avgProtein > 0) {
    notes.push(
      avgProtein >= (targets?.protein ?? 0) * 0.92
        ? `Proteines solides: ${formatMetric(avgProtein)} g en moyenne par jour.`
        : `Proteines un peu basses: ${formatMetric(avgProtein)} g/j pour une cible a ${formatMetric(targets?.protein)} g.`
    )
  }

  notes.push(
    repeatCount <= 5
      ? `Variete correcte: ${uniqueTemplates} repas differents sur la semaine.`
      : `Rotation courte: ${repeatCount} repetitions a lisser pour eviter la lassitude.`
  )

  if (plannedMeals.length) {
    notes.push(`Praticite cuisine: ${batchFriendlyPct}% des repas sont compatibles batch ou famille.`)
  }

  return {
    score,
    level,
    title,
    summary,
    completionPct,
    avgKcal,
    avgProtein,
    uniqueTemplates,
    notes,
  }
}

function MacroLine({ meal }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--tx-2)', lineHeight: 1.6, fontFamily: 'var(--f-mono)' }}>
      Portion adulte {meal.servings}x - {meal.adultServingMacros.kcal} kcal - P{meal.adultServingMacros.protein} - G{meal.adultServingMacros.carbs} - L{meal.adultServingMacros.fat}
    </div>
  )
}

function IngredientPreview({ ingredient }) {
  const packText =
    ingredient.packSize && ingredient.packUnit === ingredient.unit
      ? ` - env. ${Math.max(1, Math.round((ingredient.scaledQty / ingredient.packSize) * 10) / 10)} paquet`
      : ''

  return (
    <div style={{ fontSize: 11, color: 'var(--tx-2)', lineHeight: 1.55 }}>
      {ingredient.name} - {ingredient.scaledQty} {ingredient.unit}
      {packText}
    </div>
  )
}

function PlannedMealCard({ meal, onAdd, onRegenerate, onRemove, onServingsChange }) {
  if (!meal) {
    return (
      <div className="card" style={{ padding: 'var(--s3)' }}>
        <div className="card-title">Repas vide</div>
        <button className="btn-ghost" onClick={onRegenerate}>Generer un repas</button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 'var(--s3)', display: 'grid', gap: 'var(--s2)' }}>
      <div className="section-heading section-heading-inline" style={{ marginBottom: 0 }}>
        <div>
          <div className="section-eyebrow">{meal.slotLabel}</div>
          <div className="section-title" style={{ fontSize: 15 }}>{meal.title}</div>
        </div>
        <div className="badge badge-dim">{meal.sourceMeta}</div>
      </div>

      <MacroLine meal={meal} />

      <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
        A cuisiner pour {meal.householdServings} portions foyer
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        {meal.ingredients.slice(0, 4).map((ingredient) => (
          <IngredientPreview key={`${meal.templateId}-${ingredient.name}`} ingredient={ingredient} />
        ))}
        {meal.ingredients.length > 4 && (
          <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>+ {meal.ingredients.length - 4} ingredients</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--s2)', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Portion adulte</span>
        <input
          type="number"
          min="0.8"
          max="2"
          step="0.1"
          value={meal.servings}
          onChange={(event) => onServingsChange(event.target.value)}
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-2)',
            borderRadius: 'var(--r2)',
            padding: '8px 10px',
            color: 'var(--tx)',
            fontFamily: 'var(--f-mono)',
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--s2)' }}>
        <button className="save-btn" onClick={onAdd}>Ajouter ma portion a aujourd hui</button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--s2)' }}>
          <button className="btn-ghost" onClick={onRegenerate}>Regenerer</button>
          <button className="btn-ghost" onClick={onRemove}>Supprimer</button>
        </div>
      </div>
    </div>
  )
}

export default function MealPlanner({ targets, onAddMealToToday }) {
  const [planState, setPlanState] = useState(loadMealPlanState)
  const [selectedDay, setSelectedDay] = useState(0)
  const [randomSlot, setRandomSlot] = useState('dinner')
  const [busyRandom, setBusyRandom] = useState(false)
  const [busyWeek, setBusyWeek] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    saveMealPlanState(planState)
  }, [planState])

  const summary = useMemo(() => deriveMealPlanSummary(planState), [planState])
  const household = summary.household ?? getDefaultHousehold()
  const weekPlan = summary.weekPlan ?? []
  const shoppingSummary = summary.shoppingSummary ?? []
  const randomSuggestion = summary.randomSuggestion
  const day = weekPlan[selectedDay] ?? null
  const review = useMemo(() => judgeWeekPlan(weekPlan, targets), [weekPlan, targets])

  function updateHousehold(field, value) {
    const nextHousehold = sanitizeHousehold({ ...household, [field]: value })
    setPlanState((prev) => ({
      ...prev,
      household: nextHousehold,
      weekPlan: (prev.weekPlan ?? []).map((plannedDay) => {
        const nextDay = { ...plannedDay }
        MEAL_SLOTS.forEach((slot) => {
          if (nextDay[slot]) nextDay[slot] = scaleMeal(nextDay[slot], nextHousehold)
        })
        return nextDay
      }),
      randomSuggestion: prev.randomSuggestion
        ? scaleMeal(prev.randomSuggestion, nextHousehold)
        : null,
    }))
  }

  async function handleGenerateRandom() {
    setBusyRandom(true)
    setFeedback('')
    try {
      const meal = generateRandomMeal({
        targets,
        slot: randomSlot,
        household,
        previousMeal: randomSuggestion?.slot === randomSlot ? randomSuggestion : null,
      })
      setPlanState((prev) => ({ ...prev, randomSuggestion: meal }))
      const enriched = await enrichMealPackHints(meal)
      setPlanState((prev) => ({ ...prev, randomSuggestion: enriched }))
    } finally {
      setBusyRandom(false)
    }
  }

  async function handleGenerateWeek() {
    setBusyWeek(true)
    setEnriching(true)
    setFeedback('')
    try {
      const localPlan = generateWeekPlan({ targets, household })
      setPlanState((prev) => ({ ...prev, weekPlan: localPlan }))
      setSelectedDay(0)
      const enriched = await enrichWeekPlanPackHints(localPlan)
      setPlanState((prev) => ({ ...prev, weekPlan: enriched }))
    } finally {
      setBusyWeek(false)
      setEnriching(false)
    }
  }

  function updateMeal(dayIndex, slot, nextMeal) {
    setPlanState((prev) => ({
      ...prev,
      weekPlan: (prev.weekPlan ?? []).map((plannedDay, index) =>
        index === dayIndex ? { ...plannedDay, [slot]: nextMeal } : plannedDay
      ),
    }))
  }

  async function regenerateMeal(dayIndex, slot) {
    const previousDay = weekPlan[dayIndex - 1] ?? null
    const previousMeal = previousDay?.[slot] ?? null
    const meal = generateRandomMeal({
      targets,
      slot,
      household,
      previousMeal,
    })
    updateMeal(dayIndex, slot, meal)
    const enriched = await enrichMealPackHints(meal)
    updateMeal(dayIndex, slot, enriched)
  }

  function removeMeal(dayIndex, slot) {
    updateMeal(dayIndex, slot, null)
  }

  function changeMealServings(dayIndex, slot, value) {
    const currentMeal = weekPlan[dayIndex]?.[slot]
    if (!currentMeal) return
    updateMeal(dayIndex, slot, scaleMeal(currentMeal, household, value))
  }

  function addMealToToday(meal) {
    if (!meal) return
    onAddMealToToday?.(meal)
    setFeedback(`"${meal.title}" ajoute a aujourd hui.`)
    setTimeout(() => setFeedback(''), 1800)
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">PLAN REPAS</div>
          <div className="view-subtitle">Repas, semaine et courses adaptes au foyer</div>
        </div>
      </div>

      <section className="card planner-review-card">
        <div className="section-heading section-heading-inline">
          <div>
            <div className="section-eyebrow">Diagnostic</div>
            <div className="section-title">
              {review.title}
              <span className={`badge badge-quality badge-quality-${review.level}`}>
                {review.score}/100
              </span>
            </div>
            <div className="view-subtitle planner-review-subtitle">{review.summary}</div>
          </div>
        </div>

        <div className="planner-review-grid">
          <div className="planner-review-metric">
            <strong>{review.completionPct}%</strong>
            <span>creneaux couverts</span>
          </div>
          <div className="planner-review-metric">
            <strong>{review.avgKcal || '--'}</strong>
            <span>kcal/j planifiees</span>
          </div>
          <div className="planner-review-metric">
            <strong>{review.avgProtein ? `${formatMetric(review.avgProtein)}g` : '--'}</strong>
            <span>proteines/j</span>
          </div>
          <div className="planner-review-metric">
            <strong>{review.uniqueTemplates || 0}</strong>
            <span>repas differents</span>
          </div>
        </div>

        <div className="planner-review-list">
          {review.notes.map((note) => (
            <div key={note} className="planner-review-note">
              {note}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">Foyer</div>
            <div className="section-title">Adapter les quantites famille</div>
          </div>
        </div>

        <div className="form-grid">
          <div className="ig">
            <label>Adultes</label>
            <input type="number" min="1" max="8" value={household.adults} onChange={(event) => updateHousehold('adults', event.target.value)} />
          </div>
          <div className="ig">
            <label>Enfants</label>
            <input type="number" min="0" max="8" value={household.children} onChange={(event) => updateHousehold('children', event.target.value)} />
          </div>
          <div className="ig">
            <label>Coefficient enfant</label>
            <input type="number" min="0.3" max="1" step="0.05" value={household.childFactor} onChange={(event) => updateHousehold('childFactor', event.target.value)} />
          </div>
        </div>

        <div className="settings-inline-note" style={{ marginTop: 'var(--s3)' }}>
          1 adulte = 1 portion. Les enfants reduisent automatiquement les quantites de courses selon le coefficient choisi.
        </div>
      </section>

      <section className="card">
        <div className="section-heading section-heading-inline">
          <div>
            <div className="section-eyebrow">Repas aleatoire</div>
            <div className="section-title">Trouver une idee rapide</div>
          </div>
          <button className="save-btn" style={{ width: 'auto', padding: '10px 14px' }} onClick={handleGenerateRandom} disabled={busyRandom}>
            {busyRandom ? 'Generation...' : 'Generer'}
          </button>
        </div>

        <div className="seg-tabs">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              className={`seg-btn ${randomSlot === slot ? 'active' : ''}`}
              onClick={() => setRandomSlot(slot)}
            >
              {SLOT_LABELS[slot]}
            </button>
          ))}
        </div>

        {!randomSuggestion && (
          <div className="empty" style={{ padding: 'var(--s5) var(--s4)' }}>
            <div className="empty-txt">Genere un repas compatible avec le creneau choisi et tes macros du jour.</div>
          </div>
        )}

        {randomSuggestion && (
          <div style={{ marginTop: 'var(--s3)' }}>
            <PlannedMealCard
              meal={randomSuggestion}
              onAdd={() => addMealToToday(randomSuggestion)}
              onRegenerate={handleGenerateRandom}
              onRemove={() => setPlanState((prev) => ({ ...prev, randomSuggestion: null }))}
              onServingsChange={(value) => setPlanState((prev) => ({ ...prev, randomSuggestion: scaleMeal(prev.randomSuggestion, household, value) }))}
            />
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-heading section-heading-inline">
          <div>
            <div className="section-eyebrow">Semaine</div>
            <div className="section-title">3 repas + 1 collation par jour</div>
          </div>
          <button className="save-btn" style={{ width: 'auto', padding: '10px 14px' }} onClick={handleGenerateWeek} disabled={busyWeek}>
            {busyWeek ? 'Generation...' : 'Generer la semaine'}
          </button>
        </div>

        <div className="seg-tabs" style={{ flexWrap: 'wrap', gap: 4 }}>
          {weekPlan.map((plannedDay, index) => (
            <button
              key={plannedDay.date}
              className={`seg-btn ${selectedDay === index ? 'active' : ''}`}
              onClick={() => setSelectedDay(index)}
              style={{ flex: '1 0 72px' }}
            >
              {formatDateShort(plannedDay.date)}
            </button>
          ))}
        </div>

        {enriching && (
          <div style={{ marginTop: 'var(--s3)', fontSize: 11, color: 'var(--tx-3)' }}>
            Enrichissement OFF en cours pour estimer certains paquets...
          </div>
        )}

        {day && (
          <div style={{ display: 'grid', gap: 'var(--s3)', marginTop: 'var(--s3)' }}>
            {MEAL_SLOTS.map((slot) => (
              <PlannedMealCard
                key={`${day.date}-${slot}`}
                meal={day[slot]}
                onAdd={() => addMealToToday(day[slot])}
                onRegenerate={() => regenerateMeal(selectedDay, slot)}
                onRemove={() => removeMeal(selectedDay, slot)}
                onServingsChange={(value) => changeMealServings(selectedDay, slot, value)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">Courses</div>
            <div className="section-title">Resume a acheter</div>
          </div>
        </div>

        {!shoppingSummary.length && (
          <div className="empty" style={{ padding: 'var(--s5) var(--s4)' }}>
            <div className="empty-txt">Genere une semaine pour obtenir une liste de courses agregee.</div>
          </div>
        )}

        {!!shoppingSummary.length && (
          <div style={{ display: 'grid', gap: 'var(--s2)' }}>
            {shoppingSummary.map((line) => (
              <div key={`${line.name}-${line.unit}`} className="food-item">
                <div className="food-item-info">
                  <div className="food-item-name">{line.name}</div>
                  <div className="food-item-macros">
                    <span>{line.qty} {line.unit}</span>
                    {line.estimatedPacks ? <span>env. {line.estimatedPacks} paquet(s)</span> : null}
                    {line.packLabel ? <span>{line.packLabel}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {feedback && (
        <div className="badge badge-ok" style={{ alignSelf: 'flex-start' }}>
          {feedback}
        </div>
      )}
    </div>
  )
}
