# Research: Auto-Advance vs. Explicit Navigation UX

## Key Research: LSSSE Study (2017)

**Citation**: "Impacts of Implementing an Automatic Advancement Feature in Mobile and Web Surveys." Survey Practice, Article 6381.
- Source: https://www.surveypractice.org/article/6381-impacts-of-implementing-an-automatic-advancement-feature-in-mobile-and-web-surveys

### Study Design
- **39,350 law students** across 77 institutions (US & Canada)
- Random assignment to auto-advance vs. manual page advancement
- 2017 Law School Survey of Student Engagement (LSSSE)

### Findings

| Metric | Auto-Advance | Manual | Significant? |
|---|---|---|---|
| Breakoff rate | 13.99% | 14.68% | Minimal difference |
| Survey duration | No significant difference | -- | No |
| Ease of use (1-7) | 6.49 | 6.36 | Slightly better |
| Visual design rating | 1.54 | 1.64 | Slightly better |
| Answer revision rate | **~50% lower** | Baseline | **YES -- major concern** |
| Straightlining | No difference | -- | No |

### Critical Finding: Answer Revision

**Auto-advance users changed approximately 50% fewer answers** than manual navigation users. This is the single most important data point for quiz design:

- For marketing/personality quizzes where "first instinct" answers may be MORE authentic, auto-advance could be a feature, not a bug.
- For any quiz where deliberation matters, auto-advance is harmful.
- Source: https://www.surveypractice.org/article/6381-impacts-of-implementing-an-automatic-advancement-feature-in-mobile-and-web-surveys

### Antoun et al. (2017) Warning

"Did not recommend use of an automatic advancement feature for a one-time survey on a smartphone, because automatic advancement seems to require learning on the part of the respondent to use it properly."
- Source: https://www.surveypractice.org/article/6381-impacts-of-implementing-an-automatic-advancement-feature-in-mobile-and-web-surveys

## Current Implementation Analysis

The Hermetic Flight quiz currently uses auto-advance with a **500ms delay** after answer selection.

### Problems with the Current 500ms Auto-Advance

1. **500ms is aggressive**. The user barely has time to confirm their selection visually before the screen transitions.
2. **No explicit "Next" affordance**: If a user wants to reconsider, they must use the "Previous" button after already advancing -- high friction for correction.
3. **Mismatched to answer complexity**: Some questions have short answers ("Fully Reversible") and some have long, nuanced answers. A flat 500ms treats them identically.
4. **Mobile users particularly affected**: On mobile, accidental taps are more common. A 500ms auto-advance turns an accidental tap into an irreversible advance.
5. **First-time unfamiliarity**: Users on their first question don't expect auto-advance and may be surprised.

## Recommendation

### Hybrid Approach: Auto-Advance with Escape Hatch

Based on the research, the optimal approach for a marketing personality quiz is:

1. **Keep auto-advance** -- it creates momentum and reduces friction (no "Next" button decision fatigue)
2. **Extend delay to 800-1200ms** -- gives users enough time to see their selection confirmed visually, reduces "oh no I didn't mean that" reactions
3. **Show a visible countdown or progress indicator** during the delay -- makes the auto-advance predictable rather than surprising
4. **Allow tap-to-cancel during the delay** -- if user taps elsewhere or their selection during the countdown, cancel the auto-advance and let them reconsider
5. **Keep the back button** -- already implemented, this is the safety valve

### Alternative: Explicit Navigation Only

For questions with longer/more complex answers (scenario-based or forced-ranking), switch to explicit "Next" button navigation. This can be determined per-question based on question type.

The mixed approach mirrors how validated instruments work: simple preference questions auto-advance; complex scenario questions require explicit confirmation.
