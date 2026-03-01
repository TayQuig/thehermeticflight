# Marketing Pipeline Replacement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **For Task 5:** REQUIRED SUB-SKILL: Use `frontend-design` skill for the quiz UI. This is a tarot brand — the quiz must feel like a crafted experience, not an assembled form.

**Goal:** Replace the Tally + Zapier + Mailchimp email pipeline with a native Astro quiz form, client-side archetype classification, and a single Vercel serverless function that pushes contacts to Loops.so.

**Architecture:** The quiz is a single Astro page rendered at build time (SSG). All 20 question screens exist as HTML; client-side JavaScript manages step visibility, answer tracking, and scoring. On completion, the classifier runs client-side for instant archetype reveal. The user then enters their email, which POSTs to a Vercel serverless API route. The API route re-classifies server-side for integrity, then sends a single `quiz_completed` event to Loops.so (which auto-creates the contact, sets archetype properties, and triggers the drip automation). No new framework dependencies (no React/Preact/Svelte).

**Tech Stack:** Astro 5.16.4, TypeScript, Vitest, Tailwind CSS 3.4, Loops.so REST API, Vercel Serverless

**Reference docs:**
- Design doc: `docs/plans/2026-02-28-mastermind-marketing-pipeline-replacement.md`
- Loops.so API: `operations/mastermind-marketing-pipeline-replacement/loops-api-reference.md`
- Quiz extraction: `operations/mastermind-marketing-pipeline-replacement/tally-quiz-extraction.md`

---

## Scoring Anomaly Resolution Decisions

These decisions apply to the native quiz implementation. The Tally form bugs are NOT replicated.

| Question | Issue | Decision | Rationale |
|----------|-------|----------|-----------|
| Q5 | Options A→B, B→C, C→D shifted scoring | **Use corrected scoring** (A=A, B=B, C=C, D=D) | Surface meaning matches dimension. Operator reportedly fixed anomalies in Tally. Add comment noting original shifted pattern for operator review. |
| Q6 | Options B↔C swapped scoring | **Use corrected scoring** (B=B, C=C) | Same as Q5. Add comment for operator review. |
| Q7-E | Dual scores A+D (+4 each) | **Preserve dual scoring** | Confirmed intentional Grounded Mystic detector per handoff context. |
| Q8-A | Missing scoring rule (awards 0 points) | **Fix: score as Air Weaver +4** | Clearly a bug — "Data, logic, and clear analysis" is textbook Air Weaver. |
| Q8-E | Dual scores A+D (+4 each) | **Preserve dual scoring** | Confirmed intentional Grounded Mystic detector per handoff context. |
| Q9-A | Duplicate rule fires twice (Air Weaver +8) | **Fix: score as Air Weaver +4** | Duplicate conditional logic rule in Tally. |
| Q9-D | Scores ALL dimensions (A+4, B+4, C+4, D+8) | **Fix: score as Shadow Dancer +4 only** | "Transformation" is core Shadow Dancer. All-dimension scoring was clearly a build error. |

---

## Pre-Implementation: Operator Decisions Needed

> **BLOCKER for Task 2.** Before implementing the quiz data, the operator should confirm:
>
> 1. **Q5/Q6 corrected scoring** — The plan implements surface-meaning-matches-dimension. If the original shifted pattern was intentional (anti-gaming technique), say so and the data will be adjusted.
> 2. **Q9-D scoring** — Plan implements Shadow Dancer +4 only. If the multi-dimension scoring was partially intentional (e.g., D+4 plus one other dimension), specify the intent.
>
> If no response, proceed with the corrected scoring as documented above.

---

### Task 1: Add Vitest Test Infrastructure

**Files:**
- Modify: `package.json` (add devDependency)
- Create: `vitest.config.ts`

**Step 1: Install vitest**

Run: `npm install --save-dev vitest`

**Step 2: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

**Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Verify vitest runs**

Run: `npx vitest run`
Expected: "No test files found" (clean exit, no errors)

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 2: Quiz Data Model

**Files:**
- Create: `src/lib/quiz-data.ts`
- Create: `tests/quiz-data.test.ts`

**Step 1: Write data integrity tests**

```typescript
// tests/quiz-data.test.ts
import { describe, it, expect } from 'vitest';
import { questions } from '../src/lib/quiz-data';

describe('quiz-data', () => {
  it('has exactly 20 questions', () => {
    expect(questions).toHaveLength(20);
  });

  it('questions are numbered 1-20', () => {
    const numbers = questions.map(q => q.number);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('each question has at least 2 answers', () => {
    for (const q of questions) {
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('scored questions have scoring weights on every answer', () => {
    const scored = questions.filter(q => q.scored);
    for (const q of scored) {
      for (const a of q.answers) {
        expect(a.scoring.length, `${q.id} ${a.id} has no scoring`).toBeGreaterThan(0);
      }
    }
  });

  it('non-scored questions have empty scoring arrays', () => {
    const nonScored = questions.filter(q => !q.scored);
    for (const q of nonScored) {
      for (const a of q.answers) {
        expect(a.scoring, `${q.id} ${a.id} should have no scoring`).toHaveLength(0);
      }
    }
  });

  it('standard scoring is +4 points per dimension', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        for (const s of a.scoring) {
          expect(s.points).toBe(4);
        }
      }
    }
  });

  it('Q7-E and Q8-E have dual A+D scoring (Grounded Mystic detectors)', () => {
    const q7 = questions.find(q => q.id === 'Q7')!;
    const q7e = q7.answers.find(a => a.id === 'Q7-E')!;
    expect(q7e.scoring).toEqual([
      { dimension: 'A', points: 4 },
      { dimension: 'D', points: 4 },
    ]);

    const q8 = questions.find(q => q.id === 'Q8')!;
    const q8e = q8.answers.find(a => a.id === 'Q8-E')!;
    expect(q8e.scoring).toEqual([
      { dimension: 'A', points: 4 },
      { dimension: 'D', points: 4 },
    ]);
  });

  it('has 15 scored and 5 non-scored questions', () => {
    const scored = questions.filter(q => q.scored);
    const nonScored = questions.filter(q => !q.scored);
    expect(scored).toHaveLength(15);
    expect(nonScored).toHaveLength(5);
  });

  it('each answer has a unique id', () => {
    const ids = questions.flatMap(q => q.answers.map(a => a.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/quiz-data.test.ts`
Expected: FAIL (module not found)

**Step 3: Create quiz data file**

Create `src/lib/quiz-data.ts` with type definitions and all 20 questions.

The file structure:

```typescript
// src/lib/quiz-data.ts

export type Dimension = 'A' | 'B' | 'C' | 'D';

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
  scored: boolean;
}
```

Then define `export const questions: Question[]` with all 20 questions. **Source all question text, answer text, and scoring from the extraction doc at `operations/mastermind-marketing-pipeline-replacement/tally-quiz-extraction.md`.** Apply the scoring decisions from the table above.

Patterns to follow for each question type:

**Clean scored question (Q1, Q4, Q10, Q12-Q18):**
```typescript
{
  id: 'Q1', number: 1, scored: true,
  text: "You're awake at 2am with something weighing on you. What actually helps?",
  answers: [
    { id: 'Q1-A', text: 'Making a list, researching options, or thinking it through logically.', scoring: [{ dimension: 'A', points: 4 }] },
    { id: 'Q1-B', text: 'Getting out of bed—walking, stretching, doing something physical.', scoring: [{ dimension: 'B', points: 4 }] },
    { id: 'Q1-C', text: 'Letting it go for now, trusting morning will bring clarity.', scoring: [{ dimension: 'C', points: 4 }] },
    { id: 'Q1-D', text: 'Sitting with the discomfort, asking what this situation is really trying to show you.', scoring: [{ dimension: 'D', points: 4 }] },
  ],
},
```

**Corrected scored question (Q5, Q6) — add comment noting original:**
```typescript
{
  // SCORING DECISION: Corrected to match surface meaning. Original Tally form
  // had shifted scoring (A→B, B→C, C→D). See extraction doc Anomaly 1.
  id: 'Q5', number: 5, scored: true,
  text: 'When someone offers guidance, your first instinct is to:',
  answers: [
    { id: 'Q5-A', text: 'Evaluate whether it\'s logical and applicable to your situation.', scoring: [{ dimension: 'A', points: 4 }] },
    { id: 'Q5-B', text: 'Check your gut—does this land in your body as true?', scoring: [{ dimension: 'B', points: 4 }] },
    { id: 'Q5-C', text: 'Stay open—maybe there\'s something here worth exploring.', scoring: [{ dimension: 'C', points: 4 }] },
    { id: 'Q5-D', text: 'Look underneath—what\'s the real wisdom here, beyond the surface?', scoring: [{ dimension: 'D', points: 4 }] },
  ],
},
```

**Dual-score question (Q7, Q8):**
```typescript
{
  id: 'Q7', number: 7, scored: true,
  text: 'You learn best when you have:',
  answers: [
    { id: 'Q7-A', text: 'Clear frameworks, logical progressions, and reliable information.', scoring: [{ dimension: 'A', points: 4 }] },
    { id: 'Q7-B', text: 'Hands-on practice—learning by doing, not just reading.', scoring: [{ dimension: 'B', points: 4 }] },
    { id: 'Q7-C', text: 'Freedom to explore at your own pace without rigid rules.', scoring: [{ dimension: 'C', points: 4 }] },
    { id: 'Q7-D', text: 'Permission to go deep, even into difficult or complex territory.', scoring: [{ dimension: 'D', points: 4 }] },
    { id: 'Q7-E', text: 'Both structure AND room for mystery—I need the framework AND the freedom.', scoring: [{ dimension: 'A', points: 4 }, { dimension: 'D', points: 4 }] },
  ],
},
```

**Fixed Q8 (option A now scores, option E dual-scores):**
```typescript
{
  // SCORING DECISION: Q8-A fixed to score Air Weaver +4 (was 0 in Tally due to missing rule).
  id: 'Q8', number: 8, scored: true,
  text: 'When making an important decision you want:',
  answers: [
    { id: 'Q8-A', text: 'Data, logic, and clear analysis.', scoring: [{ dimension: 'A', points: 4 }] },
    { id: 'Q8-B', text: 'To check what my body is telling me.', scoring: [{ dimension: 'B', points: 4 }] },
    { id: 'Q8-C', text: 'Time to sit with it and let the answer emerge.', scoring: [{ dimension: 'C', points: 4 }] },
    { id: 'Q8-D', text: 'To understand the deeper pattern or lesson underneath.', scoring: [{ dimension: 'D', points: 4 }] },
    { id: 'Q8-E', text: "I need both the practical AND the mystical—one without the other feels incomplete.", scoring: [{ dimension: 'A', points: 4 }, { dimension: 'D', points: 4 }] },
  ],
},
```

**Fixed Q9 (A is +4 not +8, D is D-only not all-dimensions):**
```typescript
{
  // SCORING DECISION: Q9-A fixed to +4 (was +8 due to duplicate rule).
  // Q9-D fixed to Shadow Dancer +4 only (was all-dimensions due to build error).
  id: 'Q9', number: 9, scored: true,
  text: 'Imagine watching someone perform something remarkable. What captivates you most?',
  answers: [
    { id: 'Q9-A', text: 'The precision—every movement intentional, nothing wasted.', scoring: [{ dimension: 'A', points: 4 }] },
    { id: 'Q9-B', text: "The physicality—you can almost feel what they're feeling in your own body.", scoring: [{ dimension: 'B', points: 4 }] },
    { id: 'Q9-C', text: 'The flow—that effortless quality where everything just... works.', scoring: [{ dimension: 'C', points: 4 }] },
    { id: 'Q9-D', text: 'The transformation—watching them become something different than when they started.', scoring: [{ dimension: 'D', points: 4 }] },
  ],
},
```

**Non-scored question (Q2, Q3, Q11, Q19, Q20):**
```typescript
{
  id: 'Q2', number: 2, scored: false,
  text: "When it comes to Tarot, I'd describe myself as:",
  answers: [
    { id: 'Q2-A', text: 'Curious, but just beginning.', scoring: [] },
    { id: 'Q2-B', text: 'Practicing, but still building confidence.', scoring: [] },
    { id: 'Q2-C', text: 'Experienced, but looking to deepen.', scoring: [] },
  ],
},
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/quiz-data.test.ts`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add src/lib/quiz-data.ts tests/quiz-data.test.ts
git commit -m "feat: add quiz data model with 20 questions and scoring weights"
```

---

### Task 3: Archetype Classifier (TDD)

**Files:**
- Create: `src/lib/classifier.ts`
- Create: `tests/classifier.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/classifier.test.ts
import { describe, it, expect } from 'vitest';
import { classify, computeScores } from '../src/lib/classifier';
import { questions } from '../src/lib/quiz-data';

describe('classify', () => {
  it('returns Air Weaver when A is dominant', () => {
    expect(classify({ A: 20, B: 8, C: 4, D: 8 })).toBe('air_weaver');
  });

  it('returns Embodied Intuitive when B is dominant', () => {
    expect(classify({ A: 4, B: 20, C: 8, D: 8 })).toBe('embodied_intuitive');
  });

  it('returns Ascending Seeker as fallback when C is dominant', () => {
    expect(classify({ A: 4, B: 4, C: 20, D: 4 })).toBe('ascending_seeker');
  });

  it('returns Shadow Dancer when D is dominant', () => {
    expect(classify({ A: 4, B: 8, C: 4, D: 20 })).toBe('shadow_dancer');
  });

  it('returns Grounded Mystic when A+D dominate B+C', () => {
    expect(classify({ A: 16, B: 8, C: 4, D: 16 })).toBe('grounded_mystic');
  });

  it('returns Flow Artist when B+C dominate A+D', () => {
    expect(classify({ A: 4, B: 16, C: 16, D: 4 })).toBe('flow_artist');
  });

  it('breaks ties in favor of Air Weaver (highest priority base)', () => {
    expect(classify({ A: 12, B: 12, C: 12, D: 12 })).toBe('air_weaver');
  });

  it('Grounded Mystic requires STRICT dominance of both A and D', () => {
    // A+D equal to B+C should NOT trigger Grounded Mystic
    expect(classify({ A: 12, B: 12, C: 12, D: 12 })).not.toBe('grounded_mystic');
  });

  it('Flow Artist requires STRICT dominance of both B and C', () => {
    expect(classify({ A: 12, B: 12, C: 12, D: 12 })).not.toBe('flow_artist');
  });

  it('Ascending Seeker is the fallback for ambiguous scores', () => {
    // C slightly ahead but can never win direct comparison
    expect(classify({ A: 8, B: 10, C: 14, D: 12 })).toBe('ascending_seeker');
  });

  it('priority: Grounded Mystic beats Air Weaver even when A is highest', () => {
    expect(classify({ A: 20, B: 4, C: 4, D: 16 })).toBe('grounded_mystic');
  });

  it('priority: Flow Artist beats Embodied Intuitive even when B is highest', () => {
    expect(classify({ A: 4, B: 20, C: 16, D: 4 })).toBe('flow_artist');
  });
});

describe('computeScores', () => {
  it('computes scores from answers map', () => {
    const answers: Record<string, string> = { Q1: 'Q1-A', Q4: 'Q4-B' };
    const scores = computeScores(answers, questions);
    expect(scores.A).toBe(4);  // Q1-A
    expect(scores.B).toBe(4);  // Q4-B
    expect(scores.C).toBe(0);
    expect(scores.D).toBe(0);
  });

  it('handles dual-scored answers', () => {
    const answers: Record<string, string> = { Q7: 'Q7-E' };
    const scores = computeScores(answers, questions);
    expect(scores.A).toBe(4);
    expect(scores.D).toBe(4);
  });

  it('ignores non-scored questions', () => {
    const answers: Record<string, string> = { Q2: 'Q2-A' };
    const scores = computeScores(answers, questions);
    expect(scores.A).toBe(0);
    expect(scores.B).toBe(0);
    expect(scores.C).toBe(0);
    expect(scores.D).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/classifier.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement classifier**

```typescript
// src/lib/classifier.ts
import type { Dimension, Question } from './quiz-data';

export type ArchetypeSlug =
  | 'air_weaver'
  | 'embodied_intuitive'
  | 'ascending_seeker'
  | 'shadow_dancer'
  | 'flow_artist'
  | 'grounded_mystic';

export interface DimensionScores {
  A: number;
  B: number;
  C: number;
  D: number;
}

/**
 * Priority-based cascade classifier. First matching condition wins.
 * Ported from archetypes.py — see extraction doc Section 4.
 */
export function classify(scores: DimensionScores): ArchetypeSlug {
  const { A, B, C, D } = scores;

  // Priority 1: Grounded Mystic — A+D both strictly dominate B+C
  if (A > B && A > C && D > B && D > C) return 'grounded_mystic';

  // Priority 2: Flow Artist — B+C both strictly dominate A+D
  if (B > A && B > D && C > A && C > D) return 'flow_artist';

  // Priority 3: Air Weaver — A highest or tied
  if (A >= B && A >= C && A >= D) return 'air_weaver';

  // Priority 4: Embodied Intuitive — B highest or tied
  if (B >= A && B >= C && B >= D) return 'embodied_intuitive';

  // Priority 5: Shadow Dancer — D highest or tied
  if (D >= A && D >= B && D >= C) return 'shadow_dancer';

  // Priority 6: Ascending Seeker — fallback
  return 'ascending_seeker';
}

/**
 * Compute dimension scores from a map of question ID → answer ID.
 */
export function computeScores(
  answers: Record<string, string>,
  questions: Question[]
): DimensionScores {
  const scores: DimensionScores = { A: 0, B: 0, C: 0, D: 0 };

  for (const [questionId, answerId] of Object.entries(answers)) {
    const question = questions.find(q => q.id === questionId);
    if (!question || !question.scored) continue;

    const answer = question.answers.find(a => a.id === answerId);
    if (!answer) continue;

    for (const weight of answer.scoring) {
      scores[weight.dimension] += weight.points;
    }
  }

  return scores;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/classifier.test.ts`
Expected: All 15 tests PASS

**Step 5: Commit**

```bash
git add src/lib/classifier.ts tests/classifier.test.ts
git commit -m "feat: add archetype classifier with priority cascade logic"
```

---

### Task 4: Archetype Content Data

**Files:**
- Create: `src/lib/archetype-content.ts`

**Step 1: Create archetype display data**

```typescript
// src/lib/archetype-content.ts
import type { ArchetypeSlug } from './classifier';

export interface ArchetypeContent {
  slug: ArchetypeSlug;
  name: string;
  title: string;        // Display title with "The" prefix
  description: string;  // 2-3 sentence archetype description
  element: string;      // Thematic element
  color: string;        // Tailwind color class for accent
}

export const archetypes: Record<ArchetypeSlug, ArchetypeContent> = {
  air_weaver: {
    slug: 'air_weaver',
    name: 'Air Weaver',
    title: 'The Air Weaver',
    description: 'You move through the world like breath itself — analyzing, understanding, building frameworks that make the invisible visible. Your power is clarity. You don\'t just learn systems; you master them.',
    element: 'Air',
    color: 'text-blue-300',
  },
  embodied_intuitive: {
    slug: 'embodied_intuitive',
    name: 'Embodied Intuitive',
    title: 'The Embodied Intuitive',
    description: 'Your body knows things your mind hasn\'t caught up to yet. You feel truth before you think it, sense shifts before they happen. Your wisdom lives in sensation, movement, and the electricity of physical knowing.',
    element: 'Earth',
    color: 'text-emerald-300',
  },
  ascending_seeker: {
    slug: 'ascending_seeker',
    name: 'Ascending Seeker',
    title: 'The Ascending Seeker',
    description: 'You are the open sky — curious without needing answers, exploring without needing destinations. Where others grip, you release. Your power is surrender, and in that surrender, you find what everyone else misses.',
    element: 'Spirit',
    color: 'text-purple-300',
  },
  shadow_dancer: {
    slug: 'shadow_dancer',
    name: 'Shadow Dancer',
    title: 'The Shadow Dancer',
    description: 'You go where others won\'t. The depths, the patterns, the uncomfortable truths — these are your territory. You know that transformation lives in the places most people avoid, and you walk there willingly.',
    element: 'Shadow',
    color: 'text-red-300',
  },
  flow_artist: {
    slug: 'flow_artist',
    name: 'Flow Artist',
    title: 'The Flow Artist',
    description: 'Body and spirit move as one in you. You\'re both grounded and transcendent — feeling the physical world deeply while remaining open to what lies beyond it. Your gift is making the sacred look effortless.',
    element: 'Water',
    color: 'text-cyan-300',
  },
  grounded_mystic: {
    slug: 'grounded_mystic',
    name: 'Grounded Mystic',
    title: 'The Grounded Mystic',
    description: 'You hold the paradox: the analytical mind and the shadow-walking soul. You need both the framework AND the mystery, the structure AND the depth. Your rare combination sees patterns others can\'t even name.',
    element: 'Mercury',
    color: 'text-hermetic-gold',
  },
};
```

> **Note for implementer:** These descriptions are placeholders. The operator may want to refine the copy. The structure is what matters — it's consumed by both the quiz results UI and the Loops.so API route.

**Step 2: Commit**

```bash
git add src/lib/archetype-content.ts
git commit -m "feat: add archetype display content data"
```

---

### Task 5: Native Multi-Step Quiz Page

> **REQUIRED SUB-SKILL: Use `frontend-design` skill for this task.** This is the most
> user-facing page on the site — a tarot archetype quiz for an esoteric brand. The code
> below provides the structural foundation (data binding, state management, API integration),
> but the visual execution must feel *crafted and intentional*, not just functional.
>
> Before implementing, study the existing site aesthetic:
> - `src/styles/global.css` — glass-panel, btn-flame, star/fog backgrounds
> - `tailwind.config.mjs` — hermetic color palette, Cinzel/Lato fonts, custom animations
> - `src/pages/thank-you.astro` — decorative gold corners, glass panels, gold gradients
> - `src/pages/index.astro` — overall page rhythm, section transitions, CTA styling
>
> Elevate beyond the structural code below with:
> - **Entrance animations** — fade/slide transitions between question steps
> - **Answer selection feedback** — satisfying visual response on selection (glow, scale, color shift)
> - **Archetype reveal moment** — dramatic reveal animation (not just text appearing)
> - **Visual archetype differentiation** — each archetype result could have a unique accent color or subtle visual identity
> - **Micro-interactions** — progress bar shimmer, hover states that feel alive, subtle parallax on the glass panels
>
> The goal: this quiz should feel like a *tarot reading experience*, not a Google Form.

**Files:**
- Modify: `src/pages/quiz.astro` (full rewrite — replaces Tally embed)
- Modify: `src/styles/global.css` (add quiz-specific styles)

**Step 1: Rewrite quiz.astro**

Replace the entire file. The page has three sections: intro, questions (rendered from data), and results with email capture.

```astro
---
import Layout from '../layouts/Layout.astro';
import { questions } from '../lib/quiz-data';
import { archetypes } from '../lib/archetype-content';
---

<Layout
  title="What's Your Aerial Tarot Archetype? | The Hermetic Flight"
  description="Discover your unique tarot archetype. Twenty questions, five minutes, one revelation about how you're wired to receive wisdom through the cards."
>
  <main class="w-full min-h-screen flex flex-col items-center relative z-10 pt-6 pb-12 px-4">

    <!-- Minimal Header -->
    <header class="w-full py-4 flex justify-center mb-4">
      <a href="/" class="group flex items-center gap-3">
        <img src="/images/logo.png" alt="The Hermetic Flight" class="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
        <span class="font-serif text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase group-hover:text-hermetic-gold transition-colors">The Hermetic Flight</span>
      </a>
    </header>

    <!-- Progress Bar (hidden on intro and results) -->
    <div id="progress-bar" class="w-full max-w-2xl mb-6 hidden">
      <div class="h-1 bg-hermetic-void/50 rounded-full overflow-hidden border border-hermetic-gold/10">
        <div id="progress-fill" class="h-full bg-gradient-to-r from-hermetic-gold to-hermetic-sulfur transition-all duration-500 ease-out" style="width: 0%"></div>
      </div>
      <p id="progress-text" class="text-hermetic-gold/40 text-xs mt-2 text-center font-sans"></p>
    </div>

    <!-- Quiz Container -->
    <div id="quiz-container" class="w-full max-w-2xl">

      <!-- Intro Screen -->
      <section id="quiz-intro" class="quiz-step">
        <div class="glass-panel p-8 md:p-12 rounded-lg text-center">
          <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
          <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
          <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
          <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

          <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase mb-6 font-sans">Six Archetypes Await</p>
          <h1 class="font-serif text-2xl md:text-4xl text-hermetic-white mb-4 leading-tight">
            Discover Your Aerial<br>Tarot Archetype
          </h1>
          <p class="text-gray-300 font-light font-sans mb-8 max-w-md mx-auto leading-relaxed">
            Twenty questions. Five minutes. One revelation about how you receive wisdom through the cards.
          </p>
          <button id="start-quiz" class="btn-flame px-10 py-4 text-white font-sans font-bold text-sm tracking-widest uppercase">
            Begin the Reading
          </button>
        </div>
      </section>

      <!-- Question Screens (rendered from data) -->
      {questions.map((q, i) => (
        <section class="quiz-step hidden" data-step={i + 1}>
          <div class="glass-panel p-6 md:p-8 rounded-lg">
            <p class="text-hermetic-gold/50 text-xs tracking-wider uppercase mb-4 font-sans">
              Question {q.number} of {questions.length}
            </p>
            <h2 class="font-serif text-lg md:text-xl text-hermetic-white mb-6 leading-relaxed">
              {q.text}
            </h2>
            <div class="space-y-3">
              {q.answers.map((a) => (
                <button
                  class="answer-btn w-full text-left p-4 border border-hermetic-gold/15 rounded-lg font-sans text-gray-300 font-light leading-relaxed transition-all duration-200 hover:border-hermetic-gold/50 hover:bg-hermetic-emerald/20 hover:text-hermetic-white"
                  data-question={q.id}
                  data-answer={a.id}
                >
                  {a.text}
                </button>
              ))}
            </div>
            <!-- Back button (hidden on first question) -->
            {i > 0 && (
              <button class="back-btn mt-6 text-hermetic-gold/40 text-sm font-sans hover:text-hermetic-gold transition-colors">
                &larr; Previous question
              </button>
            )}
          </div>
        </section>
      ))}

      <!-- Results Screen -->
      <section id="quiz-results" class="quiz-step hidden">
        <div class="glass-panel p-8 md:p-12 rounded-lg text-center">
          <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
          <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
          <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
          <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

          <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase mb-4 font-sans">Your Archetype Revealed</p>
          <h2 id="result-title" class="font-serif text-3xl md:text-4xl text-hermetic-white mb-4"></h2>
          <p id="result-description" class="text-gray-300 font-light font-sans leading-relaxed mb-8 max-w-lg mx-auto"></p>

          <!-- Email Capture -->
          <div id="email-section" class="border-t border-hermetic-gold/20 pt-8 mt-8">
            <p class="text-hermetic-white font-serif text-lg mb-2">Begin Your Archetype Journey</p>
            <p class="text-gray-400 font-sans text-sm mb-6">Enter your email to receive your personalized archetype reading and early Kickstarter access.</p>
            <form id="email-form" class="space-y-3 max-w-sm mx-auto">
              <!-- Honeypot (hidden from humans) -->
              <div style="position:absolute;left:-9999px;" aria-hidden="true">
                <input type="text" name="website" tabindex="-1" autocomplete="off" />
              </div>
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                class="w-full p-3 bg-hermetic-void/80 border border-hermetic-gold/20 rounded-lg text-hermetic-white font-sans placeholder:text-gray-500 focus:border-hermetic-gold/50 focus:outline-none transition-colors"
              />
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                required
                class="w-full p-3 bg-hermetic-void/80 border border-hermetic-gold/20 rounded-lg text-hermetic-white font-sans placeholder:text-gray-500 focus:border-hermetic-gold/50 focus:outline-none transition-colors"
              />
              <button type="submit" id="submit-btn" class="btn-flame w-full py-3 text-white font-sans font-bold text-sm tracking-widest uppercase">
                Unlock My Reading
              </button>
            </form>
          </div>

          <!-- Success Message (hidden by default) -->
          <div id="email-success" class="hidden border-t border-hermetic-gold/20 pt-8 mt-8">
            <p class="text-hermetic-gold font-serif text-xl mb-2">The Path is Revealed</p>
            <p class="text-gray-300 font-sans font-light">Check your inbox — your archetype journey begins now.</p>
            <a href="/" class="btn-flame inline-block mt-6 px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
              Return Home
            </a>
          </div>
        </div>
      </section>

    </div>
  </main>

  <!-- Quiz Client Logic -->
  <script>
    import { questions } from '../lib/quiz-data';
    import { classify, computeScores } from '../lib/classifier';
    import { archetypes } from '../lib/archetype-content';

    const TOTAL_QUESTIONS = questions.length;
    const state = {
      currentStep: 0, // 0 = intro, 1-20 = questions, 21 = results
      answers: {} as Record<string, string>,
      startTime: Date.now(),
    };

    // DOM refs
    const allSteps = document.querySelectorAll<HTMLElement>('.quiz-step');
    const progressBar = document.getElementById('progress-bar')!;
    const progressFill = document.getElementById('progress-fill')!;
    const progressText = document.getElementById('progress-text')!;
    const startBtn = document.getElementById('start-quiz')!;
    const resultsSection = document.getElementById('quiz-results')!;
    const resultTitle = document.getElementById('result-title')!;
    const resultDescription = document.getElementById('result-description')!;
    const emailForm = document.getElementById('email-form') as HTMLFormElement;
    const emailSection = document.getElementById('email-section')!;
    const emailSuccess = document.getElementById('email-success')!;
    const submitBtn = document.getElementById('submit-btn')!;

    function showStep(step: number) {
      state.currentStep = step;

      // Hide all steps
      allSteps.forEach(el => el.classList.add('hidden'));

      if (step === 0) {
        // Intro
        allSteps[0].classList.remove('hidden');
        progressBar.classList.add('hidden');
      } else if (step <= TOTAL_QUESTIONS) {
        // Question step
        const stepEl = document.querySelector<HTMLElement>(`[data-step="${step}"]`);
        if (stepEl) {
          stepEl.classList.remove('hidden');
          // Restore selected state if answer was previously chosen
          const qId = questions[step - 1].id;
          if (state.answers[qId]) {
            const selectedBtn = stepEl.querySelector(`[data-answer="${state.answers[qId]}"]`);
            if (selectedBtn) selectedBtn.classList.add('selected');
          }
        }
        progressBar.classList.remove('hidden');
        const pct = ((step - 1) / TOTAL_QUESTIONS) * 100;
        progressFill.style.width = `${pct}%`;
        progressText.textContent = `${step} of ${TOTAL_QUESTIONS}`;
      } else {
        // Results
        progressBar.classList.add('hidden');
        showResults();
        resultsSection.classList.remove('hidden');
      }
    }

    function showResults() {
      const scores = computeScores(state.answers, questions);
      const archetype = classify(scores);
      const content = archetypes[archetype];

      resultTitle.textContent = content.title;
      resultDescription.textContent = content.description;

      // Store for form submission
      (window as any).__quizArchetype = archetype;
      (window as any).__quizScores = scores;

      // Analytics: quiz completed
      if (typeof gtag === 'function') {
        gtag('event', 'quiz_completed', { archetype });
      }
    }

    // Start button
    startBtn.addEventListener('click', () => showStep(1));

    // Answer selection — auto-advance after brief delay
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.answer-btn') as HTMLElement;
      if (!btn) return;

      const questionId = btn.dataset.question!;
      const answerId = btn.dataset.answer!;

      // Visual feedback
      const parent = btn.closest('.quiz-step')!;
      parent.querySelectorAll('.answer-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Record answer
      state.answers[questionId] = answerId;

      // Auto-advance after 400ms
      setTimeout(() => {
        const nextStep = state.currentStep + 1;
        if (nextStep <= TOTAL_QUESTIONS) {
          showStep(nextStep);
        } else {
          showStep(TOTAL_QUESTIONS + 1); // Results
        }
      }, 400);
    });

    // Back button
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.back-btn');
      if (!btn) return;
      if (state.currentStep > 1) {
        showStep(state.currentStep - 1);
      }
    });

    // Email form submission
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(emailForm);

      // Honeypot check
      if (formData.get('website')) return;

      // Timing check (< 10s for 20 questions = bot)
      const elapsed = (Date.now() - state.startTime) / 1000;
      if (elapsed < 10) return;

      const email = formData.get('email') as string;
      const firstName = formData.get('firstName') as string;

      submitBtn.textContent = 'Sending...';
      submitBtn.setAttribute('disabled', 'true');

      try {
        const res = await fetch('/api/quiz-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            firstName,
            answers: state.answers,
          }),
        });

        if (res.ok) {
          emailSection.classList.add('hidden');
          emailSuccess.classList.remove('hidden');

          // Analytics: lead captured
          if (typeof fbq === 'function') fbq('track', 'Lead');
          if (typeof gtag === 'function') {
            gtag('event', 'generate_lead', {
              event_category: 'quiz',
              archetype: (window as any).__quizArchetype,
            });
          }
        } else {
          submitBtn.textContent = 'Something went wrong — try again';
          submitBtn.removeAttribute('disabled');
        }
      } catch {
        submitBtn.textContent = 'Something went wrong — try again';
        submitBtn.removeAttribute('disabled');
      }
    });

    // Initialize
    showStep(0);
  </script>
</Layout>
```

**Step 2: Add quiz-specific styles to global.css**

Append to `src/styles/global.css`:

```css
/* Quiz answer button states */
.answer-btn.selected {
    border-color: rgba(197, 160, 89, 0.6);
    background: rgba(1, 53, 41, 0.5);
    color: #FBFBFB;
}
```

**Step 3: Manual test in dev server**

Run: `npm run dev`

Verify:
- [ ] Intro screen renders with "Begin the Reading" button
- [ ] Clicking start shows Q1 with progress bar
- [ ] Selecting an answer auto-advances to next question
- [ ] Back button returns to previous question with selection preserved
- [ ] Progress bar fills as questions are answered
- [ ] After Q20, results screen shows archetype name and description
- [ ] Email form appears below results
- [ ] Form submission sends POST to /api/quiz-submit (will 404 until Task 6)

**Step 4: Commit**

```bash
git add src/pages/quiz.astro src/styles/global.css
git commit -m "feat: replace Tally embed with native multi-step quiz UI"
```

---

### Task 6: Quiz Submission API Route

**Files:**
- Create: `src/pages/api/quiz-submit.ts`

**Step 1: Create the API route**

```typescript
// src/pages/api/quiz-submit.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { questions } from '../../lib/quiz-data';
import { classify, computeScores } from '../../lib/classifier';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, firstName, answers } = body;

    // 1. Validate required fields
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400 });
    }
    if (!answers || typeof answers !== 'object') {
      return new Response(JSON.stringify({ error: 'Answers required' }), { status: 400 });
    }

    // 2. Server-side classification (integrity check)
    const scores = computeScores(answers, questions);
    const archetype = classify(scores);

    // 3. Extract non-scored answers for segmentation
    const experienceLevel = answers['Q2'] || null;  // Q2: tarot experience
    const painPoint = answers['Q3'] || null;         // Q3: frustration
    const cardBackPref = answers['Q19'] || null;     // Q19: card back
    const productInterest = answers['Q20'] || null;  // Q20: product format

    // 4. Push to Loops.so
    const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY;
    if (!LOOPS_API_KEY) {
      console.error('LOOPS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 });
    }

    const loopsRes = await fetch('https://app.loops.so/api/v1/events/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        eventName: 'quiz_completed',

        // Contact properties (saved permanently)
        firstName: firstName || '',
        archetype,
        source: 'quiz',
        ...(experienceLevel && { experienceLevel }),
        ...(painPoint && { painPoint }),
        ...(cardBackPref && { cardBackPref }),
        ...(productInterest && { productInterest }),

        // Event properties (temporary, available in triggered emails)
        eventProperties: {
          archetype,
          scoreA: scores.A,
          scoreB: scores.B,
          scoreC: scores.C,
          scoreD: scores.D,
        },
      }),
    });

    const loopsData = await loopsRes.json();

    if (!loopsData.success) {
      console.error('Loops.so event failed:', loopsData.message);
      return new Response(JSON.stringify({ error: 'Failed to register' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, archetype }), { status: 200 });

  } catch (error) {
    console.error('Quiz submit error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
```

**Step 2: Test with curl (dev server running)**

```bash
# Test validation
curl -X POST http://localhost:4321/api/quiz-submit \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid", "answers": {}}'
# Expected: 400 {"error": "Valid email required"}

# Test missing Loops key (will fail gracefully)
curl -X POST http://localhost:4321/api/quiz-submit \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "firstName": "Test", "answers": {"Q1": "Q1-A"}}'
# Expected: 500 {"error": "Email service not configured"} (until LOOPS_API_KEY is set)
```

**Step 3: Commit**

```bash
git add src/pages/api/quiz-submit.ts
git commit -m "feat: add quiz submission API route with Loops.so integration"
```

---

### Task 7: Environment Setup & Build Verification

**Files:**
- Modify: `.env` (add Loops.so placeholder)

**Step 1: Add environment variable placeholders**

Add to `.env`:
```
LOOPS_API_KEY=your_loops_api_key_here
```

> **Operator action required:** Replace placeholder with real API key from Loops.so dashboard (Settings > API).

**Step 2: Build verification**

Run: `npm run build`

Verify:
- [ ] Build completes without errors
- [ ] `dist/` output includes the quiz page
- [ ] API route is bundled as a serverless function

**Step 3: Run full test suite**

Run: `npx vitest run`

Verify: All tests pass (quiz-data + classifier)

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: add Loops.so env placeholder and verify build"
```

---

## Loops.so Dashboard Setup (Manual — Operator)

These steps are performed in the Loops.so web dashboard, not in code. Complete them before the first real quiz submission.

### 1. Create Account & Verify Domain
- Sign up at loops.so (free plan)
- Verify sending domain: Settings > Domains > Add thehermeticflight.com
- Add SPF and DKIM DNS records as instructed

### 2. Generate API Key
- Settings > API > Generate API key
- Copy key to `.env` as `LOOPS_API_KEY`

### 3. Create Custom Contact Properties
The API route sends these automatically on first use, but creating them in advance ensures correct types:
- `archetype` (string)
- `experienceLevel` (string)
- `painPoint` (string)
- `cardBackPref` (string)
- `productInterest` (string)

### 4. Create Automation Flow
Create one automation in the Loop Builder:
- **Trigger:** Event Received → `quiz_completed`
- **Audience Filter branch 1:** archetype == `air_weaver` → Air Weaver drip sequence
- **Audience Filter branch 2:** archetype == `embodied_intuitive` → Embodied Intuitive drip
- ... (6 branches total, one per archetype)

Alternative simpler approach: create 6 separate automations, each triggered by `quiz_completed` with an audience filter for one archetype.

### 5. Physical Mailing Address
Add PO Box or virtual mailbox to email footer for CAN-SPAM compliance. This must be done before any emails are sent.

---

## Migration Checklist (Post-Build)

- [ ] Deploy native quiz to Vercel (preview branch)
- [ ] Test full flow: quiz → results → email capture → Loops.so contact created
- [ ] Verify automation triggers in Loops.so dashboard
- [ ] Run native quiz in parallel with Tally for 2 weeks
- [ ] Compare completion rates between native and Tally
- [ ] Once validated: remove Tally embed code, cancel Tally subscription
- [ ] Cancel Zapier subscription (no longer needed)
- [ ] Evaluate Mailchimp timeline (keep until Loops.so drip sequences are live)
