# MacroCut â€” Nutrition Tracker PWA

Tracker de perte de poids avec TDEE adaptatif (style MacroFactor / Carbon).

## Stack

- **Vite** + **React 18**
- **Recharts** pour les graphiques
- **localStorage** pour la persistance (cÃ´tÃ© client)
- PWA installable (manifest + service worker)

## Lancer en local / sur le Pi

```bash
npm install
npm run dev         # dev â†’ http://localhost:5173
npm run build       # build â†’ dist/
npm run build:prod  # build obfusque -> production/
npm run build:ci    # build + controle budget bundle
npm run preview     # preview â†’ http://localhost:8790
```

Pour servir le build sur nginx (Pi) :

```nginx
server {
    listen 8792;
    root /chemin/vers/production;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
```

## IcÃ´nes PWA

Ajouter dans `public/` :
- `icon-192.png` â€” 192Ã—192 px
- `icon-512.png` â€” 512Ã—512 px

## Algorithme TDEE adaptatif

```
TDEE_estimÃ© = avg_kcal_7j - (Î”poids_hebdo Ã— 7700 Ã· 7)
```

- Se calcule Ã  partir de **14 jours** de logs poids + kcal
- Badge "TDEE adaptÃ©" affichÃ© quand â‰¥70% des 7 derniers jours sont loggÃ©s
- Jusqu'Ã  14 jours : TDEE initial des rÃ©glages utilisÃ©

## Structure

```
src/
  algo.js         TDEE algorithm, rolling avg, macros computation
  store.js        localStorage load/save + helpers date
  styles.css      Design system complet (CSS variables, dark theme)
  App.jsx         Shell + state global
  views/
    Today.jsx     Saisie quotidienne + ring kcal + macro bars
    Trend.jsx     Graphiques poids + kcal (30j) + stats
    History.jsx   Historique des entrÃ©es
    Settings.jsx  Configuration
```

## LABO (photo IA) - feature flag

Le module LABO est isole dans son propre onglet et charge en lazy-load.
Par defaut:
- actif en `npm run dev`
- desactive en `npm run build` (production)

- Activer/desactiver rapidement:
  - `VITE_ENABLE_LABO=1` (actif)
  - `VITE_ENABLE_LABO=0` (desactive)
- Choisir le modele:
  - `VITE_LABO_MODEL_ID=onnx-community/swin-finetuned-food101-ONNX`
- Nombre de predictions:
  - `VITE_LABO_TOPK=5`

Exemple:

```bash
# Windows PowerShell
$env:VITE_ENABLE_LABO='0'; npm run dev
```

