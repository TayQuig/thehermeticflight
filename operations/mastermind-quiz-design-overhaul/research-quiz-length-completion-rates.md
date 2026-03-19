# Research: Quiz Length & Completion Rate Benchmarks

## Key Findings

### Completion Rate by Question Count

| Quiz Length | Completion Rate | Source |
|---|---|---|
| 3-7 questions ("short") | 65-85% | Outgrow, TryInteract, GenLead.ai |
| 8-15 questions ("medium") | 45-65% | Outgrow, GenLead.ai |
| 15+ questions ("long") | <45% (estimated) | Inferred from compounding drop-off |

**The compounding effect**: If each question retains 95% of visitors, a 10-question quiz yields 60% completion. If each retains 90%, it drops to 35%. That 5% per-question gap nearly doubles completions.
- Source: https://genlead.ai/blog/the-best-quiz-questions-to-boost-engagement/

**The current quiz has 20 questions** -- this is dramatically above the industry sweet spot.

### Industry Benchmarks (Interact 2026 Report)

- Start-to-finish completion: **65%** across all industries
- Start-to-lead (email opt-in) conversion: **40.1%** (stable since 2013 across 80M+ leads)
- Coaching/courses: 59.1% completion, 44.9% lead conversion
- E-commerce: 55.5% completion, 37.6% lead conversion
- Service providers: 47.3% completion, 42.2% lead conversion
- Source: https://www.tryinteract.com/blog/quiz-conversion-rate-report/

### Optimal Length Recommendations

- **7 questions** is the sweet spot where engagement benchmarks peak before drop-off accelerates
  - Source: https://genlead.ai/blog/the-best-quiz-questions-to-boost-engagement/
- Standard logic quizzes: **13 questions**; branching logic quizzes: **7 questions**
  - Source: https://www.tryinteract.com/blog/14-types-of-quiz-questions-with-97-5-response-rates/
- General recommendation: 5-10 questions
  - Source: https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates
- Average completion time target: ~2 minutes
  - Source: https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates

### Notable Comparators

- Stitch Fix style quiz: 89% completion rate (highly personalized product rec)
  - Source: https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates
- Embedded quizzes (vs. pop-up/link): 78.4% completion (Riddle data)
  - Source: https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates

## Implications for The Hermetic Flight

The current 20-question quiz is approximately **2-3x the optimal length**. At 95% per-question retention, 20 questions yields only ~36% completion. At 90%, it drops to ~12%.

**Recommended target: 7-10 scored questions** + email gate. This aligns with:
1. The 7-question sweet spot for branching/personality quizzes
2. The ~2 minute completion time target
3. The need to maintain 4-dimension differentiation (minimum ~2 questions per dimension for reliability)

The 5 non-scored questions (Q2, Q3, Q11, Q19, Q20) should be moved out of the main quiz flow entirely -- either to post-result survey, email onboarding, or eliminated.
