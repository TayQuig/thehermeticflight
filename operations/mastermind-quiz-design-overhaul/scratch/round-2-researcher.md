# Round 2 -- Researcher Analysis

## Role
Researcher -- providing corrected evidentiary foundation after Round 1
fact-checking.

## New Research Artifacts Produced

All artifacts saved to `operations/mastermind-quiz-design-overhaul/`:

1. `research-email-gate-conversion-clarification.md` -- Corrects the 92-97%
   claim, derives the actual 62% figure, reconciles Researcher and DA frames
2. `research-ipsative-scoring-4-dimensions.md` -- Comprehensive literature
   review on why 4-dimension ipsative instruments fail
3. `research-skip-vs-mandatory-email-gates.md` -- Skip option data (mostly
   absent), partial-reveal strategy, audience proxy data

---

## FACT-CHECK 1: Email Gate Conversion Numbers

### Correction Issued

My Round 1 claim that "92-97% of quiz completers submit when gated before
results" was **WRONG**. I am issuing a formal correction.

**What Interact actually reports:**
- 65% of quiz starters complete all questions (start-to-finish)
- 40.1% of quiz starters become leads (start-to-lead)
- The report does NOT separately report gate conversion rate

**Derived gate conversion rate:** 40.1% / 65% = **61.7%**

This means approximately 62% of quiz completers provide their email at the
gate -- not 92-97%.

**Where the error came from:** I cited The Well-Paid Expert and Dupple as
sources for a "97% completion of opt-in form" claim. On re-examination:
- The Well-Paid Expert page contains NO such statistic (verified via WebFetch)
- Dupple explicitly states "30-40% opt-in rates" (contradicts the claim)
- A Thrive Themes case study may have shown ~97% gate conversion for ONE
  specific quiz, but this is a single case study, not an industry benchmark

**The Devil's Advocate was right.** The ~38% relative drop at the gate is the
correct interpretation of the Interact data.

**Corrected data table:**

| Metric | Value | Confidence |
|--------|-------|-----------|
| Start-to-lead rate | 40.1% | HIGH (Interact, 80M+ leads) |
| Start-to-finish rate | 65% | HIGH (Interact) |
| Gate conversion (derived) | ~62% | HIGH (mathematical derivation) |
| Relative drop at gate | ~38% | HIGH (mathematical derivation) |
| Gate conversion for coaching/courses | ~76% | MEDIUM (industry proxy) |

**Impact on design**: The email gate is still strongly recommended (capturing
40% of starters as leads vs. 0% today is transformative), but the expectation
should be that ~38% of completers will bounce at the gate, not ~3%.

Full analysis: `research-email-gate-conversion-clarification.md`

---

## FACT-CHECK 2: Ipsative Scoring with 4 Dimensions and 12 Items

### Verdict: The Daydreamer's 12-paired-comparison design will not work.

The psychometric literature is unambiguous on four points:

**2a. Is 4 dimensions + 12 items enough?**

No. Three independent lines of evidence converge:

1. **Bartram (1996)**: Ipsative measures are unreliable below 10 scales.
   4 dimensions is less than half the minimum. [VERIFIED]

2. **Schulte et al. (2021)**: Simulated 5-30 dimensions. Even at 5 dimensions
   with realistic factor loadings, reliability was below .70. At 30 dimensions,
   it was still below .80. They did not simulate 4 dimensions because the
   expectation was already that it would fail. [VERIFIED]

3. **Hee (2018)**: With 88 items and 12 dimensions (~7 items per dimension),
   reliability ranged from 0.28 to 0.62. Our scenario (12 items, 4 dimensions,
   3 items per dimension) would be far worse. [VERIFIED]

**2b. Can ipsative instruments produce composite types?**

Technically yes, but unreliably. Ipsative data sums to a constant: if A and D
are both high, B and C must be correspondingly low. The composite signal comes
from what the user rejects, not what they embrace. With only 12 items and 4
dimensions, the signal-to-noise ratio is too low for reliable composite
detection. [VERIFIED -- mathematical constraint]

**2c. Forced-choice quizzes in marketing contexts?**

No evidence found. None of the major quiz platforms (Interact, Typeform,
Riddle, ScoreApp, BuzzFeed) use ipsative paired-comparison scoring. Marketing
quizzes universally use weighted-scoring (normative) approaches where answers
add points to dimensions independently. [UNVERIFIED -- absence of evidence]

**2d. Known failure modes:**

1. **Between-person comparison failure**: Ipsative scores are within-person
   ranks only. You cannot compare User A's "Air Weaver" score to User B's.
   [VERIFIED -- GraduatesFirst, Englert]

2. **Factor analysis failure**: You cannot validate whether the quiz measures
   what you think it measures. [VERIFIED -- Englert]

3. **Faking resistance is a myth**: Contrary to claims, ipsative instruments
   are NOT resistant to faking. [VERIFIED -- Englert]

4. **All-pairs-are-hard problem**: Well-designed forced-choice items are ALL
   difficult (by design -- desirability matching). The user never gets an easy
   win. In a leisure/entertainment context, this creates frustration. [VERIFIED
   -- Seybert & Becker 2019]

5. **Cognitive fatigue**: 12 forced tradeoffs in sequence creates decision
   fatigue and satisficing behavior. [UNVERIFIED -- extrapolated from longer
   instruments]

**Recommendation**: Abandon the pure ipsative paired-comparison design. Use
normative weighted scoring (the current approach, improved) with 2-3
forced-pair questions embedded within the normative framework. These hybrid
pairs should score BOTH dimensions (not zero-sum) to avoid ipsative
constraints.

Full analysis: `research-ipsative-scoring-4-dimensions.md`

---

## NEW RESEARCH: Skip vs. No-Skip on Email Gates

### The data landscape is sparse but the logic is clear.

**Key finding: There are no published A/B tests comparing skip vs. mandatory
email gates in quiz funnels.** This is a significant gap. Every recommendation
in this space is either a platform default, a logical inference, or an
extrapolation from adjacent form-optimization research.

**What the adjacent data says:**

| Finding | Source | Applicability |
|---------|--------|--------------|
| Changing phone field from mandatory to optional reduces abandonment from 39% to 4% | Unbounce Conversion Benchmark | Medium (different field type) |
| Reducing form fields from 4 to 3 boosts conversion by 50% | Unbounce | Medium (different context) |
| Single-field forms convert at 23.4%, 3x the rate of four-field | Unbounce | Medium |
| Hybrid gating (teaser + gate) recommended by 76% of B2B marketers | Content Marketing Institute | Low (B2B, not consumer quiz) |

**Scenario modeling (100 quiz starters):**

| Approach | Emails | People seeing results | Net reach |
|----------|--------|----------------------|-----------|
| Mandatory gate | ~40 | ~40 | Low |
| Optional (skip) gate | ~33 | ~52 | Medium |
| Partial reveal (name free, details gated) | ~28-35 | ~52-60 | High |
| No gate (current) | 0 | ~65 | Highest |

**For the spiritual/wellness audience:**

- Coaching/courses (closest proxy) shows 76% gate conversion -- ABOVE average
- This weakly contradicts the DA's privacy-sensitivity concern
- Competitors (LonerWolf, Yaqeen) show results without gates -- but they may
  not be optimizing for email capture
- No audience-specific data exists for tarot/spiritual quiz funnels

**Three viable strategies (in order of risk):**

1. **Lowest risk**: Mandatory gate, full block. Captures most emails (~40/100
   starters). Standard practice. Can feel coercive.

2. **Moderate risk**: Mandatory gate with partial reveal (archetype name shown,
   detailed description + journey gated). Captures fewer emails (~28-35) but
   enables sharing and preserves trust.

3. **Highest risk/highest potential**: Optional gate with skip. Captures fewest
   emails (~33) but maximizes result page views (~52) and sharing potential.
   Highest brand trust.

**My recommendation**: Strategy 2 (partial reveal) is the best fit for THF's
pre-launch context, where viral sharing and brand trust are at least as
important as email volume. BUT this recommendation is based on logic, not data.
If A/B testing infrastructure exists, test Strategy 1 vs. Strategy 2 first.

Full analysis: `research-skip-vs-mandatory-email-gates.md`

---

## Updated Confidence Table

| Finding | Confidence | Change from Round 1 |
|---------|-----------|-------------------|
| Quiz should be 7-10 questions | HIGH | Unchanged |
| Email gate before results captures significantly more leads | HIGH | Unchanged |
| Gate conversion rate is ~62% (not 92-97%) | HIGH | **CORRECTED** |
| ~38% relative drop at email gate | HIGH | **NEW (validates DA)** |
| Answer randomization needed | HIGH | Unchanged |
| Labor illusion interstitial works | HIGH | Unchanged |
| Ipsative scoring fails at 4 dimensions | HIGH | **NEW** |
| Forced-choice paired comparisons wrong for marketing quiz | HIGH | **NEW** |
| Distance-based classification superior | MEDIUM-HIGH | Unchanged |
| Partial reveal vs. full gate tradeoff | LOW | **NEW (no empirical data)** |
| Skip vs. mandatory gate impact | LOW | **NEW (no empirical data)** |
| Spiritual audience privacy sensitivity | LOW | **NEW (proxy data weakly contradicts)** |
| Variable weighting improves short quizzes | MEDIUM | Unchanged |

---

## Key Corrections to Propagate

The following claims from Round 1 artifacts need to be treated as superseded:

1. `research-email-gate-placement.md` line 21: "Completion of opt-in form at
   end (before results) | 92-97% | Thrive Themes, Dupple" -- **REFUTED**.
   Replace with ~62% (derived from Interact).

2. `research-email-gate-placement.md` line 24: "97% of people who complete a
   quiz submit the opt-in form" -- **REFUTED**. Source does not contain this
   statistic.

3. `research-psychometric-design.md`: The forced-choice and pair-comparison
   sections are accurate in describing the FORMAT but did not address the
   reliability constraints of using ipsative scoring with only 4 dimensions.
   The new `research-ipsative-scoring-4-dimensions.md` artifact supersedes the
   relevant section.

---

## Open Questions for Round 3

1. **Normative hybrid pairs**: If we embed 2-3 forced-pair questions within a
   normative framework (scoring both dimensions positively, not zero-sum), what
   point allocations create genuine inter-dimension tension without ipsative
   constraints? Example: pick A = +6 to dim A, +2 to dim B; pick B = +6 to dim
   B, +2 to dim A. Does this actually work for classification?

2. **Archetype name as teaser**: If we show "You are The Shadow Dancer" freely
   but gate "What does that mean for you?" behind email, does the name alone
   create enough sharing incentive? The current result page (quiz.astro) shows
   name + glyph + brief tagline + description. Which elements are name vs.
   details?

3. **A/B test infrastructure**: Does the current codebase support serving
   different flows to different users? If not, shipping a mandatory gate and
   later adding a skip option requires two deployments, which may delay
   learning.
