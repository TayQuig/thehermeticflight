# Research: Psychometric Quiz Design & Question Construction

## Key Findings

### Question Format Comparison: Likert vs. Situational vs. Ipsative

**Riddle Lab A/B Test** (2,024 respondents, emotional intelligence quiz):

| Format | Completion Rate | Lead Completion | Form Completion (if seen) |
|---|---|---|---|
| Likert scale (repetitive options) | 68.97% | 32.75% | 47.5% |
| Situational questions (varied) | 35.14% | 17.57% | 50.0% |

- Source: https://www.riddle.com/blog/lab/riddle-lab-personality-quiz-question-format/

**Key insight**: Repetitive answer structures nearly double completion rates. "Users can quickly click through a test if all the answer options for all questions are always the same." However, situational formats produce higher-quality, more differentiated leads.

**Implication for THF**: The current quiz uses the same 4-option "pick your flavor" pattern for all 15 scored questions. This is actually good for completion, but bad for genuine dimension tension -- users can pattern-match their preferred dimension across all questions.

### Forced-Choice (Ipsative) Instruments

**How they work**: Present 3-4 equally attractive statements. User picks "most like me" and optionally "least like me." Answers always sum to the same total (ipsative data).

**Advantages**:
- Resist faking/social desirability bias
- Force genuine tradeoffs between dimensions
- Prevent "all high" or "all low" response patterns
- Source: https://www.graduatesfirst.com/psychometrics/ipsative-tests

**Disadvantages**:
- Lower test reliability with traditional scoring
- Factor analysis/variance analysis cannot be used on raw ipsative data
- Solvable with Thurstonian IRT model (Brown & Maydeu-Olivares, 2011/2013)
- Source: https://www.researchgate.net/publication/378098869_On_the_Consistent_Construction_of_Forced-Choice_Ipsative_Tests
- Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC5435816/

### How Validated Instruments Handle Composite Types

**Big Five (OCEAN)**:
- Continuous spectrum, NOT categorical. Scores on 0-100 per trait.
- 30 facets across 5 traits. Personality "patterns" emerge from trait intersections.
- "These are spectrums, not all-or-nothing labels."
- Source: https://en.wikipedia.org/wiki/Big_Five_personality_traits
- Source: https://bigfive.ly/en/articles/the-big-five-personality-traits-an-ultimate-guide-to-the-ocean-model

**MBTI**:
- Binary classification per dichotomy (I/E, S/N, T/F, J/P) = 16 types
- The TDI (Type Differentiation Indicator) provides 20 subscales for nuance
- Known weakness: people near the midpoint of any dichotomy get unstable classifications
- Source: https://en.wikipedia.org/wiki/Myers%E2%80%93Briggs_Type_Indicator

**Enneagram**:
- Primary type + wing (adjacent type influence)
- Tri-type theory: one dominant type per center (head/heart/gut)
- Allows composite expression: "You're a 4w5" acknowledges adjacent influence
- Source: https://personalityjunkie.com/07/myers-briggs-enneagram-mbti-types-correlations-relationship/

### Creating Genuine Inter-Dimension Tension

The core problem with single-select "which resonates most?" is that it tests **recognition preference**, not **behavioral tendency**. A user who values both logic (A) and embodiment (B) will simply pick whichever they identify with more strongly in that moment.

Better approaches:
1. **Forced ranking**: "Rank these 4 approaches from most to least like you" -- forces explicit tradeoffs
2. **Scenario-based questions**: Put the user in a situation where different archetypes would act differently. "You receive conflicting advice from a mentor and your gut feeling..." -- this creates genuine tension because the user has to choose an ACTION, not a VALUE.
3. **Pair comparison**: "Which matters more to you: understanding the framework (A) or feeling it in your body (B)?" -- direct head-to-head comparisons between two specific dimensions

### Question Variety & Response Rates

- **14 high-engagement question types** identified by Interact: Convictions, Reflective, Traits, Values, Lifestyle, Preference, Visual Preference, Introspective, Perception, Goals, Identity, Skills, Behavioral, Experience
- Average response rate across these types: **97.5%** (only 2.5% skip)
- Source: https://www.tryinteract.com/blog/14-types-of-quiz-questions-with-97-5-response-rates/

### Mixing Question Types

"Alternating between text options, image options, and sliders creates visual and interactive variety that sustains attention, with each format change feeling like a small novelty that resets the engagement clock."
- Source: https://genlead.ai/blog/the-best-quiz-questions-to-boost-engagement/

**Trade-off**: Format variety increases engagement but can reduce completion if formats are cognitively expensive (e.g., ranking, drag-and-drop).

## Implications for The Hermetic Flight

### Current Problems
1. All 15 scored questions use identical format: "Read question, pick one of 4 text answers"
2. Each answer maps 1:1 to a dimension (A/B/C/D), making patterns transparent
3. No forced tradeoffs -- user never has to choose between two dimensions directly
4. No scenario-based questions -- all are preference/values-based

### Recommended Approach
For a marketing quiz (not clinical assessment), the optimal blend is:
1. **5-6 scenario-based questions** with 4 options (one per dimension) -- these create genuine behavioral tension
2. **2-3 forced-pair comparisons** ("Which matters more: X or Y?") -- these create direct inter-dimension tension and can use variable weighting
3. **1-2 image/visual choice questions** -- engagement reset, variety
4. Maintain the 4-option structure where possible for consistency and completion
5. Mix "most like me" with "least like me" on select questions for richer signal
