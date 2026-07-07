// ---------- LOTUS PLATE JOURNAL ----------
// Off-shift wellness reflection system. Fully separate from stamina/shift time,
// Clinical Cue, AP, battle cards, Care Chain, Clinical Arts, and combat grading.
// Never gates or grants combat power — only cosmetics, education, and light
// kingdom flavor (Nutrition Garden).

export type PlateCategory = 'protein' | 'carb' | 'veg_fruit_fiber' | 'fat_flavor' | 'drink' | 'treat';

export interface FoodTile {
  id: string;
  label: string;
  category: PlateCategory;
  emoji: string;
}

export const PLATE_CATEGORY_LABEL: Record<PlateCategory, string> = {
  protein: 'Protein',
  carb: 'Carb / Energy',
  veg_fruit_fiber: 'Vegetable / Fruit / Fiber',
  fat_flavor: 'Fat / Flavor',
  drink: 'Drink',
  treat: 'Treat / Optional',
};

export const FOOD_TILES: FoodTile[] = [
  { id: 'eggs', label: 'Eggs', category: 'protein', emoji: '🥚' },
  { id: 'chicken', label: 'Chicken', category: 'protein', emoji: '🍗' },
  { id: 'fish', label: 'Fish', category: 'protein', emoji: '🐟' },
  { id: 'tofu', label: 'Tofu', category: 'protein', emoji: '🧊' },
  { id: 'beans', label: 'Beans', category: 'protein', emoji: '🫘' },
  { id: 'rice', label: 'Rice', category: 'carb', emoji: '🍚' },
  { id: 'noodles', label: 'Noodles', category: 'carb', emoji: '🍜' },
  { id: 'bread', label: 'Bread', category: 'carb', emoji: '🍞' },
  { id: 'potatoes', label: 'Potatoes', category: 'carb', emoji: '🥔' },
  { id: 'vegetables', label: 'Vegetables', category: 'veg_fruit_fiber', emoji: '🥦' },
  { id: 'fruit', label: 'Fruit', category: 'veg_fruit_fiber', emoji: '🍎' },
  { id: 'nuts', label: 'Nuts', category: 'fat_flavor', emoji: '🥜' },
  { id: 'avocado', label: 'Avocado', category: 'fat_flavor', emoji: '🥑' },
  { id: 'sauce', label: 'Sauce', category: 'fat_flavor', emoji: '🥫' },
  { id: 'water', label: 'Water', category: 'drink', emoji: '💧' },
  { id: 'tea', label: 'Tea', category: 'drink', emoji: '🍵' },
  { id: 'coffee', label: 'Coffee', category: 'drink', emoji: '☕' },
  { id: 'soda', label: 'Soda', category: 'drink', emoji: '🥤' },
  { id: 'dessert', label: 'Dessert', category: 'treat', emoji: '🍰' },
  { id: 'fried_food', label: 'Fried Food', category: 'treat', emoji: '🍟' },
];

export const FOOD_TILES_BY_CATEGORY: Record<PlateCategory, FoodTile[]> = {
  protein: FOOD_TILES.filter((t) => t.category === 'protein'),
  carb: FOOD_TILES.filter((t) => t.category === 'carb'),
  veg_fruit_fiber: FOOD_TILES.filter((t) => t.category === 'veg_fruit_fiber'),
  fat_flavor: FOOD_TILES.filter((t) => t.category === 'fat_flavor'),
  drink: FOOD_TILES.filter((t) => t.category === 'drink'),
  treat: FOOD_TILES.filter((t) => t.category === 'treat'),
};

export const HEALTHY_DRINK_IDS = ['water', 'tea'];

// ---------- Recipes ----------
export type RecipeGoal =
  | 'steady_energy' | 'high_protein' | 'budget_meal' | 'quick_meal' | 'heart_friendly'
  | 'blood_sugar_aware' | 'vegetarian' | 'family_meal' | 'post_workout'
  | 'hydrating_snack' | 'higher_fiber' | 'lower_sodium';

export const RECIPE_GOAL_LABEL: Record<RecipeGoal, string> = {
  steady_energy: 'Steady Energy',
  high_protein: 'High Protein',
  budget_meal: 'Budget Meal',
  quick_meal: 'Quick Meal',
  heart_friendly: 'Heart-Friendly',
  blood_sugar_aware: 'Blood Sugar Aware',
  vegetarian: 'Vegetarian',
  family_meal: 'Family Meal',
  post_workout: 'Post-Workout',
  hydrating_snack: 'Hydrating Snack',
  higher_fiber: 'Higher Fiber',
  lower_sodium: 'Lower Sodium',
};

export interface Recipe {
  id: string;
  name: string;
  goals: RecipeGoal[];
  ingredients: string[];
  portionGuide: string;
  why: string;
  rewardPetals: number;
}

export const RECIPES: Recipe[] = [
  {
    id: 'veggie_egg_scramble',
    name: 'Veggie Egg Scramble',
    goals: ['high_protein', 'quick_meal', 'vegetarian', 'blood_sugar_aware'],
    ingredients: ['Eggs', 'Spinach', 'Tomato', 'Olive oil', 'Whole-grain toast'],
    portionGuide: 'Protein = 1 palm of eggs · Vegetables = 1–2 fists · Carb = 1 fist of toast',
    why: 'Protein and fiber together help mornings feel steadier, without a quick sugar spike.',
    rewardPetals: 6,
  },
  {
    id: 'chicken_rice_bowl',
    name: 'Chicken & Rice Bowl',
    goals: ['high_protein', 'family_meal', 'budget_meal', 'steady_energy'],
    ingredients: ['Chicken breast', 'Brown rice', 'Mixed vegetables', 'Low-sodium soy sauce'],
    portionGuide: 'Protein = 1 palm · Carb = 1 fist · Vegetables = 1–2 fists · Sauce = 1 thumb',
    why: 'A simple, budget-friendly plate that balances protein, energy, and fiber in one bowl.',
    rewardPetals: 6,
  },
  {
    id: 'bean_veggie_tacos',
    name: 'Bean & Veggie Tacos',
    goals: ['vegetarian', 'higher_fiber', 'budget_meal', 'family_meal'],
    ingredients: ['Black beans', 'Corn tortillas', 'Lettuce', 'Salsa', 'Avocado'],
    portionGuide: 'Protein/fiber = 1 fist of beans · Carb = 2 small tortillas · Fat = 1 thumb avocado',
    why: 'Beans bring both plant protein and fiber, which supports steady, longer-lasting energy.',
    rewardPetals: 6,
  },
  {
    id: 'salmon_sweet_potato',
    name: 'Salmon & Sweet Potato',
    goals: ['heart_friendly', 'post_workout', 'high_protein'],
    ingredients: ['Salmon', 'Sweet potato', 'Broccoli', 'Lemon'],
    portionGuide: 'Protein = 1 palm · Carb = 1 fist sweet potato · Vegetables = 1–2 fists',
    why: 'A heart-friendly plate that pairs protein with fiber-rich carbs for recovery and steady energy.',
    rewardPetals: 6,
  },
  {
    id: 'greek_yogurt_fruit_bowl',
    name: 'Greek Yogurt Fruit Bowl',
    goals: ['quick_meal', 'hydrating_snack', 'blood_sugar_aware'],
    ingredients: ['Greek yogurt', 'Berries', 'Nuts', 'A light honey drizzle (optional)'],
    portionGuide: 'Protein = 1 palm yogurt · Fruit = 1 fist · Fat = 1 thumb of nuts',
    why: 'Protein plus fruit helps smooth out energy compared to fruit or sugar alone.',
    rewardPetals: 6,
  },
  {
    id: 'lentil_veggie_soup',
    name: 'Lentil Veggie Soup',
    goals: ['higher_fiber', 'lower_sodium', 'budget_meal', 'vegetarian'],
    ingredients: ['Lentils', 'Carrots', 'Celery', 'Low-sodium broth', 'Herbs'],
    portionGuide: 'Protein/fiber = 1–1.5 fists lentils · Vegetables = 1 fist · Broth = as needed',
    why: 'A low-sodium, high-fiber option that is easy on the wallet and gentle on the body.',
    rewardPetals: 6,
  },
  {
    id: 'turkey_lettuce_wraps',
    name: 'Turkey Lettuce Wraps',
    goals: ['lower_sodium', 'high_protein', 'quick_meal'],
    ingredients: ['Ground turkey', 'Lettuce leaves', 'Bell pepper', 'Low-sodium seasoning'],
    portionGuide: 'Protein = 1 palm · Vegetables = 1 fist · Wrap = lettuce leaves instead of bread',
    why: 'Swapping bread for lettuce is a simple, sodium-aware way to lighten a meal without losing protein.',
    rewardPetals: 6,
  },
  {
    id: 'overnight_oats',
    name: 'Overnight Oats',
    goals: ['steady_energy', 'higher_fiber', 'quick_meal', 'budget_meal'],
    ingredients: ['Oats', 'Milk or plant milk', 'Chia seeds', 'Fruit'],
    portionGuide: 'Carb/fiber = 1 fist oats · Fruit = 1 fist · Fat = 1 thumb chia seeds',
    why: 'Fiber-rich oats digest slowly, which supports steadier energy through the morning.',
    rewardPetals: 6,
  },
  {
    id: 'tofu_veggie_stir_fry',
    name: 'Tofu Veggie Stir-Fry',
    goals: ['vegetarian', 'heart_friendly', 'higher_fiber'],
    ingredients: ['Tofu', 'Mixed vegetables', 'Garlic', 'Low-sodium sauce', 'Brown rice'],
    portionGuide: 'Protein = 1 palm tofu · Vegetables = 1–2 fists · Carb = 1 fist rice',
    why: 'Plant protein plus lots of vegetables makes a heart-friendly, fiber-rich plate.',
    rewardPetals: 6,
  },
  {
    id: 'post_workout_smoothie',
    name: 'Post-Workout Smoothie',
    goals: ['post_workout', 'hydrating_snack', 'high_protein'],
    ingredients: ['Greek yogurt or protein powder', 'Banana', 'Spinach', 'Water or milk'],
    portionGuide: 'Protein = 1 palm equivalent · Fruit = 1 fist · Liquid = enough to blend smooth',
    why: 'Protein plus fluids after activity supports recovery and rehydration together.',
    rewardPetals: 6,
  },
];

// ---------- Optional lessons ----------
export interface WellnessLesson {
  id: string;
  title: string;
  body: string[];
  rewardPetals: number;
}

export const WELLNESS_LESSONS: WellnessLesson[] = [
  {
    id: 'calories_energy',
    title: 'What Are Calories, Really?',
    body: [
      'Calories are just energy — the fuel your body uses to breathe, move, think, and heal.',
      'The goal isn\u2019t always "fewer calories." It\u2019s matching your food energy to your body, activity, and health needs.',
      'Too little fuel can mean low energy. Balanced fuel (protein + fiber + some carbs) tends to mean steady energy.',
      'Meals that are mostly quick sugar without protein or fiber can give a quick spike — and sometimes a crash after.',
    ],
    rewardPetals: 8,
  },
  {
    id: 'fiber_basics',
    title: 'Why Fiber Helps',
    body: [
      'Fiber comes from plants — vegetables, fruit, beans, and whole grains.',
      'It slows digestion, which supports steadier energy and helps you feel fuller, longer.',
      'You don\u2019t need to count grams — just aim to add one fiber-rich food to most meals when you can.',
    ],
    rewardPetals: 8,
  },
];

// ---------- Wellness state ----------
export interface WellnessGarden {
  hydration: number; // Hydration Well
  fiber: number;      // Fiber Vines
  protein: number;    // Training Kitchen
  heart: number;       // Heart Lantern
}

export interface WellnessDailyState {
  date: string;
  gems_earned: number;
  signatures: string[];
}

export interface WellnessWeeklyState {
  week_key: string;
  gems_earned: number;
}

export interface WellnessState {
  nourishment_petals: number;
  // Named to match economy.ts: wellness milestones earn Insight Crystals,
  // never Lotus Gems (the paid currency) — see materials.ts wellness_badges note.
  insight_crystals_earned: number;
  garden: WellnessGarden;
  lessons_completed: string[];
  logs_completed: number;
  daily: WellnessDailyState;
  weekly: WellnessWeeklyState;
}

export const DAILY_INSIGHT_CAP = 3;
export const WEEKLY_INSIGHT_CAP = 12; // placeholder, ~10-15/week

const PETALS_BASE = 4;
const PETALS_PER_CATEGORY = 2;
const PETALS_HYDRATION = 4;
const PETALS_CHECKIN = 5;
const PETALS_RECIPE = 6;

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return `${date.getUTCFullYear()}-W${week}`;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function defaultWellnessState(now: Date = new Date()): WellnessState {
  return {
    nourishment_petals: 0,
    insight_crystals_earned: 0,
    garden: { hydration: 0, fiber: 0, protein: 0, heart: 0 },
    lessons_completed: [],
    logs_completed: 0,
    daily: { date: dateKey(now), gems_earned: 0, signatures: [] },
    weekly: { week_key: weekKey(now), gems_earned: 0 },
  };
}

export type WellnessLogType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'hydration' | 'checkin' | 'recipe' | 'lesson';

export interface WellnessLogInput {
  type: WellnessLogType;
  tileIds?: string[];
  drinkChoice?: string;
  habits?: string[];
  recipeId?: string;
  lessonId?: string;
}

export interface WellnessFeedback {
  rating: string;
  strengths: string[];
  suggestion: string;
  explanation: string;
}

export interface WellnessResult {
  feedback: WellnessFeedback;
  petalsEarned: number;
  gemAwarded: boolean;
  gemCapped: boolean;
  nextWellness: WellnessState;
}

const HABIT_LABEL: Record<string, string> = {
  sleep: 'Sleep support',
  movement: 'Movement',
  stress_reset: 'Stress reset',
  hydration: 'Hydration support',
};

export function resolveWellnessLog(input: WellnessLogInput, wellness: WellnessState, now: Date = new Date()): WellnessResult {
  const today = dateKey(now);
  const week = weekKey(now);
  const daily: WellnessDailyState = wellness.daily.date === today ? wellness.daily : { date: today, gems_earned: 0, signatures: [] };
  const weekly: WellnessWeeklyState = wellness.weekly.week_key === week ? wellness.weekly : { week_key: week, gems_earned: 0 };

  let categories: PlateCategory[] = [];
  if (input.tileIds?.length) {
    const set = new Set<PlateCategory>();
    for (const id of input.tileIds) {
      const tile = FOOD_TILES.find((t) => t.id === id);
      if (tile) set.add(tile.category);
    }
    categories = Array.from(set);
  }

  let feedback: WellnessFeedback;
  let petals = 0;
  let meaningful = false;
  let gardenDelta: Partial<WellnessGarden> = {};
  let signature = '';
  let lessonAlreadyDone = false;

  if (input.type === 'hydration') {
    const choice = input.drinkChoice || 'water';
    meaningful = true;
    petals = PETALS_HYDRATION;
    gardenDelta = { hydration: 10 };
    signature = `hydration:${choice}:${today}`;
    feedback = {
      rating: 'Hydration Logged',
      strengths: ['Hydration support'],
      suggestion: choice === 'soda'
        ? 'Try pairing soda with a glass of water too — every bit of hydration helps.'
        : 'Keep sipping water throughout the day to support steady energy.',
      explanation: 'Water helps your body regulate temperature, digestion, and energy — small sips throughout the day add up.',
    };
  } else if (input.type === 'checkin') {
    const habits = input.habits || [];
    meaningful = habits.length > 0;
    petals = PETALS_CHECKIN;
    gardenDelta = { heart: 4 };
    signature = `checkin:${[...habits].sort().join(',')}:${today}`;
    feedback = {
      rating: meaningful ? 'Check-In Complete' : 'Check-In Noted',
      strengths: meaningful ? habits.map((h) => HABIT_LABEL[h] || h) : ['You checked in — that counts!'],
      suggestion: habits.includes('sleep')
        ? 'A consistent bedtime supports steady energy and mood the next day.'
        : 'Small stress resets — a short walk, stretching, or a few slow breaths — add up over time.',
      explanation: 'Sleep, movement, and stress resets support your body the same way food does — steady habits build steady energy.',
    };
  } else if (input.type === 'recipe') {
    meaningful = true;
    petals = PETALS_RECIPE;
    gardenDelta = { fiber: 3, protein: 3 };
    signature = `recipe:${input.recipeId}:${today}`;
    feedback = {
      rating: 'Recipe Tried',
      strengths: ['Learning + trying something new'],
      suggestion: 'Next time, try pairing it with a fiber-rich side for extra staying power.',
      explanation: 'Trying new balanced recipes builds a bigger toolkit of easy, steady-energy meals.',
    };
  } else if (input.type === 'lesson') {
    lessonAlreadyDone = !!input.lessonId && wellness.lessons_completed.includes(input.lessonId);
    const lesson = WELLNESS_LESSONS.find((l) => l.id === input.lessonId);
    meaningful = !lessonAlreadyDone;
    petals = lessonAlreadyDone ? 0 : (lesson?.rewardPetals ?? 8);
    signature = `lesson:${input.lessonId}`;
    feedback = {
      rating: lessonAlreadyDone ? 'Already Learned' : 'Lesson Complete',
      strengths: lessonAlreadyDone ? ['Nice refresher!'] : ['Nutrition knowledge +1'],
      suggestion: 'Revisit lessons anytime — small science reminders make choices feel easier.',
      explanation: 'Understanding the "why" behind wellness habits makes them easier to keep up.',
    };
  } else {
    // Meal: breakfast / lunch / dinner / snack
    const hasProtein = categories.includes('protein');
    const hasCarb = categories.includes('carb');
    const hasFiber = categories.includes('veg_fruit_fiber');
    const hasFlavor = categories.includes('fat_flavor');
    const hasHealthyDrink = (input.tileIds || []).some((id) => HEALTHY_DRINK_IDS.includes(id));
    const hasTreatOnly = categories.length > 0 && categories.every((c) => c === 'treat' || c === 'drink');

    meaningful = categories.length >= 2;
    petals = Math.min(20, PETALS_BASE + categories.length * PETALS_PER_CATEGORY);
    gardenDelta = {
      ...(hasProtein ? { protein: 6 } : {}),
      ...(hasFiber ? { fiber: 6 } : {}),
      ...(hasHealthyDrink ? { hydration: 6 } : {}),
      ...(hasProtein && hasFiber && !categories.includes('treat') ? { heart: 4 } : {}),
    };

    const strengths: string[] = [];
    if (hasProtein) strengths.push('Protein support');
    if (hasFiber) strengths.push('Fiber boost');
    if (hasCarb) strengths.push('Steady energy');
    if (hasHealthyDrink) strengths.push('Hydration support');
    if (hasFlavor) strengths.push('Flavor + healthy fats');
    if (strengths.length === 0) strengths.push('You showed up to reflect — that counts!');

    let suggestion: string;
    if (!hasFiber) suggestion = 'Next time, try adding vegetables, fruit, beans, or whole grains for a fiber boost.';
    else if (!hasProtein) suggestion = 'Adding a protein source like eggs, beans, fish, or tofu can help you feel fuller, longer.';
    else if (!hasHealthyDrink) suggestion = 'A glass of water or unsweetened tea alongside your meal supports hydration.';
    else if (!hasCarb) suggestion = 'A small energy source like rice, bread, or potatoes can help sustain your energy.';
    else suggestion = 'Great balance — keep mixing up your choices for variety over time.';

    const rating = hasProtein && hasFiber && (hasCarb || hasHealthyDrink)
      ? 'Balanced Plate'
      : categories.length >= 2
        ? 'Getting Started'
        : hasTreatOnly
          ? 'Quick Bite'
          : 'Logged';

    signature = `${input.type}:${categories.slice().sort().join(',')}`;

    feedback = {
      rating,
      strengths,
      suggestion,
      explanation: 'Protein helps you feel full, fiber supports steady energy, and fluids support hydration — small additions add up over time.',
    };
  }

  const alreadyCredited = daily.signatures.includes(signature);
  const dailyRoom = daily.gems_earned < DAILY_INSIGHT_CAP;
  const weeklyRoom = weekly.gems_earned < WEEKLY_INSIGHT_CAP;
  const gemAwarded = meaningful && dailyRoom && weeklyRoom && !alreadyCredited;
  const gemCapped = meaningful && !gemAwarded;

  const nextDaily: WellnessDailyState = gemAwarded
    ? { date: today, gems_earned: daily.gems_earned + 1, signatures: [...daily.signatures, signature] }
    : daily;
  const nextWeekly: WellnessWeeklyState = gemAwarded
    ? { week_key: week, gems_earned: weekly.gems_earned + 1 }
    : weekly;

  const nextGarden: WellnessGarden = {
    hydration: clamp100(wellness.garden.hydration + (gardenDelta.hydration || 0)),
    fiber: clamp100(wellness.garden.fiber + (gardenDelta.fiber || 0)),
    protein: clamp100(wellness.garden.protein + (gardenDelta.protein || 0)),
    heart: clamp100(wellness.garden.heart + (gardenDelta.heart || 0)),
  };

  const nextLessons = input.type === 'lesson' && input.lessonId && !lessonAlreadyDone
    ? [...wellness.lessons_completed, input.lessonId]
    : wellness.lessons_completed;

  const nextWellness: WellnessState = {
    nourishment_petals: wellness.nourishment_petals + petals,
    insight_crystals_earned: wellness.insight_crystals_earned + (gemAwarded ? 1 : 0),
    garden: nextGarden,
    lessons_completed: nextLessons,
    logs_completed: wellness.logs_completed + 1,
    daily: nextDaily,
    weekly: nextWeekly,
  };

  return { feedback, petalsEarned: petals, gemAwarded, gemCapped, nextWellness };
}
