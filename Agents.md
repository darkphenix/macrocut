# AGENTS - COUPURE

Ce document est un contexte de reference pour les prochains agents qui travaillent sur ce repo.
Il resume la vision produit, l etat reel actuel et les regles de modification.

Date de synthese: 2026-03-26 (maj LABO)
Source contexte createur: https://claude.ai/share/f8dc858e-76b2-4ed6-a942-a94b22ba7cfc

## 1) Vision produit

- COUPURE est une PWA mobile-first de suivi nutrition pour perte de poids.
- Positionnement: equivalent "Carbon/MacroFactor-like" en version self-hosted simple.
- Valeur cle: adaptation automatique des targets (TDEE adaptatif) + constance quotidienne.
- Philosophie UX: systeme anti-abandon, pas recherche de perfection.
- Contrainte cle: pas de backend obligatoire, pas de compte, tout doit pouvoir fonctionner en localStorage.

## 2) Historique des decisions

1. Base initiale:
- Vite + React
- Suivi journalier poids + kcal + macros
- Algo TDEE adaptatif et targets auto

2. Extension scanner:
- Scan code-barres via `@zxing/browser`
- Lookup produits via Open Food Facts
- Ajout d aliments au log du jour avec quantite en grammes

3. Extension metabolisme:
- BMR (Mifflin-St Jeor), TDEE base, TDEE adaptatif, target
- Ecrans et explications de la cascade energetique

4. Extension notifications + refonte UI:
- Notifications locales (matin, soir, motivation)
- Service worker + mode PWA installable
- Design system custom (mobile, dense, "industrial precision")

5. Extension habitude anti-abandon:
- Une seule habitude active a la fois
- Check-in: `done` / `minimum` / `missed`
- Graduation a 21 jours, puis reset possible

6. Refonte navigation:
- Onglet `trend` transforme en espace `Insights` avec sous-onglets:
  - `trend`
  - `history`
  - `metabolism`
- Preferences de nav persistees localement

7. Build pipeline:
- Build standard: `dist/`
- Build obfusque: `npm run build:prod` vers `production/` via `javascript-obfuscator`
- Budget bundle: `npm run build:ci`

8. Reouverture experimentale "photo repas":
- Onglet `LABO` ajoute en module isole et lazy-load
- Inference IA en navigateur (client-side) via `@huggingface/transformers`
- Runtime auto WebGPU/WASM + fallback
- Enrichissement nutrition optionnel via Open Food Facts
- Feature desactivable facilement (feature flag env)

## 3) Etat fonctionnel actuel

Onglets exposes dans `src/App.jsx`:
- `today`
- `scanner`
- `labo` (si feature flag active)
- `habit`
- `trend` (Insights)
- `settings`

Sous-navigation Insights:
- `trend` (tendance)
- `history`
- `metabolism`

Ameliorations UX deja en place:
- Actions rapides depuis `Today` vers scanner et historique
- Lazy loading des ecrans lourds
- Preferences d onglets sauvegardees

## 4) Architecture technique

Stack:
- React 18 + Vite
- Recharts
- `@zxing/browser` + `@zxing/library` (scanner code-barres)
- `@huggingface/transformers` (LABO photo IA client-side)
- localStorage pour persistance
- Service worker manuel (`public/sw.js`)

Fichiers coeur:
- `src/App.jsx`: shell, tabs, derivees globales, persistance, routing interne par onglets
- `src/features.js`: feature flags LABO + config env
- `src/algo.js`: BMR, TDEE initial/adaptatif, targets, IMC
- `src/store.js`: settings/logs nutrition
- `src/habitStore.js`: habit unique + streak logic
- `src/notifications.js`: notifications locales + rappel habitude
- `src/labo/vision.js`: pipeline IA image-classification en navigateur
- `src/labo/nutrition.js`: mapping label -> profil macros heuristique
- `src/labo/offSearch.js`: enrichissement Open Food Facts + cache local
- `src/views/*`: UI par module
- `src/styles.css`: design system global

## 5) Contrats de donnees importants

Nutrition settings (`coupure_settings_v2`):
- `startWeight`, `goalWeight`, `weeklyLoss`
- `height`, `age`, `sex`, `activityLevel`
- `proteinPerKg`, `fatPercent`, `manualTDEE`

Nutrition logs (`coupure_logs_v2`):
- `{ date, weight, items[], manual{} }`
- `items[]`: `{ id, name, qty, kcal, protein, carbs, fat }`
- `manual`: `{ kcal, protein, fat, carbs }`
- Totaux calcules via `logTotals(log)` (source de verite macros/kcal)
- LABO n introduit pas de nouveau schema: il ajoute des `items[]` compatibles.

Habit data:
- `coupure_habit_v1`: definition habitude active
- `coupure_hlog_v1`: logs quotidiens `{ date, status, ts }`

Notifications:
- `coupure_notif_v1`: activation + horaires + derniers envois

UI preferences:
- `coupure_tab_v1`: dernier onglet actif
- `coupure_insight_tab_v1`: dernier sous-onglet Insights actif

Caches:
- `coupure_off_cache_v1`: cache Open Food Facts du scanner code-barres
- `coupure_labo_off_cache_v1`: cache Open Food Facts du LABO (search texte)

Feature flags env:
- `VITE_ENABLE_LABO`
- `VITE_LABO_MODEL_ID`
- `VITE_LABO_TOPK`

## 6) Regles de modification recommandees

- Preserver mobile-first (max-width 480, nav basse, safe areas).
- Preserver le ton produit en francais.
- Eviter les features qui imposent un backend sans besoin explicite.
- Garder l experience offline/PWA utilisable.
- Si la structure des logs change, fournir migration ou fallback defensif.
- Garder LABO isole: aucun couplage fort avec le coeur nutrition.
- Toute feature experimentale doit etre desactivable via flag.
- Toujours verifier `npm run build` apres modifs significatives.
- Si impact bundle, verifier aussi `npm run build:ci`.

## 7) Points d attention connus (tech debt)

- Precision photo repas: la reconnaissance visuelle seule reste incertaine sur les portions.
  - LABO doit rester "assistant", pas "source de verite".
- Dependance Open Food Facts:
  - disponibilite variable et limites de requetes possibles.
  - conserver cache local + fallback defensif.
- Poids bundle LABO:
  - charge modele ONNX/WASM important.
  - garder le module derriere lazy-load + feature flag.
- Avertissement Vite chunks > 500KB present sur les chunks IA/scanner (non bloquant, mais a surveiller).

## 8) Definition de "done" pour une future feature

Pour etre "done", une evolution doit:
1. Respecter la vision (constance + simplicite + usage quotidien).
2. Ne pas casser les donnees locales existantes.
3. Garder une UI lisible sur mobile.
4. Passer `npm run build`.
5. Etre documentee si elle modifie un contrat de donnees.
6. Pouvoir etre coupee facilement si experimentale (flag ou toggle explicite).
