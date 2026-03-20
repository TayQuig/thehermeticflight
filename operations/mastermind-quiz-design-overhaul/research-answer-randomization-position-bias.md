# Research: Answer Order Effects & Position Bias

## Key Findings

### Position Bias Is Real and Measurable

**SurveyMonkey experiment**: Results differed significantly between groups when answer options were randomized vs. not. Non-randomized choices were more likely to be picked for early-position answers, producing "biased and misleading response data."
- Source: https://www.surveymonkey.com/curiosity/eliminate-order-bias-to-improve-your-survey-responses/

**Primacy effect**: Respondents tend to select the first option presented, especially in visual/online formats.
- Source: https://www.surveymonkey.com/curiosity/eliminate-order-bias-to-improve-your-survey-responses/

**Recency effect**: In audio/verbal formats, the last option tends to be selected more.
- Source: https://www.qualtrics.com/articles/strategy-research/biased-data-is-bad-data-how-to-think-about-question-order/

### When NOT to Randomize

- **Ordinal scales**: Don't randomize "strongly agree to strongly disagree" -- users expect this order
- **Conventional orderings**: Alphabetical lists, numerical ranges, etc.
- Source: https://www.surveymonkey.com/curiosity/eliminate-order-bias-to-improve-your-survey-responses/

### Question Order Bias (Adjacent Topic)

"Respondents often seek to provide answers that are consistent with their prior responses and look to conform to the norm of evenhandedness."
- Source: https://www.qualtrics.com/articles/strategy-research/biased-data-is-bad-data-how-to-think-about-question-order/
- Source: https://link.springer.com/chapter/10.1007/978-1-4612-2848-6_3

### Pattern Recognition Risk in the Current Quiz

The current Hermetic Flight quiz has a specific vulnerability: all 15 scored questions present options in the same A-B-C-D dimension order. A user who identifies with dimension A (logic/structure) will find "their" answer is consistently the first option. After 3-4 questions, the pattern becomes transparent, and the user can game the quiz (or worse, feel the quiz is transparent/unserious).

## Recommendation

**Answer randomization should be implemented per-question**. Each question's 4 answer options should be shuffled independently using a deterministic seed (e.g., based on session ID) so that:

1. The user cannot predict which position "their" dimension occupies
2. The same user sees the same order on revisit (for debugging/reproducibility)
3. The scoring still maps correctly regardless of display order

This is a low-effort, high-impact fix. Implementation: shuffle the answers array before rendering, using a Fisher-Yates shuffle seeded by `sessionId + questionIndex`.

**Additionally**, question order itself could benefit from partial randomization -- keeping the first and last questions fixed (first: strong opener; last: clean closer for emotional arc) while randomizing the middle block.
