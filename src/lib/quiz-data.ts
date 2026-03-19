/**
 * Quiz Data — 6 Aerial Tarot Archetypes. Which Are You?
 *
 * Version: v2 (2026-03-19)
 * Source: operations/mastermind-quiz-design-overhaul/approved-questions.md
 *
 * Quiz v2 changes from v1:
 *   - 20 questions → 12 (2 segmentation + 10 scored)
 *   - `scored: boolean` → `phase: 'scored' | 'segmentation'`
 *   - Added `format: QuestionFormat` ('single_select' | 'forced_pair')
 *   - Added `pair: [Dimension, Dimension] | null`
 *   - Variable weighting: +3, +4, +6 tiers (was flat +4)
 *   - Forced pairs: +6/+2 dual-dimension scoring
 *   - New ID convention: NQ01-NQ07, FP01-FP03, SEG1-SEG2
 */

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type Dimension = 'A' | 'B' | 'C' | 'D';

export type QuestionFormat = 'single_select' | 'forced_pair';

export interface ScoringWeight {
  dimension: Dimension;
  points: number;
}

export interface Answer {
  id: string;
  text: string;
  scoring: ScoringWeight[];
}

export interface Question {
  id: string;
  number: number;
  text: string;
  answers: Answer[];
  format: QuestionFormat;
  phase: 'scored' | 'segmentation';
  pair: [Dimension, Dimension] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produces a single-dimension scoring weight. */
function w(dimension: Dimension, points: number): ScoringWeight {
  return { dimension, points };
}

// ---------------------------------------------------------------------------
// Question data
// ---------------------------------------------------------------------------

export const questions: Question[] = [
  // -------------------------------------------------------------------------
  // SEG1 — Tarot experience level (segmentation, not scored)
  // -------------------------------------------------------------------------
  {
    id: 'SEG1',
    number: 1,
    text: "When it comes to tarot, I'd describe myself as:",
    format: 'single_select',
    phase: 'segmentation',
    pair: null,
    answers: [
      {
        id: 'SEG1-A',
        text: 'Curious, but just beginning.',
        scoring: [],
      },
      {
        id: 'SEG1-B',
        text: 'Practicing, but still building confidence.',
        scoring: [],
      },
      {
        id: 'SEG1-C',
        text: 'Experienced, but looking to deepen.',
        scoring: [],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // SEG2 — Pain point segmentation (not scored)
  // -------------------------------------------------------------------------
  {
    id: 'SEG2',
    number: 2,
    text: "What's been your biggest frustration with tarot so far?",
    format: 'single_select',
    phase: 'segmentation',
    pair: null,
    answers: [
      {
        id: 'SEG2-A',
        text: 'Too many cards to memorize.',
        scoring: [],
      },
      {
        id: 'SEG2-B',
        text: 'Court cards all seem the same.',
        scoring: [],
      },
      {
        id: 'SEG2-C',
        text: "Decks I've tried feel cheap or hard to use.",
        scoring: [],
      },
      {
        id: 'SEG2-D',
        text: "I can't read objectively for myself.",
        scoring: [],
      },
      {
        id: 'SEG2-E',
        text: "I haven't found a deck that reflects who I am.",
        scoring: [],
      },
      {
        id: 'SEG2-F',
        text: 'No frustrations yet!',
        scoring: [],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // NQ01 — Weight: +4 (standard) — Adapted from Q1
  // -------------------------------------------------------------------------
  {
    id: 'NQ01',
    number: 3,
    text: "You're awake at 2am with something weighing on you. What actually helps?",
    format: 'single_select',
    phase: 'scored',
    pair: null,
    answers: [
      {
        id: 'NQ01-A',
        text: 'Making a list, researching options, or thinking it through logically.',
        scoring: [w('A', 4)],
      },
      {
        id: 'NQ01-B',
        text: 'Getting out of bed — walking, stretching, doing something physical.',
        scoring: [w('B', 4)],
      },
      {
        id: 'NQ01-C',
        text: 'Letting it go for now, trusting morning will bring clarity.',
        scoring: [w('C', 4)],
      },
      {
        id: 'NQ01-D',
        text: 'Sitting with the discomfort, asking what this situation is really trying to show you.',
        scoring: [w('D', 4)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // NQ02 — Weight: +4 (standard) — Adapted from Q9
  // -------------------------------------------------------------------------
  {
    id: 'NQ02',
    number: 4,
    text: 'Imagine watching someone perform something remarkable. What captivates you most?',
    format: 'single_select',
    phase: 'scored',
    pair: null,
    answers: [
      {
        id: 'NQ02-A',
        text: 'The precision — every movement intentional, nothing wasted.',
        scoring: [w('A', 4)],
      },
      {
        id: 'NQ02-B',
        text: "The physicality — you can almost feel what they're feeling in your own body.",
        scoring: [w('B', 4)],
      },
      {
        id: 'NQ02-C',
        text: 'The flow — that effortless quality where everything just... works.',
        scoring: [w('C', 4)],
      },
      {
        id: 'NQ02-D',
        text: 'The transformation — watching them become something different than when they started.',
        scoring: [w('D', 4)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // FP01 — Pair: A vs D (Grounded Mystic boundary) — forced pair
  // -------------------------------------------------------------------------
  {
    id: 'FP01',
    number: 5,
    text: "When you encounter something you can't explain — a coincidence that feels meaningful, a dream that lingers:",
    format: 'forced_pair',
    phase: 'scored',
    pair: ['A', 'D'],
    answers: [
      {
        id: 'FP01-A',
        text: "You look for the pattern. There's a logic underneath, even if it's not obvious yet — and you want to find it.",
        scoring: [w('A', 6), w('D', 2)],
      },
      {
        id: 'FP01-D',
        text: "You follow it deeper. Whatever this is, it's pointing at something you haven't been willing to look at yet.",
        scoring: [w('D', 6), w('A', 2)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // NQ03 — Weight: +6 (ANCHOR) — Adapted from Q15
  // -------------------------------------------------------------------------
  {
    id: 'NQ03',
    number: 6,
    text: 'You feel most alive when:',
    format: 'single_select',
    phase: 'scored',
    pair: null,
    answers: [
      {
        id: 'NQ03-A',
        text: "Mastering something complex or solving a problem others couldn't.",
        scoring: [w('A', 6)],
      },
      {
        id: 'NQ03-B',
        text: 'Fully in your body — present, physical, sensation-aware.',
        scoring: [w('B', 6)],
      },
      {
        id: 'NQ03-C',
        text: 'In creative flow, following curiosity wherever it leads.',
        scoring: [w('C', 6)],
      },
      {
        id: 'NQ03-D',
        text: "Going through meaningful change, even when it's uncomfortable.",
        scoring: [w('D', 6)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // NQ04 — Weight: +4 (standard) — Adapted from Q6
  // -------------------------------------------------------------------------
  {
    id: 'NQ04',
    number: 7,
    text: 'Which feels most true for you?',
    format: 'single_select',
    phase: 'scored',
    pair: null,
    answers: [
      {
        id: 'NQ04-A',
        text: '"I need to understand how something works before I can trust it."',
        scoring: [w('A', 4)],
      },
      {
        id: 'NQ04-B',
        text: '"My body knows things my mind hasn\'t figured out yet."',
        scoring: [w('B', 4)],
      },
      {
        id: 'NQ04-C',
        text: '"The best insights come when I stop trying to force them."',
        scoring: [w('C', 4)],
      },
      {
        id: 'NQ04-D',
        text: '"Growth happens in the uncomfortable places most people avoid."',
        scoring: [w('D', 4)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // FP02 — Pair: B vs C (Flow Artist boundary) — forced pair
  // -------------------------------------------------------------------------
  {
    id: 'FP02',
    number: 8,
    text: "You're offered two experiences at a retreat. Which draws you in?",
    format: 'forced_pair',
    phase: 'scored',
    pair: ['B', 'C'],
    answers: [
      {
        id: 'FP02-B',
        text: 'A movement practice with no choreography — just your body, music, and whatever wants to happen.',
        scoring: [w('B', 6), w('C', 2)],
      },
      {
        id: 'FP02-C',
        text: 'A silent sit in nature — no agenda, no timer, just presence and whatever arises.',
        scoring: [w('C', 6), w('B', 2)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // NQ05 — Weight: +3 (lighter) — Adapted from Q12
  // -------------------------------------------------------------------------
  {
    id: 'NQ05',
    number: 9,
    text: "What tends to derail you when you're trying to grow or learn?",
    format: 'single_select',
    phase: 'scored',
    pair: null,
    answers: [
      {
        id: 'NQ05-A',
        text: 'Too much conflicting information — hard to know what\'s actually reliable.',
        scoring: [w('A', 3)],
      },
      {
        id: 'NQ05-B',
        text: 'Losing momentum when life gets busy or practice feels abstract.',
        scoring: [w('B', 3)],
      },
      {
        id: 'NQ05-C',
        text: 'Worrying I\'m "doing it wrong" or not making progress fast enough.',
        scoring: [w('C', 3)],
      },
      {
        id: 'NQ05-D',
        text: 'Either going too deep too fast, or avoiding the shadow stuff entirely.',
        scoring: [w('D', 3)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // NQ06 — Weight: +6 (ANCHOR) — Adapted from Q16
  // -------------------------------------------------------------------------
  {
    id: 'NQ06',
    number: 10,
    text: '"Defying gravity" makes you think of:',
    format: 'single_select',
    phase: 'scored',
    pair: null,
    answers: [
      {
        id: 'NQ06-A',
        text: 'Achieving something that seemed impossible through skill and effort.',
        scoring: [w('A', 6)],
      },
      {
        id: 'NQ06-B',
        text: 'The physical thrill of movement, lift, suspension.',
        scoring: [w('B', 6)],
      },
      {
        id: 'NQ06-C',
        text: "Letting go of what's weighing you down.",
        scoring: [w('C', 6)],
      },
      {
        id: 'NQ06-D',
        text: "Transcending old patterns — becoming who you're meant to be.",
        scoring: [w('D', 6)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // FP03 — Pair: B vs D (flexible boundary) — forced pair
  // -------------------------------------------------------------------------
  {
    id: 'FP03',
    number: 11,
    text: "When something feels off but you can't name why:",
    format: 'forced_pair',
    phase: 'scored',
    pair: ['B', 'D'],
    answers: [
      {
        id: 'FP03-B',
        text: 'You tune into your body — tension, breath, gut feeling. It knows before your mind catches up.',
        scoring: [w('B', 6), w('D', 2)],
      },
      {
        id: 'FP03-D',
        text: "You sit with the discomfort and ask what it's trying to show you. There's always something underneath.",
        scoring: [w('D', 6), w('B', 2)],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // NQ07 — Weight: +3 (lighter) — Adapted from Q14
  // -------------------------------------------------------------------------
  {
    id: 'NQ07',
    number: 12,
    text: "Right now, you'd most want tarot to help you:",
    format: 'single_select',
    phase: 'scored',
    pair: null,
    answers: [
      {
        id: 'NQ07-A',
        text: 'Make clearer decisions with confidence.',
        scoring: [w('A', 3)],
      },
      {
        id: 'NQ07-B',
        text: 'Reconnect with intuition in a way that feels real and grounded.',
        scoring: [w('B', 3)],
      },
      {
        id: 'NQ07-C',
        text: 'Understand yourself without needing definitive answers.',
        scoring: [w('C', 3)],
      },
      {
        id: 'NQ07-D',
        text: "Navigate something you've been avoiding or transform a stuck pattern.",
        scoring: [w('D', 3)],
      },
    ],
  },
];
