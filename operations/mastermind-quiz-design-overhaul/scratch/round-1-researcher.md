# Round 1 -- Researcher Analysis

## Role
Researcher -- providing the evidentiary foundation for the quiz design overhaul.

## Research Artifacts Produced

All artifacts saved to `operations/mastermind-quiz-design-overhaul/`:

1. `research-quiz-length-completion-rates.md` -- Industry benchmarks for quiz length and drop-off
2. `research-email-gate-placement.md` -- Email capture best practices and conversion data
3. `research-psychometric-design.md` -- Question format psychology, ipsative instruments, composite types
4. `research-answer-randomization-position-bias.md` -- Position bias evidence and randomization
5. `research-labor-illusion-interstitials.md` -- Buell & Norton research on operational transparency
6. `research-auto-advance-ux.md` -- Auto-advance vs. manual navigation research
7. `research-classification-algorithms.md` -- Distance-based, fuzzy, and alternative classifiers

## Summary of Findings by Design Flaw

### Flaw 1: Question Homogeneity

**Evidence**: Riddle Lab A/B test (2,024 respondents) shows Likert-style repetitive formats achieve 68.97% completion vs. 35.14% for situational questions. However, situational formats produce more discriminating results. The optimal approach is a BLEND: maintain mostly-consistent format for completion, but mix in 2-3 scenario-based or forced-pair questions to create genuine inter-dimension tension. Interact identifies 14 question types with 97.5% average response rates.

**Recommendation**: Replace 15 identical "pick your flavor" questions with 5-6 scenario-based + 2-3 forced-pair + 1-2 visual choice. Total: ~10 questions.

### Flaw 2: Ascending Seeker as Fallback Junk Drawer

**Evidence**: The priority cascade classifier (`classifier.ts` lines 43-72) makes Ascending Seeker the catch-all for any score pattern that doesn't match the first 5 conditions. Dimension C (openness/receptivity) never gets its own classification path. Every platform (Typeform, Interact, ScoreApp) warns against fallback-as-default; fallbacks should handle edge cases, not be a primary classification path.

**Recommendation**: Replace priority cascade with distance-based classification using archetype centroids. Ascending Seeker gets its own centroid (C-dominant), making it a legitimate classification target with equal reachability.

### Flaw 3: Flow Artist + Grounded Mystic Nearly Impossible to Reach

**Evidence**: Flow Artist requires BOTH B>A AND B>D AND C>A AND C>D (dual strict dominance). Grounded Mystic requires A>B AND A>C AND D>B AND D>C (same pattern, different dimensions). With flat +4 scoring across 15 questions, these dual-dominance conditions are structurally near-impossible unless a user answers almost exclusively in two dimensions. Analysis: with 15 scored questions, max per dimension is 60 points. For Flow Artist, the user needs B AND C each independently higher than A AND D -- this requires concentrated scoring with almost no crossover.

**Recommendation**: Distance-based classification with centroids for Flow Artist at [0.15, 0.65, 0.65, 0.15] and Grounded Mystic at [0.65, 0.15, 0.15, 0.65] makes these reachable via proximity rather than strict dual-dominance gates.

### Flaw 4: Non-Scored Questions Mixed with Scored Ones

**Evidence**: Q2, Q3, Q11, Q19, Q20 are non-scored (experience level, pain points, flow state, card back preference, learning format). These are interleaved with scored questions, adding length without contributing to classification. Industry best practice: 7-question personality quizzes have 65-85% completion; 20-question quizzes drop dramatically.

**Recommendation**: Remove all non-scored questions from the main quiz. Q2 and Q3 (segmentation) can move to a post-email-gate micro-survey. Q19 and Q20 (product research) can move to email onboarding sequence or be cut entirely. Q11 is redundant with scored questions.

### Flaw 5: Too Long (20 Questions)

**Evidence**: Industry sweet spot is 7 questions for branching/personality quizzes, 5-10 general. Compounding effect: at 95% per-question retention, 10 questions = 60% completion; 20 questions = 36%. At 90% retention, 20 questions = 12% completion. The ~2 minute target completion time implies 7-10 questions at 12-17 seconds per question.
- Sources: Interact 2026 Report, GenLead.ai, Outgrow

**Recommendation**: Target 8-10 scored questions. This provides 2-3 questions per dimension (enough for basic reliability), stays within the completion sweet spot, and hits the ~2 minute target.

### Flaw 6: No Email Gate Before Results

**Evidence**: The universal best practice is email gate AFTER last question, BEFORE results. Conversion benchmarks: 40.1% start-to-lead (Interact, stable since 2013 across 80M+ leads). 92-97% of quiz completers submit the opt-in form when placed before results. Quiz funnels outperform standard lead magnets by 6-8x (30-40% vs. ~5%).
- Sources: Interact 2026 Report, Thrive Themes, Dupple, The Well-Paid Expert

**Recommendation**: Insert email gate between final question and results. Copy: "Enter your email to reveal your archetype and begin your personalized journey." No skip option. Flow: Questions -> Email Gate -> Calculating Interstitial -> Results.

### Flaw 7: Flat Scoring (No Variable Weighting)

**Evidence**: Psychometric literature says unit weighting works "almost as effectively" for validated instruments with MANY items (Stanley & Wang, 1970). However, for SHORT quizzes (7-10 questions), variable weighting becomes more important because each question carries proportionally more weight. Riddle recommends point ranges from -100 to +100 per response. The current flat +4 makes every question and every answer equally discriminating.

**Recommendation**: Introduce 2-3 weight tiers: high-discrimination questions (scenario-based, forced tradeoffs) at +6 or +8; standard preference questions at +4; dual-scoring hybrid answers (Grounded Mystic/Flow Artist detectors) at +4/+4. This naturally makes some questions more influential in classification without adding complexity for the user.

### Flaw 8: Auto-Advance UX (500ms)

**Evidence**: LSSSE study (39,350 participants) shows auto-advance users changed ~50% fewer answers. For a personality quiz where "first instinct" may be more authentic, this is arguably a feature. However, 500ms is aggressive -- users barely see their selection confirmed. Antoun et al. (2017) specifically warns against auto-advance for first-time users on smartphones due to learning requirements.

**Recommendation**: Hybrid approach -- extend to 800-1200ms with visible countdown/confirmation animation. Add cancel-on-second-tap. Use explicit "Next" button for complex questions (scenario-based, ranking). Keep back button.

### Flaw 9: No Calculating Interstitial

**Evidence**: Buell & Norton (2011, Management Science) demonstrated with 266 participants that operational transparency (showing what's being computed) INCREASES perceived value by 8% compared to instant results -- even when results are identical. Participants PREFERRED longer waits with transparency. Dynamic content (list of what's being searched) outperformed static progress bars at all wait intervals. Open-kitchen restaurants see +22% higher ratings for identical food with visible preparation.

**Recommendation**: 4-6 second interstitial between email gate and results, with operational transparency: "Analyzing your pattern across 4 dimensions... Comparing against 6 archetype profiles... Calculating your primary alignment..." Dynamic, changing text with thematic animation (cards, stars, flight imagery). This goes right before the result reveal to maximize perceived value.

### Flaw 10: Static Answer Order (Pattern Recognition)

**Evidence**: SurveyMonkey experiments show "results differed significantly" with answer randomization vs. fixed order. Non-randomized choices show position bias (primacy effect for visual formats). The current quiz has all 15 scored questions with answers in consistent A-B-C-D dimension order, making pattern recognition trivial after 3-4 questions.

**Recommendation**: Fisher-Yates shuffle per question, seeded by session ID + question index for reproducibility. Do not randomize non-personality ordinal scales. Additionally, randomize middle-block question order (keep first/last fixed for emotional arc).

## Cross-Cutting Insights

### The Classification Algorithm Is the Linchpin

Many of the 10 flaws are symptoms of the same root cause: the priority cascade classifier. Replacing it with distance-based classification with fuzzy membership:
- Fixes the Ascending Seeker fallback (Flaw 2)
- Makes Flow Artist and Grounded Mystic reachable (Flaw 3)
- Eliminates arbitrary tie-breaking (part of Flaw 7)
- Enables richer result pages with percentage breakdowns
- Naturally accommodates variable weighting (Flaw 7)

### Question Reduction Enables Everything Else

Cutting from 20 to 8-10 questions:
- Fixes completion rate issues (Flaw 5)
- Removes the non-scored question problem by eliminating them (Flaw 4)
- Creates room for question format variety without extending length (Flaw 1)
- Makes each question's weight more meaningful (Flaw 7)

### The Funnel Flow Redesign Is a Single Coherent Change

The email gate (Flaw 6), calculating interstitial (Flaw 9), and auto-advance timing (Flaw 8) are all part of the same user journey redesign:

**Start -> Q1...Q8-10 (auto-advance, answers randomized) -> Email Gate -> Calculating Interstitial (4-6s) -> Results (with fuzzy membership breakdown)**

## Confidence Levels

| Finding | Confidence | Basis |
|---|---|---|
| Quiz should be 7-10 questions | HIGH | Multiple concordant sources, industry-wide consensus |
| Email gate before results | HIGH | Universal practice, 40.1% benchmark across 80M+ leads |
| Answer randomization needed | HIGH | Well-established survey methodology |
| Labor illusion interstitial works | HIGH | Peer-reviewed (Management Science), 5 experiments, replicated |
| Distance-based classification superior | MEDIUM-HIGH | Sound theoretical basis, used by SWCPQ, but requires centroid tuning |
| Variable weighting improves short quizzes | MEDIUM | Logical inference from psychometric literature, limited direct evidence for marketing quizzes |
| Auto-advance timing (800-1200ms) | MEDIUM | LSSSE provides data but no optimal timing; 800-1200ms is interpolation |
| Question format variety improves results | MEDIUM | Riddle Lab data (N=2024) but only one study; trade-off with completion rate |

## Open Questions for Other Agents

1. **Centroid tuning**: The draft archetype centroids need validation against existing quiz submission data (14 submissions per source). Are the centroids reachable with realistic score distributions?
2. **Question selection**: Which 8-10 of the current 15 scored questions best discriminate between archetypes? Item discrimination analysis on existing data would help, though N=14 is too small for statistical reliability.
3. **Forced-pair implementation**: How do forced-pair questions ("Which matters more: X or Y?") map to the scoring system? Do they score +4/-4 (zero-sum) or +4/+0?
4. **Email provider integration**: The email gate needs Loops.so integration. What's the API contract? How does archetype segmentation pass through?
5. **Mobile vs. desktop**: The auto-advance research warns specifically about mobile. Should the timing be platform-responsive (longer on mobile)?

## Sources Index

All URLs verified via WebSearch/WebFetch during this research session:

- Interact 2026 Quiz Conversion Rate Report: https://www.tryinteract.com/blog/quiz-conversion-rate-report/
- Outgrow Quiz Engagement Benchmarks: https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates
- GenLead.ai Quiz Questions: https://genlead.ai/blog/the-best-quiz-questions-to-boost-engagement/
- Interact 14 Question Types: https://www.tryinteract.com/blog/14-types-of-quiz-questions-with-97-5-response-rates/
- Riddle Lab Question Format Study: https://www.riddle.com/blog/lab/riddle-lab-personality-quiz-question-format/
- Buell & Norton (2011) Labor Illusion: https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1376
- HBS Faculty Page: https://www.hbs.edu/faculty/Pages/item.aspx?num=40158
- Marketing Week (Shotton on Labour Illusion): https://www.marketingweek.com/richard-shotton-labour-illusion/
- BVA Nudge (Labor Illusion): https://www.bvanudgeconsulting.com/bias-of-the-week/labor-illusion/
- LSSSE Auto-Advance Study: https://www.surveypractice.org/article/6381-impacts-of-implementing-an-automatic-advancement-feature-in-mobile-and-web-surveys
- SurveyMonkey Order Bias: https://www.surveymonkey.com/curiosity/eliminate-order-bias-to-improve-your-survey-responses/
- Qualtrics Question Order: https://www.qualtrics.com/articles/strategy-research/biased-data-is-bad-data-how-to-think-about-question-order/
- SWCPQ Documentation: https://openpsychometrics.org/tests/characters/documentation/
- Fuzzy Clustering Wikipedia: https://en.wikipedia.org/wiki/Fuzzy_clustering
- FCM + OCEAN Personality: https://www.researchgate.net/publication/387477075_ANALYSIS_OF_FUZZY_C-MEANS_IN_PERSONALITY_CLUSTERING_BASED_ON_THE_OCEAN_MODEL
- Cosine Similarity (Built In): https://builtin.com/machine-learning/cosine-similarity
- Big Five Wikipedia: https://en.wikipedia.org/wiki/Big_Five_personality_traits
- Ipsative Tests (GraduatesFirst): https://www.graduatesfirst.com/psychometrics/ipsative-tests
- Forced-Choice Construction: https://www.researchgate.net/publication/378098869_On_the_Consistent_Construction_of_Forced-Choice_Ipsative_Tests
- Stanley & Wang (1970) Weighting: https://journals.sagepub.com/doi/10.1177/001316447003000102
- Thrive Themes Quiz Funnel: https://thrivethemes.com/how-to-create-a-quiz-funnel/
- Dupple Quiz vs Lead Magnets: https://dupple.com/blog/quiz-funnels-vs-lead-magnets-which-one-wins-the-conversion-battle-in-2026
- Typeform Tie-Breaking: https://community.typeform.com/build-your-typeform-7/personality-quiz-how-to-fix-a-tie-in-results-4434
- Interact Scoring Setup: https://help.tryinteract.com/en/articles/9971974-how-to-set-up-personality-quiz-logic-scoring
- Riddle Scoring: https://www.riddle.com/help/content-creation/personality-quiz/scoring
- Everyday Industries Quiz UX: https://everydayindustries.com/product-recommendation-quiz-tips/
