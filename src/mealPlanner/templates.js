export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack']

export const SLOT_LABELS = {
  breakfast: 'Petit-dejeuner',
  lunch: 'Dejeuner',
  dinner: 'Diner',
  snack: 'Collation',
}

export const PORTION_OPTIONS = [0.8, 1, 1.2, 1.5]

export const MEAL_DISTRIBUTION = {
  breakfast: { kcal: 0.24, protein: 0.24, carbs: 0.24, fat: 0.22 },
  lunch: { kcal: 0.31, protein: 0.3, carbs: 0.31, fat: 0.31 },
  dinner: { kcal: 0.33, protein: 0.31, carbs: 0.31, fat: 0.33 },
  snack: { kcal: 0.12, protein: 0.15, carbs: 0.14, fat: 0.14 },
}

export const MEAL_TEMPLATES = [
  {
    id: 'breakfast_skyr_bowl',
    slot: 'breakfast',
    title: 'Bol skyr, flocons et fruits rouges',
    tags: ['fresh', 'protein'],
    perServingMacros: { kcal: 420, protein: 31, carbs: 48, fat: 11 },
    ingredients: [
      { name: 'Skyr nature', qty: 220, unit: 'g', offTerm: 'skyr nature' },
      { name: "Flocons d'avoine", qty: 55, unit: 'g', offTerm: "flocons d'avoine" },
      { name: 'Fruits rouges', qty: 120, unit: 'g' },
      { name: 'Amandes', qty: 15, unit: 'g', offTerm: 'amandes entieres' },
    ],
  },
  {
    id: 'breakfast_eggs_toast',
    slot: 'breakfast',
    title: 'Oeufs brouilles, pain complet et kiwi',
    tags: ['warm', 'family'],
    perServingMacros: { kcal: 450, protein: 27, carbs: 34, fat: 21 },
    ingredients: [
      { name: 'Oeufs', qty: 2, unit: 'unit', offTerm: 'oeufs' },
      { name: 'Pain complet', qty: 90, unit: 'g', offTerm: 'pain complet' },
      { name: 'Kiwi', qty: 2, unit: 'unit' },
      { name: 'Beurre', qty: 8, unit: 'g', offTerm: 'beurre doux' },
    ],
  },
  {
    id: 'breakfast_wrap_cottage',
    slot: 'breakfast',
    title: 'Wrap cottage, dinde et tomate',
    tags: ['portable', 'protein'],
    perServingMacros: { kcal: 390, protein: 29, carbs: 32, fat: 14 },
    ingredients: [
      { name: 'Wrap ble complet', qty: 1, unit: 'unit', offTerm: 'wrap ble complet' },
      { name: 'Fromage cottage', qty: 120, unit: 'g', offTerm: 'fromage cottage' },
      { name: 'Blanc de dinde', qty: 70, unit: 'g', offTerm: 'blanc de dinde tranche' },
      { name: 'Tomate', qty: 80, unit: 'g' },
    ],
  },
  {
    id: 'lunch_chicken_rice',
    slot: 'lunch',
    title: 'Poulet, riz et brocoli',
    tags: ['batch', 'classic'],
    perServingMacros: { kcal: 610, protein: 45, carbs: 62, fat: 18 },
    ingredients: [
      { name: 'Blanc de poulet', qty: 170, unit: 'g' },
      { name: 'Riz cru', qty: 85, unit: 'g', offTerm: 'riz basmati' },
      { name: 'Brocoli', qty: 180, unit: 'g' },
      { name: "Huile d'olive", qty: 12, unit: 'ml', offTerm: "huile d'olive" },
    ],
  },
  {
    id: 'lunch_tuna_pasta',
    slot: 'lunch',
    title: 'Pates au thon et petits pois',
    tags: ['family', 'batch'],
    perServingMacros: { kcal: 590, protein: 39, carbs: 66, fat: 16 },
    ingredients: [
      { name: 'Pates completes crues', qty: 85, unit: 'g', offTerm: 'pates completes' },
      { name: 'Thon au naturel', qty: 110, unit: 'g', offTerm: 'thon naturel boite' },
      { name: 'Petits pois', qty: 100, unit: 'g', offTerm: 'petits pois' },
      { name: 'Coulis de tomate', qty: 140, unit: 'g', offTerm: 'coulis de tomate' },
      { name: "Huile d'olive", qty: 8, unit: 'ml', offTerm: "huile d'olive" },
    ],
  },
  {
    id: 'lunch_quinoa_salmon',
    slot: 'lunch',
    title: 'Quinoa, saumon et courgette',
    tags: ['fresh', 'omega3'],
    perServingMacros: { kcal: 630, protein: 38, carbs: 48, fat: 28 },
    ingredients: [
      { name: 'Saumon', qty: 150, unit: 'g' },
      { name: 'Quinoa cru', qty: 80, unit: 'g', offTerm: 'quinoa' },
      { name: 'Courgette', qty: 180, unit: 'g' },
      { name: 'Citron', qty: 0.5, unit: 'unit' },
      { name: "Huile d'olive", qty: 10, unit: 'ml', offTerm: "huile d'olive" },
    ],
  },
  {
    id: 'dinner_turkey_chili',
    slot: 'dinner',
    title: 'Chili de dinde et haricots rouges',
    tags: ['family', 'batch'],
    perServingMacros: { kcal: 670, protein: 43, carbs: 58, fat: 22 },
    ingredients: [
      { name: 'Dinde hachee', qty: 160, unit: 'g' },
      { name: 'Haricots rouges', qty: 140, unit: 'g', offTerm: 'haricots rouges conserve' },
      { name: 'Mais', qty: 60, unit: 'g', offTerm: 'mais doux' },
      { name: 'Coulis de tomate', qty: 180, unit: 'g', offTerm: 'coulis de tomate' },
      { name: 'Riz cru', qty: 70, unit: 'g', offTerm: 'riz basmati' },
      { name: "Huile d'olive", qty: 8, unit: 'ml', offTerm: "huile d'olive" },
    ],
  },
  {
    id: 'dinner_meatballs_semolina',
    slot: 'dinner',
    title: 'Boulettes, semoule et ratatouille',
    tags: ['family', 'comfort'],
    perServingMacros: { kcal: 680, protein: 37, carbs: 60, fat: 26 },
    ingredients: [
      { name: 'Boulettes de boeuf', qty: 160, unit: 'g', offTerm: 'boulettes de boeuf' },
      { name: 'Semoule crue', qty: 75, unit: 'g', offTerm: 'semoule couscous' },
      { name: 'Ratatouille', qty: 220, unit: 'g', offTerm: 'ratatouille' },
      { name: 'Yaourt grec', qty: 40, unit: 'g', offTerm: 'yaourt grec nature' },
    ],
  },
  {
    id: 'dinner_lentil_curry',
    slot: 'dinner',
    title: 'Curry de lentilles corail et riz',
    tags: ['batch', 'vegetal'],
    perServingMacros: { kcal: 640, protein: 29, carbs: 86, fat: 18 },
    ingredients: [
      { name: 'Lentilles corail', qty: 90, unit: 'g', offTerm: 'lentilles corail' },
      { name: 'Lait de coco leger', qty: 120, unit: 'ml', offTerm: 'lait de coco leger' },
      { name: 'Riz cru', qty: 70, unit: 'g', offTerm: 'riz basmati' },
      { name: 'Carotte', qty: 100, unit: 'g' },
      { name: 'Epinards', qty: 80, unit: 'g', offTerm: 'epinards haches' },
    ],
  },
  {
    id: 'dinner_fajita_bowl',
    slot: 'dinner',
    title: 'Fajita bowl poulet et poivrons',
    tags: ['family', 'colorful'],
    perServingMacros: { kcal: 650, protein: 42, carbs: 55, fat: 24 },
    ingredients: [
      { name: 'Blanc de poulet', qty: 155, unit: 'g' },
      { name: 'Riz cru', qty: 75, unit: 'g', offTerm: 'riz basmati' },
      { name: 'Poivrons', qty: 160, unit: 'g' },
      { name: 'Haricots noirs', qty: 90, unit: 'g', offTerm: 'haricots noirs conserve' },
      { name: 'Yaourt grec', qty: 50, unit: 'g', offTerm: 'yaourt grec nature' },
    ],
  },
  {
    id: 'snack_skyr_banana',
    slot: 'snack',
    title: 'Skyr, banane et riz souffle',
    tags: ['quick', 'protein'],
    perServingMacros: { kcal: 230, protein: 18, carbs: 30, fat: 4 },
    ingredients: [
      { name: 'Skyr nature', qty: 140, unit: 'g', offTerm: 'skyr nature' },
      { name: 'Banane', qty: 1, unit: 'unit' },
      { name: 'Galettes de riz', qty: 3, unit: 'unit', offTerm: 'galettes de riz' },
    ],
  },
  {
    id: 'snack_yogurt_granola',
    slot: 'snack',
    title: 'Yaourt, granola et pomme',
    tags: ['sweet', 'family'],
    perServingMacros: { kcal: 260, protein: 15, carbs: 32, fat: 7 },
    ingredients: [
      { name: 'Yaourt grec', qty: 150, unit: 'g', offTerm: 'yaourt grec nature' },
      { name: 'Granola', qty: 28, unit: 'g', offTerm: 'granola' },
      { name: 'Pomme', qty: 1, unit: 'unit' },
    ],
  },
  {
    id: 'snack_hummus_crackers',
    slot: 'snack',
    title: 'Houmous, crackers et concombre',
    tags: ['savory', 'portable'],
    perServingMacros: { kcal: 240, protein: 11, carbs: 24, fat: 10 },
    ingredients: [
      { name: 'Houmous', qty: 70, unit: 'g', offTerm: 'houmous' },
      { name: 'Crackers complets', qty: 35, unit: 'g', offTerm: 'crackers complets' },
      { name: 'Concombre', qty: 120, unit: 'g' },
    ],
  },
]
