# Round 2 -- Builder Analysis: Forced-Choice Assessment & Revised Build Plan

## 1. Forced-Choice Paired Comparisons: Implementation Feasibility

I read the Daydreamer's Direction 2 proposal, then re-read every line of `quiz-data.ts`, `classifier.ts`, `quiz.astro`, and `quiz-submit.ts`. Here is the honest assessment: **forced-choice paired comparisons are simpler to implement than the 4-format approach the Designer proposed, and significantly simpler than what I outlined in Round 1 for Flaw 1.**

Here is why.

### Data Model Changes (quiz-data.ts)

The current `Question` interface has `answers: Answer[]` where each `Answer` has `text` and `scoring: ScoringWeight[]`. A forced-choice question is just a question with exactly 2 answers. The existing data model already supports this -- Q19 (Card Back Preference) already has exactly 2 answers. No interface changes needed for MVP.

However, to be explicit and get type-safety benefits, I would add a `format` discriminator:

```typescript
export type QuestionFormat = 'paired_comparison' | 'single_select' | 'intake';

export interface Question {
  id: string;
  number: number;
  text: string;
  answers: Answer[];
  scored: boolean;
  format: QuestionFormat;  // NEW
}
```

The `format` field tells the UI how to render, but the scoring pipeline does not care -- `computeScores()` just reads `answer.scoring` regardless. This is the key insight: **the scoring engine is format-agnostic.** It already handles any number of answers with any scoring weights. We are only changing the UI shape and the question content.

**What the 12 paired-comparison questions look like in quiz-data.ts:**

```typescript
{
  id: 'Q1',
  number: 1,
  text: "When facing uncertainty, I tend to...",
  format: 'paired_comparison',
  scored: true,
  answers: [
    {
      id: 'Q1-A',
      text: 'Research until I find the right framework.',
      scoring: [{ dimension: 'A', points: 3 }],
    },
    {
      id: 'Q1-B',
      text: 'Feel into my body for the answer.',
      scoring: [{ dimension: 'B', points: 3 }],
    },
  ],
},
```

Each question: 2 answers, each scoring +3 to its dimension. Winner gets +3, loser gets +0 (because the user only picks one). 12 questions, 6 dimension pairs (A-B, A-C, A-D, B-C, B-D, C-D), 2 questions per pair.

**Comparison to Round 1 plan:** In Round 1, I proposed keeping 4-option questions and adding a `questionType` field for future format diversity. The forced-choice approach is narrower (only 2-option questions) but more uniform -- every scored question works exactly the same way. This makes the UI component, test suite, and scoring logic dramatically simpler.

**The non-scored questions:** The Daydreamer says "eliminate all non-scored questions from the quiz flow." I agree with moving Q2 and Q3 to intake (pre-quiz), but we should keep them in the `questions` array with `format: 'intake'` and `scored: false` so that quiz-submit.ts can still validate and forward the segmentation data to Loops.so. Q19 and Q20 move to post-results or get dropped entirely. Q11 either gets converted to scored or dropped.

My proposed final structure:
- 2 intake questions (Q2, Q3) -- rendered before scored questions, no progress bar
- 12 forced-choice scored questions -- the main quiz
- 0 in-flow non-scored questions -- eliminated
- Q19, Q20 removed from quiz flow entirely (post-results survey or dropped)
- Total in-flow: 14 questions (2 intake + 12 scored)
- Progress bar counts only the 12 scored questions

### UI Changes (quiz.astro)

This is where forced-choice actually gets **simpler** than 4-option single-select.

**Current UI:** Each question renders 4-5 answer buttons stacked vertically. The buttons are identical in style. The user picks one and the selection is highlighted.

**Forced-choice UI:** Each question renders exactly 2 answer buttons. Two options for layout:

**Option A: Stacked (minimal change).** Keep the existing vertical button layout but with only 2 buttons. The buttons get larger padding, maybe a "VS" divider between them. This is the fastest to implement -- the existing `.answer-btn` CSS works unchanged, just fewer buttons.

**Option B: Side-by-side (better UX).** Two columns, each containing one statement. The user taps left or right. This is the more engaging layout for paired comparisons and is standard in academic forced-choice instruments. Implementation:

```html
<div class="grid grid-cols-2 gap-4">
  {q.answers.map((a) => (
    <button
      class="answer-btn p-6 border border-hermetic-gold/10 rounded-lg text-center ..."
      data-question={q.id}
      data-answer={a.id}
    >
      {a.text}
    </button>
  ))}
</div>
```

The rest of the quiz.astro script logic is unchanged:
- `state.answers[questionId] = answerId` -- same
- `autoAdvanceTimer` -- same (but I would increase to 800ms per Round 1)
- `showStep()` -- same step-counting mechanism
- `revealResults()` -- same (calls `computeScores` + `classify`)
- Back button -- same
- Progress bar -- needs adjustment: `SCORED_QUESTIONS = questions.filter(q => q.scored).length` instead of `questions.length`

The conditional rendering by format:

```astro
{q.format === 'paired_comparison' ? (
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* 2-column layout for paired comparisons */}
    {q.answers.map((a) => (
      <button class="answer-btn ..." data-question={q.id} data-answer={a.id}>
        {a.text}
      </button>
    ))}
  </div>
) : (
  <div class="space-y-3">
    {/* existing single-select layout */}
    {q.answers.map((a) => (
      <button class="answer-btn ..." data-question={q.id} data-answer={a.id}>
        {a.text}
      </button>
    ))}
  </div>
)}
```

**Key simplification:** The Designer proposed 4 different question formats (single-select, forced-rank, scenario-react, spectrum). I flagged forced-rank and spectrum as HIGH complexity in Round 1. Forced-choice paired comparisons give us **one** new format that achieves the Daydreamer's goals without the complexity of ranking UI or slider UI. We keep `single_select` for intake questions, and use `paired_comparison` for all 12 scored questions.

### Test Suite Impact

This is where the blast radius assessment changes from Round 1.

**Tests that break regardless (same as Round 1):**
- `quiz-data.test.ts`: All structural assertions (question count, scored count, non-scored IDs, answer counts, scoring values). Must be rewritten.
- `classifier.test.ts`: `computeScores` integration tests that construct full answer payloads with specific question IDs. Must be rewritten.
- `quiz-submit.test.ts`: `buildValidAnswers()` and `buildValidBody()` helpers construct payloads from the questions array -- these **auto-adapt** because they iterate `questions` at runtime. The structural tests should mostly pass unchanged.
- `quiz-submit-medium.test.ts`: Same as above.

**Tests that are easier with forced-choice:**
- `quiz-data.test.ts` scoring validation simplifies. Instead of "every answer is +4" we assert "every scored answer is +3" and "every question has exactly 2 answers" (for scored questions). The dual-scorer tests (Q7-E, Q8-E) disappear entirely -- combo archetypes emerge from pair patterns, not special answer options.

**Tests that are harder:**
- None, actually. The forced-choice format is simpler than the current format for testing purposes. Fewer answers per question = fewer combinatorial paths. No dual-scoring answers = simpler scoring validation.

**Net test impact assessment:**
- **quiz-data.test.ts**: ~60% rewrite (structural assertions change, but the test *structure* is the same -- just different expected values)
- **classifier.test.ts**: `classify()` pure-function tests -- **zero changes** (they use raw `DimensionScores`, not question IDs). `computeScores()` integration tests -- rewrite answer payloads with new IDs.
- **quiz-submit.test.ts**: `buildValidAnswers()` auto-adapts. Most tests pass unchanged. The "rejects when not all scored questions are answered" test passes unchanged. The cross-question reuse test passes unchanged.
- **quiz-submit-medium.test.ts**: Same -- auto-adapts.
- **E2E tests**: Must be updated for new question count and layout.

**Revised blast radius: MEDIUM** (down from HIGH in Round 1). The forced-choice format reduces the number of moving parts, and the key helpers in quiz-submit tests auto-adapt.

---

## 2. Forced-Choice Impact on the Classifier

### Does computeScores() Still Work?

**Yes, without modification.** Here is why:

`computeScores()` builds a flat lookup map from `answer.id -> answer.scoring[]`, then iterates the user's answers and sums points. It does not care:
- How many answers a question has (2 vs. 4 vs. 5)
- What the point values are (3 vs. 4)
- Whether the question is forced-choice or single-select

The function is already format-agnostic. I re-read lines 83-111 of classifier.ts to confirm. No changes needed.

### Does classify() Still Work?

**Yes, but the scoring range changes affect discrimination.** Let me run the math.

**Current system:**
- 15 scored questions, +4 per answer, max 60 per dimension
- Each dimension appears in 15 questions (every question has an option for every dimension)
- Total points distributed: 60 (one answer per question, one dimension per answer, 15 * 4)
- But with dual-scorers (Q7-E, Q8-E), total points can be up to 68

**Forced-choice system:**
- 12 scored questions, +3 per answer
- 6 dimension pairs: A-B, A-C, A-D, B-C, B-D, C-D
- 2 questions per pair
- Each dimension appears in 6 questions (paired against each other dimension, twice)
- Max per dimension: 18 (win all 6 matchups)
- Min per dimension: 0 (lose all 6 matchups)
- Total points distributed: 36 (12 questions * 3 points)

**The classifier conditions use raw score comparisons, not percentages.** The conditions `A > B`, `A >= B`, etc. work at any scale. The classifier does not use thresholds -- it is purely ordinal (which dimension is bigger). So the raw numbers do not matter for the four base archetypes.

**For combination archetypes (Grounded Mystic, Flow Artist), the story is different.** The current conditions require strict domination:
- Grounded Mystic: A > B AND A > C AND D > B AND D > C
- Flow Artist: B > A AND B > D AND C > A AND C > D

With forced-choice, these conditions become **naturally emergent.** Here is the key insight from the Daydreamer that I want to confirm with math:

If someone consistently picks A over B (in A-B matchups), A over C (A-C matchups), D over B (B-D matchups), and D over C (C-D matchups), the resulting scores will satisfy the Grounded Mystic condition. Let me trace a specific scenario:

```
Pair    Choice    Result
A-B #1  A wins    A: +3, B: +0
A-B #2  A wins    A: +6, B: +0
A-C #1  A wins    A: +9, C: +0
A-C #2  A wins    A: +12, C: +0
A-D #1  A wins    A: +15, D: +0
A-D #2  D wins    A: +15, D: +3
B-C #1  C wins    B: +0, C: +3
B-C #2  B wins    B: +3, C: +3
B-D #1  D wins    B: +3, D: +6
B-D #2  D wins    B: +3, D: +9
C-D #1  D wins    C: +3, D: +12
C-D #2  D wins    C: +3, D: +15

Final: A=15, B=3, C=3, D=15
```

Check Grounded Mystic: A(15) > B(3)? Yes. A(15) > C(3)? Yes. D(15) > B(3)? Yes. D(15) > C(3)? Yes. **Grounded Mystic fires.**

Now Flow Artist:
```
Pair    Choice    Result
A-B #1  B wins    A: +0, B: +3
A-B #2  B wins    A: +0, B: +6
A-C #1  C wins    A: +0, C: +3
A-C #2  C wins    A: +0, C: +6
A-D #1  A wins    A: +3, D: +0
A-D #2  D wins    A: +3, D: +3
B-C #1  B wins    B: +9, C: +6
B-C #2  C wins    B: +9, C: +9
B-D #1  B wins    B: +12, D: +3
B-D #2  B wins    B: +15, D: +3
C-D #1  C wins    C: +12, D: +3
C-D #2  C wins    C: +15, D: +3

Final: A=3, B=15, C=15, D=3
```

Check Flow Artist: B(15) > A(3)? Yes. B(15) > D(3)? Yes. C(15) > A(3)? Yes. C(15) > D(3)? Yes. **Flow Artist fires.**

**The existing classifier conditions work with forced-choice scoring. No changes to classify() needed.**

### Is the Range (0-18 per dimension, 36 total) Sufficient for 6-Archetype Discrimination?

**Yes, with a caveat.** The range is sufficient for base archetypes and combination archetypes. The 3-point granularity (scores are multiples of 3) gives a possible range of {0, 3, 6, 9, 12, 15, 18} per dimension -- 7 distinct values. With 4 dimensions, this provides 7^4 = 2,401 possible score profiles. Plenty for 6 archetypes.

**The caveat:** With only 2 questions per dimension pair, ties are more likely. If someone splits their A-B matchups (picks A once, B once), both A and B get +3 from that pair. This makes the `>=` conditions in the classifier more influential. The priority cascade becomes: ties frequently hit, so priority order matters more than in the current system.

This is not a problem -- it is actually a feature. In the current system, ties are rare because 15 questions create wide score separation. In the forced-choice system, ties are expected, and the priority cascade handles them deterministically. The operator just needs to be aware that archetype distribution will be influenced by priority order (Air Weaver has slight advantage as the first `>=` check, Ascending Seeker as fallback).

### Proposed Classifier Changes

None for `classify()`. The function works as-is.

For `computeScores()`: no changes needed.

The Daydreamer suggested potentially changing the Ascending Seeker to require "genuine balance" (all dimensions within a narrow band). I support this as a Phase 2 enhancement, but for MVP, the existing fallback behavior is fine. Ascending Seeker in the forced-choice system will catch genuinely balanced profiles (which is what we want) because the ipsative scoring naturally prevents the "dump everything ambiguous here" problem.

**Why?** In the current system, a user can get C points without A, B, or D losing points -- so C can win by being slightly above zero while everything else is also low. In forced-choice, getting C points means B or D is losing head-to-head matchups. If C is winning, something else is losing. This creates genuine separation and makes the fallback less of a junk drawer.

---

## 3. Revised Build Plan

### What Gets Simpler with Forced-Choice

1. **Flaw 1 (Question Homogeneity):** Solved at the format level. No need for multiple question types (ranking, spectrum, scenario-react). One format: paired comparison. The variety comes from the dimension pairing, not the UI component.

2. **Flaw 3 (Composites Unreachable):** Solved naturally. No need for dual-scored answers (Q7-E, Q8-E pattern). Combo archetypes emerge from pair patterns. No special-case answers to design, implement, or test.

3. **Flaw 7 (Flat Scoring):** Solved inherently. The +3/+0 ipsative system replaces the flat +4. No need for a 3-tier variable weighting system (+2/+4/+6). Every question weighs the same, but the forced-choice format creates natural differentiation.

4. **UI implementation:** One rendering path for all scored questions (2-option grid or stack) instead of conditional rendering for 4 different formats.

5. **Test suite:** Simpler scoring validation. No dual-scorer edge cases. Fewer answer combinations to validate.

### What Gets Harder

1. **Content creation:** All 12 paired-comparison questions must be written from scratch. The existing 15 scored questions cannot be repurposed directly -- their answer options are designed for 4-option single-select, not 2-option forced-choice. The operator needs to write 24 statements (12 questions * 2 options) matched for social desirability. This is a content bottleneck, not an engineering bottleneck.

2. **Desirability matching:** Each pair must present two equally appealing options. If one option is obviously "cooler" than the other, that option always wins and the question provides no signal. This requires operator review and possibly user testing. The current 4-option format is more forgiving of unmatched desirability because 4 options dilute the effect.

3. **Answer randomization (Flaw 10):** Slightly more critical. With only 2 options, position bias (always picking left/top) is more pronounced than with 4 options. Fisher-Yates shuffle of 2 items is just a coin flip on order -- simple to implement but important to do.

### Revised Phase Structure

**Phase 0: Content Design (non-engineering, operator-driven)**
- Design all 12 paired-comparison questions (24 statements)
- Map each to its dimension pair (A-B, A-C, A-D, B-C, B-D, C-D)
- Match statements for social desirability
- Decide on intake questions (keep Q2+Q3 as-is, or rewrite)
- Decide: drop Q19+Q20 from quiz entirely, or move to post-results
- **Deliverable:** A JSON/markdown spec of all questions, answers, and scoring
- **Gate:** Operator approval on question content before Phase 1 begins

**Phase 1: Data Model + Scoring Pipeline (1 day)**
1. Update `Question` interface to add `format: QuestionFormat`
2. Rewrite `questions` array in `quiz-data.ts`: 2 intake + 12 scored (forced-choice)
3. Update `w()` helper: `function w(dim: Dimension): ScoringWeight { return { dimension: dim, points: 3 }; }`
4. Rewrite `quiz-data.test.ts`: new structural assertions (12 scored, 2 intake, 2 answers per scored question, all weights +3, 6 dimension pairs covered with 2 questions each)
5. Rewrite `computeScores` integration tests in `classifier.test.ts` with new question IDs
6. Run `vitest` -- all must pass
- **quiz-submit.ts auto-adapts** (validation is built from `questions` at import time)
- **quiz-submit.test.ts auto-adapts** (helpers iterate `questions` at runtime)
- **classifier.ts unchanged** (pure `classify()` tests pass without modification)

**Phase 2: Classifier Validation (0.5 day)**
1. Add positive Ascending Seeker condition (optional, enhances but not required)
2. Create `tests/archetype-distribution.test.ts`: Monte Carlo harness
   - Generate 10,000 random forced-choice answer sets (for each of 12 questions, randomly pick answer 0 or 1)
   - Run each through `computeScores` + `classify`
   - Assert all 6 archetypes appear at > 5% frequency
   - Assert no archetype exceeds 35% frequency
3. If distribution fails, adjust classifier thresholds (not question scoring)
4. **This test becomes a regression gate for all future scoring changes**

**Phase 3: UI Implementation (1-2 days, parallelizable sub-tasks)**
These are independent and can be built simultaneously:

3a. **Forced-choice question rendering** in quiz.astro
   - Add `format`-based conditional rendering in the `{questions.map()}` block
   - Responsive: side-by-side on desktop, stacked on mobile
   - Intake questions rendered in a distinct section before scored questions
   - Progress bar counts only scored questions (12)
   - Update intro copy ("Twelve questions, three minutes...")

3b. **Email gate** (Flaw 6)
   - New `<section id="email-gate" class="quiz-step">` after last scored question
   - Form fields: firstName (optional), email (required), website (honeypot, hidden)
   - Submit handler: async POST to `/api/quiz-submit`
   - Loading state, error handling, success -> proceed to results
   - "Skip" link that bypasses API and goes directly to results
   - See Section 4 below for exact code

3c. **Calculating interstitial** (Flaw 9)
   - New `<section id="quiz-calculating" class="quiz-step">` between email gate and results
   - CSS-only animation (pulsing glyph, card shimmer)
   - 2.5s auto-advance timer to results

3d. **Answer shuffle** (Flaw 10)
   - Fisher-Yates on the 2 answer buttons within each question step
   - Cache shuffle order per question in state (for back-navigation consistency)
   - Call in `showStep()` before revealing the step

3e. **Auto-advance delay** (Flaw 8)
   - Change `500` to `800` (or a named constant)
   - One line

**Phase 4: Integration + Polish (1 day)**
1. Full flow smoke test: intro -> intake -> 12 scored questions (shuffled, forced-choice) -> email gate -> calculating -> results
2. Update E2E tests (quiz-flow.spec.ts) for new flow
3. Update intro screen copy
4. Verify quiz-submit API with forced-choice payloads
5. Run full test suite (`vitest run` + `playwright test`)
6. Archetype distribution acceptance test from Phase 2 must pass

### Revised File Manifest

| File | Phase | Changes |
|------|-------|---------|
| `src/lib/quiz-data.ts` | 1 | New question set: 2 intake + 12 forced-choice scored. `QuestionFormat` type. `w()` returns +3. |
| `src/lib/classifier.ts` | 2 | Optional: positive Ascending Seeker condition. Otherwise unchanged. |
| `src/pages/quiz.astro` | 3 | Format-conditional rendering, email gate section, calculating section, shuffle, auto-advance constant, progress bar adjustment, updated intro copy. |
| `src/pages/api/quiz-submit.ts` | -- | **No changes needed.** Validation auto-adapts from quiz-data. |
| `tests/quiz-data.test.ts` | 1 | Rewrite: 12 scored, 2 intake, 2 answers per scored Q, all weights +3, dimension pair coverage. |
| `tests/classifier.test.ts` | 1-2 | `classify()` tests unchanged. `computeScores` integration tests rewritten with new IDs. Distribution test added. |
| `tests/quiz-submit.test.ts` | 1 | **Mostly unchanged.** `buildValidAnswers()` auto-adapts. May need minor adjustment if structural tests assert specific counts. |
| `tests/quiz-submit-medium.test.ts` | 1 | Same as above -- auto-adapts. |
| `tests/archetype-distribution.test.ts` | 2 | **New.** Monte Carlo distribution validation. |

### Revised Complexity Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Content bottleneck: operator must write 24 desirability-matched statements | **HIGH** | Phase 0 is non-engineering. Draft AI-assisted candidates for operator review. Do not begin Phase 1 until content is approved. |
| Position bias with only 2 options | MEDIUM | Fisher-Yates shuffle is mandatory (Phase 3d). Additionally, consider alternating which option loads which dimension across the two questions per pair. |
| Archetype distribution skew | MEDIUM | Monte Carlo test (Phase 2) is the gate. Run before UI work. If distribution is unacceptable, adjust classifier before touching UI. |
| Test blast radius from question set change | MEDIUM (down from HIGH) | Forced-choice simplifies the test surface. Fewer answers, no dual-scorers, auto-adapting helpers in quiz-submit tests. |
| Email gate kills completion rate | MEDIUM | Include "skip" option. Track skip rate via GA4 event. |
| Forced-choice feels clinical | LOW | Wrap in scenario framing ("When facing uncertainty, I tend to..."). The Daydreamer's examples show this works. |
| Score ties increase with fewer data points | LOW | The priority cascade handles ties deterministically. Document priority order in archetype content so operators understand the tiebreaking behavior. |

---

## 4. Email Gate Wiring: Exact Code Changes

The quiz-submit API is fully built and tested. It has never been called. Here is exactly what needs to happen to wire it.

### 4a. New HTML Section in quiz.astro

Add after the last question section and before the results section:

```html
<!-- Email Gate -->
<section id="email-gate" class="quiz-step">
  <div class="glass-panel p-8 md:p-12 rounded-lg text-center">
    <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
    <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
    <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
    <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

    <div class="mb-6">
      <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>
      <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans">Your Reading Is Ready</p>
    </div>

    <h2 class="font-serif text-2xl md:text-3xl text-hermetic-white mb-4 leading-tight tracking-wide">
      Where should we<br><span class="text-hermetic-gold italic">send your results?</span>
    </h2>

    <p class="text-gray-300 font-light font-sans mb-8 max-w-md mx-auto leading-relaxed">
      Get your full archetype reading and a personalized journey guide.
    </p>

    <form id="email-form" class="max-w-sm mx-auto space-y-4" novalidate>
      <!-- Honeypot (hidden from humans) -->
      <div class="absolute -left-[9999px]" aria-hidden="true">
        <input type="text" name="website" id="gate-website" tabindex="-1" autocomplete="off" />
      </div>

      <input
        type="text"
        id="gate-firstName"
        name="firstName"
        placeholder="First name (optional)"
        class="w-full px-4 py-3 bg-hermetic-void/50 border border-hermetic-gold/20 rounded-lg text-hermetic-white font-sans placeholder:text-hermetic-gold/30 focus:border-hermetic-gold/50 focus:outline-none transition-colors"
      />

      <input
        type="email"
        id="gate-email"
        name="email"
        placeholder="Email address"
        required
        class="w-full px-4 py-3 bg-hermetic-void/50 border border-hermetic-gold/20 rounded-lg text-hermetic-white font-sans placeholder:text-hermetic-gold/30 focus:border-hermetic-gold/50 focus:outline-none transition-colors"
      />

      <p id="gate-error" class="text-red-400 text-sm font-sans hidden"></p>

      <button
        type="submit"
        id="gate-submit"
        class="btn-flame w-full px-8 py-4 text-white font-sans font-bold text-sm tracking-widest uppercase"
      >
        Reveal My Archetype
      </button>
    </form>

    <button
      id="gate-skip"
      class="mt-4 text-hermetic-gold/30 text-xs font-sans hover:text-hermetic-gold/50 transition-colors tracking-wider uppercase"
    >
      Skip and see results
    </button>
  </div>
</section>
```

### 4b. Script Changes in quiz.astro

Three modifications to the `<script>` block:

**1. Modify the step routing to insert email gate before results:**

```typescript
// Current: after last question, show results
// New: after last question, show email gate

const SCORED_QUESTIONS = questions.filter(q => q.scored);
const TOTAL_STEPS = questions.length; // intake + scored
const EMAIL_GATE_STEP = TOTAL_STEPS + 1;
const CALCULATING_STEP = TOTAL_STEPS + 2;
const RESULTS_STEP = TOTAL_STEPS + 3;

// In the auto-advance click handler, change the final routing:
autoAdvanceTimer = setTimeout(() => {
  autoAdvanceTimer = null;
  const nextStep = state.currentStep + 1;
  if (nextStep <= TOTAL_STEPS) {
    showStep(nextStep);
  } else {
    showStep(EMAIL_GATE_STEP);
  }
}, 800);
```

**2. Add the email submission handler:**

```typescript
async function submitEmailGate(email: string, firstName: string, honeypot: string): Promise<void> {
  const errorEl = requireEl('gate-error');
  const submitBtn = requireEl('gate-submit') as HTMLButtonElement;

  // Client-side validation
  if (!email || !email.includes('@') || !email.includes('.')) {
    errorEl.textContent = 'Please enter a valid email address.';
    errorEl.classList.remove('hidden');
    return;
  }

  // Disable button, show loading
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  errorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/quiz-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName,
        answers: state.answers,
        website: honeypot,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Something went wrong. Please try again.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reveal My Archetype';
      return;
    }

    // Success -- track and proceed
    if (typeof gtag === 'function') {
      gtag('event', 'email_captured', {
        event_category: 'quiz',
        archetype: data.archetype,
      });
    }
    if (typeof fbq === 'function') {
      fbq('track', 'Lead', { content_name: 'quiz_email' });
    }

    showStep(CALCULATING_STEP);
  } catch (err) {
    errorEl.textContent = 'Network error. Please check your connection and try again.';
    errorEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Reveal My Archetype';
  }
}
```

**3. Wire the form and skip button:**

```typescript
// Email form submission
const emailForm = requireEl('email-form') as HTMLFormElement;
emailForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = (requireEl('gate-email') as HTMLInputElement).value.trim();
  const firstName = (requireEl('gate-firstName') as HTMLInputElement).value.trim();
  const honeypot = (requireEl('gate-website') as HTMLInputElement).value;
  submitEmailGate(email, firstName, honeypot);
});

// Skip button
requireEl('gate-skip').addEventListener('click', () => {
  if (typeof gtag === 'function') {
    gtag('event', 'email_skipped', { event_category: 'quiz' });
  }
  showStep(CALCULATING_STEP);
});
```

**4. Update showStep() to handle the new steps:**

```typescript
function showStep(step: number) {
  state.currentStep = step;

  allSteps.forEach(el => {
    if (el.classList.contains('active')) {
      el.classList.add('exiting');
      el.classList.remove('active');
    }
  });

  setTimeout(() => {
    allSteps.forEach(el => el.classList.remove('exiting'));

    if (step === 0) {
      allSteps[0].classList.add('active');
      progressBar.style.opacity = '0';
    } else if (step <= TOTAL_STEPS) {
      // Question step (intake or scored)
      const stepEl = document.querySelector<HTMLElement>(`[data-step="${step}"]`);
      if (stepEl) {
        stepEl.classList.add('active');
        const qId = questions[step - 1].id;
        if (state.answers[qId]) {
          const btn = stepEl.querySelector(`[data-answer="${state.answers[qId]}"]`);
          if (btn) btn.classList.add('selected');
        }
      }
      // Show progress only for scored questions
      const scoredIndex = SCORED_QUESTIONS.findIndex(q => q.number === questions[step - 1]?.number);
      if (scoredIndex >= 0) {
        progressBar.style.opacity = '1';
        const pct = (scoredIndex / SCORED_QUESTIONS.length) * 100;
        progressFill.style.width = `${pct}%`;
        progressText.textContent = `${scoredIndex + 1} of ${SCORED_QUESTIONS.length}`;
      } else {
        progressBar.style.opacity = '0'; // hide for intake questions
      }
    } else if (step === EMAIL_GATE_STEP) {
      progressBar.style.opacity = '0';
      requireEl('email-gate').classList.add('active');
    } else if (step === CALCULATING_STEP) {
      progressBar.style.opacity = '0';
      requireEl('quiz-calculating').classList.add('active');
      // Auto-advance to results after 2.5s
      setTimeout(() => showStep(RESULTS_STEP), 2500);
    } else if (step === RESULTS_STEP) {
      progressBar.style.opacity = '0';
      requireEl('quiz-results').classList.add('active');
      revealResults();
    }
  }, 250);
}
```

### 4c. What quiz-submit.ts Already Handles

No changes needed to the API. Here is what already works:

- Email validation (SYN-03): regex, length, format checks
- firstName validation: optional, type-checked, length-capped
- Honeypot check (SYN-05): rejects non-empty `website` field
- Answer validation (SYN-02): all scored questions answered, valid IDs, no cross-question reuse
- Rate limiting (SYN-04): 10 global, 3 per email
- Server-side classification: runs `computeScores()` + `classify()` independently of client
- Loops.so push: sends archetype, scores, segmentation data
- Fetch timeout (SYN-06): AbortController with 5s timeout
- Error handling: structured JSON errors for every failure mode

The only thing the API does NOT handle is the "skip" path. If the user skips, the client-side `revealResults()` runs `computeScores()` + `classify()` directly -- which is what already happens today. The skip path is the current behavior. The email path is the new behavior that calls the existing API.

### 4d. Effort Estimate for Email Gate Wiring

- HTML section: 30 minutes (the template above is nearly production-ready)
- Script changes: 2 hours (form handler, step routing, error states, analytics events)
- Testing: 1 hour (manual flow testing, E2E test updates)
- **Total: half a day**, confirming my Round 1 estimate

---

## Summary: What Changed from Round 1

| Aspect | Round 1 | Round 2 |
|--------|---------|---------|
| Question format | Keep 4-option single-select, add variety via `questionType` (HIGH complexity) | Forced-choice paired comparisons: 2-option for all scored questions (LOW complexity) |
| Number of scored questions | 8-9 (cut from 15) | 12 (new forced-choice) |
| Scoring model | Variable weighting +2/+4/+6 | Ipsative +3/+0 per pair |
| Dual-scored answers | Keep Q7-E, Q8-E pattern, add B+C dual-scorer | **Eliminated.** Combos emerge from pair patterns |
| Classifier changes | Add positive AS condition, relax combo thresholds | **None required for MVP.** Existing cascade works. Optional AS enhancement in Phase 2 |
| Test blast radius | HIGH (562 tests, many hard-coded IDs) | MEDIUM (auto-adapting helpers, simpler scoring surface) |
| New dependencies | None | None |
| Content creation burden | Moderate (cut questions, rewrite some) | **High** (write 24 new statements from scratch). This is the bottleneck. |
| Total implementation time | ~5 days (Phases 1-4) | ~3-4 days (Phases 1-4), gated by Phase 0 content design |
| UI complexity | 4 rendering paths (single-select, forced-rank, scenario-react, spectrum) | 2 rendering paths (paired_comparison, single_select for intake) |

**My position:** Forced-choice paired comparisons are the right call. They solve Flaws 1, 3, and 7 at the format level rather than patching them individually. The engineering is simpler. The psychometric properties are stronger. The only risk is content creation quality, and that is the operator's domain, not mine.
