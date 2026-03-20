# Round 1: Devil's Advocate -- Quiz Design Overhaul

**Role:** Adversarial stress-testing. What breaks, when, and how badly.

**Vote:** CONDITIONAL APPROVE -- no BLOCK-worthy showstoppers, but 2 Critical
and 3 High risks that must be mitigated before execution or the project will
regret it.

---

## Risk Register

### RISK-01: Question Rewrite Voice Fidelity (CRITICAL)

**What breaks:** The quiz questions were written by a human domain expert with a
specific voice -- mystical but grounded, precise but warm. Compare Q1's "You're
awake at 2am with something weighing on you" with a typical LLM rewrite like
"When facing a difficult situation, which approach resonates most?" The current
questions have specificity, emotional texture, and first-person intimacy. LLM
rewrites flatten this into generic self-assessment language.

**Under what conditions:** Any time an LLM generates the replacement questions
without the operator (Taylor Quigley) reviewing and rewriting. This is
particularly dangerous because the stated goal -- "inter-dimension tension" --
is a structural/scoring objective, not a content objective. A coder or LLM will
optimize for scoring variance and produce psychometric-sounding questions that
lose the tarot/aerial/mystical vocabulary that makes this quiz feel like an
experience rather than a personality test.

**Quantified risk:** 15 scored questions must be rewritten. Each one is a
content artifact, not a code artifact. If even 5 of them lose voice fidelity,
the quiz shifts from "mystical self-discovery" to "BuzzFeed which element are
you" territory. The quiz is the TOP of the funnel. Voice damage here propagates
to every downstream conversion.

**Mitigation:**
- Operator writes or co-writes every question. LLM can generate structural
  variants (which dimensions each answer touches) but the operator writes the
  actual copy.
- A/B test current vs. new questions on completion rate before cutting over
  fully. The proposed autoresearch loop for quiz wording (already in Ideas
  backlog) is the right vehicle for this.
- Define a "voice rubric" before rewriting: specificity level, emotional
  register, vocabulary domain. Review each question against it.

**Severity:** CRITICAL. This is the highest risk in the entire proposal because
it is irreversible in practice -- once the quiz is live with new copy and emails
are flowing, reverting means re-classifying in-flight users.

---

### RISK-02: Email Gate Completion Rate Cliff (CRITICAL)

**What breaks:** Currently, the quiz flow is:

```
Intro -> Q1..Q20 -> Results (instant) -> Share/CTA
```

No email is collected during the quiz. Email collection happens only on the
`/archetype/[slug]` journey page (journey_subscribe) or the `/launch` page
(launch_notify), both of which are post-result CTAs.

The proposal adds an email gate *before* full results. This creates:

```
Intro -> Q1..Q12 -> Email Gate -> Results -> Share/CTA
```

Industry data (Interact 2026 Quiz Conversion Report): 65% of quiz starters
complete all questions, but only 40.1% convert to leads (provide email). That is
a ~38% relative drop at the email gate. For a niche/mystical product, expect
the drop to be worse -- this audience is privacy-sensitive and allergic to
"give us your email to see your results" dark patterns.

**Under what conditions:** Every single quiz taker hits this wall. There is no
segmentation, no grace period, no way to A/B test without building the
infrastructure first.

**Quantified risk:** If current quiz completion is ~65% of starters (industry
baseline), adding an email gate could drop effective completions to ~40% of
starters. That means ~38% fewer people see their archetype result page, which
means ~38% fewer shares, ~38% fewer journey page visits, and ~38% fewer
Kickstarter conversions. For a product targeting an 8/8/26 launch with a
funnel that depends on viral sharing, this is potentially fatal.

**But also consider the upside:** The current flow collects zero emails from
quiz completers who do not click through to a journey page. If only 20% of
quiz completers click the journey CTA, you are losing 80% of leads. An email
gate captures 40-60% of completers' emails. Net email capture likely *increases*
even with the completion rate drop.

**Mitigation:**
- Do NOT gate full results. Instead, show the archetype name + teaser
  description (what is already rendered in `revealResults()`) freely, then gate
  the *deep dive* journey page content behind email. This preserves the dopamine
  hit of "you're The Shadow Dancer" and the share impulse while still creating
  email capture incentive.
- If a hard gate is non-negotiable: implement it as an interstitial that can be
  dismissed (email optional, with a "skip for now" link), and track the skip
  rate. This gives data before committing.
- Never ship the email gate without A/B testing infrastructure. The Interact
  data says 40% convert -- but that is across all industries. For this audience,
  it could be 20% or 60%. You need data, not assumptions.

**Severity:** CRITICAL. Wrong implementation permanently damages the funnel
during the most important pre-launch acquisition window.

---

### RISK-03: Classifier Backward Incompatibility (HIGH)

**What breaks:** 14 existing quiz submissions were processed through the current
classifier. Those users received an archetype classification and were pushed to
Loops.so with that archetype as a contact property. Their email drip sequences
are keyed to that archetype. Their journey page experience is keyed to that
archetype.

Changes to the classifier (fixes 2, 3, 7) mean the same answer patterns would
now produce different archetype results. Specifically:

1. **Fix 2 (Ascending Seeker fallback removal):** Currently, any C-dominant
   pattern that does not meet Flow Artist's strict B>A AND C>D condition falls
   through to Ascending Seeker. Adding positive detection for Ascending Seeker
   changes which score patterns land there vs. elsewhere.

2. **Fix 3 (Flow Artist + Grounded Mystic reachability):** The current
   classifier has reachability issues documented in the tests -- Flow Artist
   requires B AND C to STRICTLY dominate A AND D, and Grounded Mystic requires
   A AND D to STRICTLY dominate B AND C. With flat +4 scoring and 15 questions,
   ties are common. The strict inequality means many "should-be" Flow Artists
   or Grounded Mystics end up as Air Weavers (priority 3 >= comparison wins
   ties) or Ascending Seekers (fallback). Fixing this changes classification
   for any user whose scores had ties.

3. **Fix 7 (Variable scoring weights):** This changes every score calculation.
   Even if the classifier logic stays identical, different weights mean different
   raw scores mean different classifications for the same answer selections.

**Under what conditions:** Any time the 14 existing users re-take the quiz,
visit their archetype page, or receive an email referencing their archetype.

**Quantified risk:** 14 users is small, but these are early adopters -- the
most engaged, most likely to notice, most likely to evangelize (or complain).
If User #3 was classified as "The Air Weaver," received 3 emails about Air
Weaver energy, and then re-takes the quiz and gets "The Grounded Mystic," that
is a trust-breaking experience.

**Mitigation:**
- Accept that 14 users is below the threshold where backward compatibility
  matters commercially. Document the decision.
- Do NOT re-classify existing Loops.so contacts. Their archetype is baked into
  their email sequence. Let them keep it.
- Add a version field to the quiz submission payload and Loops.so contact
  properties (e.g., `quizVersion: 2`). This allows the email system to
  distinguish v1 and v2 classifications.
- Consider offering re-take to existing users with messaging that acknowledges
  the update: "We've refined our archetype quiz -- want to see if your result
  has changed?"

**Severity:** HIGH. Small blast radius (14 users) but disproportionate trust
impact if mishandled.

---

### RISK-04: Segmentation Data Loss from Question Cuts (HIGH)

**What breaks:** The quiz currently has 5 non-scored questions that feed
segmentation data to Loops.so:

| Question | Loops.so Property | Purpose |
|----------|-------------------|---------|
| Q2 (Tarot experience level) | `experienceLevel` | Email tone calibration |
| Q3 (Biggest frustration) | `painPoint` | Email content targeting |
| Q11 (Flow state description) | `flowState` | Psychographic segmentation |
| Q19 (Card back preference) | `cardBackPref` | Product research |
| Q20 (Desired learning format) | `productInterest` | Product research |

The server-side code in `quiz-submit.ts` (lines 260-264) explicitly extracts
these five non-scored answers and pushes them to Loops.so as contact properties.
The email sequences are designed to use `experienceLevel` and `painPoint` for
content personalization.

Fix 5 proposes cutting from 20 to 10-12 questions, with "3-5 non-scored
segmentation questions might get cut entirely."

**Under what conditions:** If any of Q2, Q3, Q19, Q20 are cut (Q11 is already
in the middle of the quiz and likely survives).

**Quantified risk:**
- Cutting Q2 loses experience-level segmentation for ALL future contacts.
  Beginners and experienced users get identical email sequences.
- Cutting Q3 loses pain-point data, which is the primary hook for email subject
  lines ("Still struggling with memorizing 78 cards?" only works if you know
  that is their pain point).
- Cutting Q19/Q20 loses product research data that directly informs Kickstarter
  tier design and stretch goal decisions. With only 14 submissions so far, there
  is not enough data to safely stop collecting this.

**Mitigation:**
- Separate the question cuts into two categories: "reduce scored questions" and
  "relocate non-scored questions." Do not conflate them.
- Move Q19 and Q20 to a post-result "bonus" survey (even a single screen: "Two
  quick questions to help us build the right deck for you"). This preserves the
  data without bloating the scored quiz.
- Q2 and Q3 can potentially be inferred from scored answers (experience level
  correlates with archetype; pain points correlate with dimension scores). But
  inference is lossy and adds maintenance burden. Keeping them is cheaper.
- At minimum, keep Q2 (experience level) in the quiz. It is 1 question, takes
  5 seconds, and provides the highest-value segmentation signal.

**Severity:** HIGH. Losing segmentation data is invisible damage -- you will
not notice until email open rates diverge and you cannot explain why.

---

### RISK-05: Variable Scoring Weight Maintenance Burden (HIGH)

**What breaks:** The current scoring is elegant in its simplicity: every scored
answer gives exactly +4 to exactly one dimension (except Q7-E and Q8-E which
dual-score). The test contract enforces this (see `quiz-data.test.ts` lines
157-165: "every scoring weight across all questions is exactly +4 points").

Fix 7 proposes variable scoring weights. This means:
- The `w()` helper function must be extended or replaced.
- Every test that asserts `points: 4` must be updated.
- The frozen test file for `quiz-data.test.ts` (SHA256 baseline) is invalidated.
- Score magnitude math becomes harder to reason about (is a {A:3, D:2} answer
  more or less impactful than a {B:4} answer? Depends on question count per
  dimension and total weight distribution).
- Classifier thresholds may need recalibration -- the current classifier uses
  strict/non-strict inequalities, not magnitude thresholds, so it is somewhat
  weight-agnostic. But the *practical reachability* of each archetype changes
  when weights vary.

**Under what conditions:** Any time the quiz needs tuning. Variable weights
create a parameter space that is opaque to the operator. "Why am I getting too
many Air Weavers?" requires analyzing the full weight matrix, not just counting
questions per dimension.

**Quantified risk:** The current system has 15 questions * 4 answers = 60
scoring entries, all with identical weight. Variable weights turns this into 60
independent parameters. The search space for "balanced archetype distribution"
grows from trivial (count questions per dimension) to combinatorial (optimize
60 weights subject to 6 distribution constraints). This is the kind of
complexity that accumulates maintenance debt silently.

**Mitigation:**
- Start with 2-level weighting, not continuous: "strong signal" (+6) and
  "normal signal" (+4). This gives tension without creating a 60-parameter
  optimization problem.
- Document the weight rationale per question in the code comments (as the
  current Tally corrections are documented). This is a content decision, not a
  code decision.
- Build a diagnostic tool BEFORE changing weights: a script that takes the
  current question data and simulates all possible answer combinations to show
  archetype distribution. This lets the operator see the impact of weight
  changes before deploying them. Without this tool, weight tuning is blind.
- Do NOT introduce continuous weights (1-10 scale). The marginal value over
  2-level weighting does not justify the complexity.

**Severity:** HIGH. Not because it will break immediately, but because it
creates ongoing maintenance debt that compounds with every future quiz change.

---

### RISK-06: Test Contract Cascade Failure (MEDIUM)

**What breaks:** The codebase has a rigorous frozen-test-file protocol with
SHA256 baselines. The quiz data tests (`quiz-data.test.ts`, 613 lines) encode
extremely specific structural contracts:

- Exactly 20 questions (line 49)
- Exactly 15 scored, 5 non-scored (lines 95-103)
- Non-scored are exactly Q2, Q3, Q11, Q19, Q20 (line 106)
- Every scoring weight is exactly +4 (line 157)
- Only Q7-E and Q8-E have dual scoring (line 456)
- All 12 clean questions follow A=A, B=B, C=C, D=D pattern (line 479)

The classifier tests (`classifier.test.ts`, 839 lines) encode the priority
cascade with specific score-to-archetype mappings.

The quiz-submit tests (`quiz-submit.test.ts`, 712 lines) encode server-side
validation logic including "all scored questions must be answered."

Every single one of these tests will fail after the proposed changes. This is
not a bug -- it is the tests doing their job. But the *volume* of test changes
required is itself a risk: when you change 1500+ lines of test contracts
simultaneously, you lose the safety net that those tests provide.

**Under what conditions:** During implementation. The period between "old tests
deleted" and "new tests passing" is a vulnerability window where regressions
can hide.

**Mitigation:**
- Follow the frozen-test-file protocol strictly: write new test contracts
  FIRST (defining the new structural expectations), THEN implement to make
  them pass. Never delete old tests until new ones are green.
- Phase the changes: quiz data structure changes first (with new test
  contracts), then classifier changes (with new test contracts), then
  integration. Never change both simultaneously.
- Maintain a compatibility shim during transition: the old `questions` array
  and old `classify()` function should remain importable (as `questionsV1`,
  `classifyV1`) until all downstream consumers are updated.

**Severity:** MEDIUM. Well-mitigated by the existing FTF protocol if followed
diligently. Becomes HIGH if the protocol is skipped "to move faster."

---

### RISK-07: Auto-Advance UX Regression (MEDIUM)

**What breaks:** Fix 8 proposes fixing auto-advance UX. The current
implementation (quiz.astro lines 337-367) has a 500ms auto-advance timer with
cancellation on back navigation -- this was already hardened as SYN-01. The
current behavior works: select answer, see visual feedback (selected state),
auto-advance after 500ms, back button cancels pending advance.

The risk is that "fixing" auto-advance introduces NEW UX issues:
- If the delay is increased (e.g., to 1000ms for "consideration time"), users
  who are quick and decisive will feel the quiz is sluggish.
- If auto-advance is removed entirely and replaced with explicit "Next" buttons,
  the quiz UX shifts from "flowing experience" to "form filling."
- If the delay becomes variable (shorter for non-scored, longer for scored),
  the inconsistency is jarring.

**Under what conditions:** Any change to the auto-advance timing or behavior
affects every single quiz interaction.

**Mitigation:**
- Define the specific UX problem being solved before implementing. "Fix
  auto-advance" is too vague. Is the problem that 500ms is too fast? Too slow?
  That users cannot review their choice? That there is no visual confirmation?
- If the fix is "add a confirmation moment," consider showing a brief checkmark
  animation (200ms) before the 500ms advance timer starts, for a total of 700ms
  of visible feedback. This is better than simply increasing the delay.
- Test with real users (even 3-5) before shipping. Auto-advance UX is
  notoriously personal -- what feels "too fast" to one user feels "just right"
  to another.

**Severity:** MEDIUM. The current UX works. Changes are improvements, not
fixes, and improvements can regress.

---

### RISK-08: Answer Randomization Breaks Position Signal (MEDIUM)

**What breaks:** Fix 10 proposes randomizing answer order. The current quiz
has a consistent A/B/C/D answer order that maps to dimensions A/B/C/D across
most questions. This means:
- The first answer is always the "logical/analytical" (Air Weaver) option.
- The second answer is always the "body/physical" (Embodied Intuitive) option.
- The third is "flow/surrender" (Ascending Seeker).
- The fourth is "depth/shadow" (Shadow Dancer).

Users who pick "always the first answer" or "always the last answer" will
currently get a consistent archetype. Randomization fixes this positional bias,
which is good. But it also:

1. **Breaks any secondary signal from answer position.** If you ever wanted to
   analyze "do people who consistently pick the first option differ from those
   who read all options?" you lose that ability.

2. **Changes the perceived difficulty of each question.** When the "logical"
   answer is always first, analytical users find the quiz easy (their answer
   is always immediately visible). When randomized, they must read all 4-5
   options every time, increasing cognitive load and time-to-completion.

3. **Complicates debugging and QA.** "User reported Q7 was confusing" -- which
   order did they see? Log data must now include answer order per question.

**Under what conditions:** Every quiz interaction is affected.

**Quantified risk:** Positional bias is real -- research shows ~15% selection
bias toward the first option in unordered lists. Randomization is the correct
fix. The cost is modest (lost positional signal is low-value, debugging
complexity is manageable).

**Mitigation:**
- Randomize on client side at quiz start time using a seeded PRNG (seed =
  session timestamp). Log the seed so answer order is reproducible for debugging.
- Store the seed in the quiz submission payload so server-side analysis can
  reconstruct the presented order.
- Implement randomization AFTER the question rewrite (Fix 1), not before. The
  rewrite should fix the A=A, B=B pattern at the content level; randomization
  is defense-in-depth.

**Severity:** MEDIUM. The fix is correct and the risks are manageable.

---

### RISK-09: Calculating Interstitial as Dark Pattern (LOW)

**What breaks:** Fix 9 proposes adding a "calculating your results" interstitial
animation. The classification is instantaneous (it is a simple comparison of 4
integers). The interstitial is pure theater -- it adds perceived value through
artificial delay.

The risk is not technical. It is brand-trust:
- The target audience (tarot practitioners, spiritually-oriented, generally
  skeptical of corporate marketing tactics) may perceive a fake loading screen
  as dishonest.
- If the interstitial says "Analyzing your responses..." and takes 3 seconds
  when the real computation takes 0.001 seconds, that is a 3000x exaggeration.
- Competitors (Interact, Typeform, etc.) all use this pattern, so users are
  accustomed to it. But "everyone does it" is not the same as "it is right
  for this brand."

**Under what conditions:** Every quiz completion. The interstitial is between
the last answer and the result reveal.

**Mitigation:**
- Frame the interstitial as an experiential moment, not a fake computation.
  Instead of "Calculating your archetype..." use something like "Preparing
  your revelation..." or a tarot-themed card-shuffling animation. This is
  honest (you ARE preparing to show them something) without pretending the
  computer is working hard.
- Keep it short: 1.5-2 seconds maximum. The current result reveal already has
  a staggered animation (result-glow, result-label, result-divider, result-
  title, result-element, result-description -- see quiz.astro lines 264-275)
  that takes ~1.5 seconds. Adding another 2 seconds of fake loading before
  this makes the total reveal time 3.5 seconds, which is too long.
- Test: does the interstitial increase or decrease share rate? If people share
  less after seeing a loading screen, the theater is hurting rather than helping.

**Severity:** LOW. Unlikely to cause measurable harm. Just do it tastefully.

---

### RISK-10: Scope Creep -- 10 Fixes as One Project (LOW)

**What breaks:** The 10 proposed fixes span 4 different concerns:

1. **Content:** Fixes 1, 2, 3 (question rewriting, archetype detection)
2. **UX:** Fixes 4, 5, 8, 9, 10 (question flow, quiz length, auto-advance,
   interstitial, randomization)
3. **Architecture:** Fix 7 (variable scoring weights)
4. **Growth:** Fix 6 (email gate)

Bundling all 10 into one project creates coupling where none exists. The email
gate (Fix 6) has nothing to do with answer randomization (Fix 10). Question
rewrites (Fix 1) should not be blocked by variable weight implementation
(Fix 7). But if they are planned as a single deliverable, a delay in any one
fix delays all of them.

**Under what conditions:** When the implementation timeline encounters real
constraints (operator availability for question writing, A/B test data needed
for email gate decisions, etc.).

**Mitigation:**
- Split into 3 independent work streams:
  - **Stream A (Content):** Fixes 1, 2, 3. Operator-dependent. Longest lead
    time. Start first.
  - **Stream B (UX/Code):** Fixes 4, 5, 8, 9, 10. Developer work. Can
    parallelize with Stream A.
  - **Stream C (Growth):** Fix 6. Requires A/B test infrastructure. Ship after
    Streams A and B are stable.
  - Fix 7 (variable weights) should be Stream D, shipped ONLY if the
    distribution diagnostic tool shows the fixed classifier still produces
    unbalanced distributions with flat weights.
- Each stream ships independently. No stream blocks another.

**Severity:** LOW. This is a project management risk, not a technical risk. But
it becomes HIGH if ignored and the project slips past the 8/8/26 launch date.

---

## Cross-Cutting Concerns

### The "Ship of Theseus" Problem

After all 10 fixes: different questions, different scoring, different
classification logic, different question count, different UX flow, different
answer order. This is not a quiz redesign -- it is a new quiz. The operator
should be explicit about this: "We are building Quiz v2." Framing it as "10
fixes" understates the magnitude and can lead to under-scoped testing.

### The 14-User Cohort

Every analysis above references the 14 existing submissions. This is both a
blessing (small blast radius for backward-incompatible changes) and a curse
(too small for any statistical significance in A/B tests). The implication:
there is no way to validate these changes with data before launching them.
The operator must make judgment calls based on quiz design principles, not
metrics. This is fine -- but it means the "autoresearch" pattern cannot help
here yet.

### The Frozen Test File Domino

The FTF protocol is the codebase's strongest safety mechanism. This project
will invalidate 3 SHA256 baselines simultaneously (quiz-data, classifier,
quiz-submit). That has never happened before in this codebase. The protocol
is designed for single-module changes, not coordinated multi-module rewrites.
Plan for this explicitly: which baselines are invalidated, in what order, and
what is the verification sequence after each one.

---

## Summary: Risk-Ranked Action Items

| # | Risk | Severity | Action Required Before Execution |
|---|------|----------|----------------------------------|
| 1 | Voice fidelity loss in question rewrites | CRITICAL | Operator writes copy. Voice rubric defined. LLM assists with structure only. |
| 2 | Email gate completion rate cliff | CRITICAL | Gate deep-dive content, not result reveal. A/B test before committing. Ship as independent stream. |
| 3 | Classifier backward incompatibility | HIGH | Version field in payload. Do not re-classify existing contacts. Document decision. |
| 4 | Segmentation data loss from question cuts | HIGH | Relocate non-scored Qs to post-result screen, do not delete. Keep Q2 minimum. |
| 5 | Variable weight maintenance burden | HIGH | Start with 2-level only. Build distribution diagnostic tool first. |
| 6 | Test contract cascade failure | MEDIUM | Phase changes. Write new contracts before deleting old ones. Follow FTF strictly. |
| 7 | Auto-advance UX regression | MEDIUM | Define specific problem. Test with real users. Keep current UX as baseline. |
| 8 | Answer randomization signal loss | MEDIUM | Log PRNG seed. Implement after question rewrite. |
| 9 | Calculating interstitial as dark pattern | LOW | Frame as experiential, not computational. Keep under 2s. |
| 10 | Scope creep from bundled fixes | LOW | Split into 3-4 independent streams. No cross-stream blocking. |
