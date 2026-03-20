# Mastermind Report: Quiz Design Overhaul — 10-Flaw Resolution

**Date:** 2026-03-19
**Rounds:** 3
**Consensus:** Conditional

## The Idea

The Hermetic Flight's archetype quiz has 10 interconnected design flaws that need to be resolved into a cohesive design spec before implementation. The quiz is the primary top-of-funnel conversion tool for an 8/8/26 Kickstarter launch of an aerial tarot deck.

## Consensus Summary

The deliberation resolved all 10 design flaws into a unified spec through three rounds. The most significant debate was over the scoring model: the Daydreamer's proposal for pure ipsative forced-choice paired comparisons was initially adopted by the Designer and Builder, then blocked by the Researcher on psychometric grounds (ipsative scoring with 4 dimensions produces unreliable measurements per Bartram 1996, Schulte 2021, Hee 2018). The Researcher's block was resolved when the Designer adopted a hybrid approach — normative weighted scoring for most questions with 2-3 forced-pair questions for composite boundary detection — and all agents converged on cosine-similarity centroid classification as the algorithm.

An interesting reversal occurred in Round 3: the Researcher lifted their block and found that pure ipsative scoring actually maximizes angular discrimination for cosine-similarity classification, while the Designer conceded to the hybrid. The practical resolution favors the hybrid because it dramatically reduces content creation burden (adapting 8 existing questions vs. writing 24 new desirability-matched paired statements), and the engineering difference between the two approaches is trivial (~2 hours, ~46 lines of code).

The key architectural decisions: replace the priority-cascade classifier with cosine-similarity centroids (giving all 6 archetypes equal, positive detection), reduce from 20 questions to 10 scored + 2 segmentation, add an email gate with skip option after the last scored question, add a calculating interstitial with operational transparency, randomize answer order per session, and increase auto-advance timing from 500ms to 800ms. The classifier returns a rich `ClassificationResult` with confidence scores and fuzzy memberships, enabling three tiers of result messaging — clear primary, primary with secondary undertones, and a self-selection flow for genuinely ambiguous profiles.

## Agent Contributions

### Daydreamer
Reframed the quiz's fundamental problem: the 4-option "pick your flavor" format lets users choose their archetype rather than discover it. Proposed forced-choice paired comparisons as the core format change, which was adopted for the 3 composite-detecting questions. Also surfaced the card-draw reading concept as a post-launch replacement funnel. Key ideas for later: archetype rarity counters, shadow archetype email sequence, constellation visualization.

### Designer
Produced the complete technical spec across three rounds. Key architectural contributions: the unified `ClassificationResult` interface with confidence and fuzzy memberships, the cosine-similarity-to-centroids algorithm (identifying that Euclidean distance fails on ipsative data), the three-tier confidence protocol with conditional self-select phase, and the two-renderer UI architecture (normative 4-button + forced-pair 2-button). The final spec in `scratch/round-3-designer.md` is implementation-ready.

### Researcher
Produced 10 research artifacts with sourced evidence. Critical correction in Round 2: the commonly cited "92-97% email gate conversion" is wrong — the actual derived rate is ~62% of completers (~38% relative drop). Blocked pure ipsative scoring based on three independent psychometric sources, then lifted the block in Round 3 when cosine-similarity classification was shown to operate on proportional direction rather than unreliable absolute scores. Key finding: ipsative measurement literature itself identifies within-person profile classification as the valid use case.

### Builder
Confirmed implementation feasibility at every round. Key findings: `computeScores()` is already format-agnostic (handles any number of answers with any scoring weights), `quiz-submit.ts` auto-adapts to question changes (validation built dynamically from the questions array), and the engineering difference between pure ipsative and hybrid is ~2 hours. Produced exact HTML and TypeScript code for the email gate. Final build plan: ~3.5-4 days engineering gated on operator content approval.

### Devil's Advocate
Identified critical risks that shaped the final spec: the 28.7% tie rate with ipsative scoring (RISK-11, resolved by centroid classifier), primacy bias asymmetry in pair ordering (RISK-12, mitigated by seeded randomization + desirability matching), and the email gate conversion cliff (RISK-02, mitigated by skip option). Downgraded voice fidelity risk from CRITICAL to HIGH after finding that 2-option forced pairs are structurally easier to write with consistent voice. All 5 conditions met by the Designer's final spec.

## Conditions

- **Operator must approve all question copy.** Claude drafts against the spec; operator reviews and iterates collaboratively for voice fidelity and desirability matching across forced pairs. Final approval is the gate. (DA Condition 4, RISK-01)
- **Centroid positions must be validated via Monte Carlo simulation** (10,000 random answer sets, all 6 archetypes at >5%, none >40%) before deployment. (Researcher Caveat 2, Builder Phase 2)
- **Email gate ships with skip option at launch.** Skip shows archetype name + 1-sentence tagline. Skip rate tracked as GA4 event. Hard gate considered only after data shows <20% skip rate. (DA Condition 5)
- **Display order must be logged** in submission payload for post-hoc primacy bias analysis. If post-launch analysis shows >5% classification skew correlated with display order, centroids or question content must be adjusted. (DA Condition 3, Researcher Caveat 3)
- **Raw dimension scores must not be exposed to users** or used for between-person comparison. Ipsative scores are valid for within-person classification only. The `memberships` field (computed from cosine similarity) is the appropriate output for downstream use. (Researcher Caveat 4)
- **Confidence threshold for composite messaging** should start at 0.15 for self-select trigger and 0.4 for secondary undertones display. These are initial values to be validated with the Monte Carlo distribution test. (Researcher Caveat 1, Designer three-tier protocol)
- **Phase 0 (content design) is a hard gate, but not a slow one.** Engineering phases must not begin until operator has approved all question content. Placeholder content leads to rework because content shapes scoring distribution, which shapes centroid tuning, which shapes classifier tests. Phase 0 is a collaborative Claude + operator session — drafting, reviewing, and approving questions interactively — and can be completed in a single sitting. (Builder Phase 0)

## Research Artifacts

- `operations/mastermind-quiz-design-overhaul/research-quiz-length-completion-rates.md` — Industry benchmarks for quiz length and drop-off (7-10 questions optimal)
- `operations/mastermind-quiz-design-overhaul/research-email-gate-placement.md` — Email capture best practices (40.1% start-to-lead benchmark, ~62% gate conversion rate — corrected from initial 92-97% claim)
- `operations/mastermind-quiz-design-overhaul/research-psychometric-design.md` — Question format psychology, ipsative instruments, composite type detection
- `operations/mastermind-quiz-design-overhaul/research-answer-randomization-position-bias.md` — Position bias evidence and Fisher-Yates randomization
- `operations/mastermind-quiz-design-overhaul/research-labor-illusion-interstitials.md` — Buell & Norton 2011 operational transparency research (+8% perceived value)
- `operations/mastermind-quiz-design-overhaul/research-auto-advance-ux.md` — Auto-advance vs. manual navigation (LSSSE study, 39,350 participants)
- `operations/mastermind-quiz-design-overhaul/research-classification-algorithms.md` — Distance-based, fuzzy, and alternative classifiers (SWCPQ, cosine similarity)
- `operations/mastermind-quiz-design-overhaul/research-email-gate-conversion-clarification.md` — Corrects 92-97% claim to ~62%, derives figure from Interact data
- `operations/mastermind-quiz-design-overhaul/research-ipsative-scoring-4-dimensions.md` — Comprehensive literature review on why 4-dimension ipsative instruments fail
- `operations/mastermind-quiz-design-overhaul/research-skip-vs-mandatory-email-gates.md` — Skip option data, partial-reveal strategy, audience proxy data

## Design Spec Summary

### Scoring Model: Hybrid Normative + Forced-Pair
- **7 normative single-select questions** (4 options each, one per dimension, variable weighting at +3/+4/+6 tiers)
- **3 forced-pair questions** (2 options each, both dimensions scored at +6 winner / +2 loser)
- Forced pairs target composite boundaries: A-D (Grounded Mystic), B-C (Flow Artist), one flexible pair
- Total: 10 scored questions — within the empirically supported 7-10 sweet spot
- Scores do NOT sum to a constant (avoids ipsative reliability trap)

### Classifier: Cosine-Similarity Centroids
- 6 archetype centroids in 4D space:
  - Air Weaver [0.90, 0.15, 0.15, 0.15], Embodied Intuitive [0.15, 0.90, 0.15, 0.15]
  - Ascending Seeker [0.15, 0.15, 0.90, 0.15], Shadow Dancer [0.15, 0.15, 0.15, 0.90]
  - Flow Artist [0.15, 0.65, 0.65, 0.15], Grounded Mystic [0.65, 0.15, 0.15, 0.65]
- Classification by highest cosine similarity (not Euclidean distance)
- Returns `ClassificationResult` with primary, secondary, confidence (0-1), and fuzzy memberships
- Backward compatibility shim: `classifyLegacy()` for transitional callers
- `computeScores()` unchanged — already format-agnostic

### Confidence Protocol
- **High (≥0.4)**: "You are The Air Weaver." — primary only
- **Medium (0.15-0.4)**: "You are The Air Weaver with Shadow Dancer undertones." — primary + secondary
- **Low (<0.15)**: Self-select phase — "Your reading reveals a tension between X and Y. Which calls to you more deeply?" User chooses.

### Quiz Flow
```
Intro → Segmentation (2 Qs, no progress bar) → Scored Questions (10 Qs, mixed format, progress bar)
→ Email Gate (with skip) → Calculating Interstitial (2.5-4s) → [Self-Select if confidence < 0.15]
→ Results (archetype reveal with confidence-based messaging)
```

### Non-Scored Questions
- Q2 (tarot experience) → SEG1: pre-quiz warmup
- Q3 (pain points) → SEG2: pre-quiz warmup
- Q11 (flow state) → cut (dimension-language overlap, not scored)
- Q19 (card back preference) → PR1: moved to post-results or cut
- Q20 (learning format) → PR2: moved to post-results or cut

### UX Changes
- Auto-advance: 800ms (up from 500ms)
- Answer randomization: Fisher-Yates per question per session, seeded PRNG, cached for back-navigation
- Two UI renderers: 4-button normative + 2-button forced-pair with "or" divider
- Email gate: form with email (required), first name (optional), honeypot, skip link
- Calculating interstitial: themed animation with operational transparency text

## Next Steps

1. **Content design (Phase 0, collaborative):** Claude drafts 7 normative scored questions (adapting from existing Q1, Q4-Q10, Q12-Q18) and 3 forced-pair questions (6 new statements) against the spec — dimension pairings, weight tiers, forced-pair assignments, and voice guidelines. Operator reviews interactively for voice fidelity, desirability matching on forced pairs, and brand fit. Variable weight tiers assigned collaboratively. This is the critical path — engineering is gated on operator approval of the final question set — but can be completed in a single collaborative session.

2. **Data model + scoring pipeline (Phase 1, ~1 day):** Update `quiz-data.ts` with new questions, `QuestionFormat` type, `format` field, `pair()` helper. Rewrite `quiz-data.test.ts` structural assertions. Update `computeScores` integration tests.

3. **Classifier redesign (Phase 2, ~1 day):** Rewrite `classify()` for cosine-similarity centroids. Add `ClassificationResult` interface, `CENTROIDS` constant, `classifyLegacy()` shim. Run Monte Carlo distribution validation (10,000 random sets, all 6 archetypes >5%).

4. **UI implementation (Phase 3, ~1.5 days, parallelizable):** Format-conditional rendering, email gate wiring (exact code in Builder's Round 2), calculating interstitial, answer shuffle, auto-advance timing.

5. **Integration testing (Phase 4, ~1 day):** Full flow smoke test, E2E test rewrites, quiz-submit API verification with hybrid payloads, distribution validation gate.

6. **Post-launch monitoring:** Track skip rate, email submission rate, share rate, and display-order bias as separate GA4 events. Adjust centroids or content based on real-world distribution data.

7. **Future consideration (Daydreamer's Direction 3):** Design a 5-7 card interactive reading experience as a post-launch replacement or second funnel for retargeted traffic. This is the "native" funnel for a tarot deck product.
