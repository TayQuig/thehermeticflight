# Research: Email Gate Conversion Numbers -- Clarification

## The Question

Round 1 stated "92-97% of quiz completers submit when gated before results."
The Devil's Advocate read the same Interact 2026 source and interpreted it as
"65% of quiz starters complete all questions, but only 40.1% convert to leads
-- a ~38% relative drop at the email gate." Are both true?

## What Interact Actually Reports

The Interact Quiz Conversion Rate Report 2026 reports exactly two metrics:

| Metric | Definition | Value |
|--------|-----------|-------|
| Start-to-finish rate | % of quiz starters who answer all questions | 65% |
| Start-to-lead rate | % of quiz starters who become a lead (provide email) | 40.1% |

Source: https://www.tryinteract.com/blog/quiz-conversion-rate-report/

**Critically, Interact does NOT report the conversion rate *at the email gate
itself* (i.e., of those who complete all questions, what % submit email).** This
number is not in the report. It must be derived.

### The Derived Calculation

If 65% of starters complete all questions, and 40.1% of starters become leads:

    Gate conversion rate = 40.1% / 65% = 61.7%

**Verdict: Approximately 62% of quiz completers submit their email at the
gate -- not 92-97%.**

### Industry Breakdown (Interact 2026)

| Industry | Start-to-lead | Start-to-finish | Implied gate rate |
|----------|--------------|-----------------|-------------------|
| Coaching/Courses | 44.9% | 59.1% | 76.0% |
| E-Commerce | 37.6% | 55.5% | 67.7% |
| Service Providers | 42.2% | 47.3% | 89.2% |
| **Average** | **40.1%** | **65%** | **61.7%** |

Source: Same Interact 2026 report.

Note: Service providers show 89.2% implied gate conversion -- this may be
because their quiz takers are already warm leads (actively seeking services).
Coaching shows 76%. E-commerce is lower at 67.7%.

### Data scope

The report states the 40.1% figure has "held steady after generating over 80
million leads through our quizzes" since 2013. This is a large, longitudinal
dataset.

Source: https://www.tryinteract.com/blog/quiz-conversion-rate-report/

## Where Did "92-97%" Come From?

My Round 1 artifact cited two sources for this claim:

1. **Thrive Themes / The Well-Paid Expert**: "97% of people who complete a quiz
   submit the opt-in form when it appears between last question and results
   reveal."
   - Source cited: https://thewellpaidexpert.com/quiz-funnels/
   - **REFUTED**: WebFetch of this URL found NO mention of a 97% statistic
     anywhere on the page. The article discusses quiz funnels and anecdotal case
     studies ($60K revenue, 4000-person list) but provides no gate conversion
     rate statistics.

2. **Dupple**: Referenced as a supporting source for the 92-97% range.
   - Source cited: https://dupple.com/blog/quiz-funnels-vs-lead-magnets-which-one-wins-the-conversion-battle-in-2026
   - **REFUTED**: WebFetch confirmed Dupple reports "average quiz opt-in rates
     range from 30-40%" (citing KyLeads Benchmark Data, 2024) and "opt-in rates
     topping 40%" (citing Interact 2025/2026). No mention of 92-97%.

3. **Thrive Themes case study**: A separate Thrive Themes case study may be the
   original source. A case study about an Amazon quiz reportedly showed only
   2.8% drop-off at the opt-in gate (~97.2% gate conversion). However:
   - This is a SINGLE case study, not an industry benchmark
   - WebFetch of the case study page returned only CSS/JS (content not
     extractable)
   - A single quiz in a single niche achieving 97% does not generalize
   - **UNVERIFIED**: Cannot confirm the 97.2% figure exists in the case study

## Corrected Understanding

| Claim | Verdict | Correct Value |
|-------|---------|---------------|
| "40.1% start-to-lead rate" | **VERIFIED** | 40.1% (Interact, 80M+ leads) |
| "65% completion rate" | **VERIFIED** | 65% of starters finish all questions |
| "92-97% of completers submit email" | **REFUTED** | ~62% (derived from Interact data) |
| DA's "~38% relative drop at gate" | **VERIFIED** | 38.3% relative drop (65% -> 40.1%) |

### Reconciling the Two Perspectives

The Researcher and Devil's Advocate were using different frames on the same
data, but BOTH were partially wrong:

- **Researcher's error**: Cited 92-97% gate conversion based on sources that
  either don't contain that number (The Well-Paid Expert) or contradict it
  (Dupple says 30-40%). The actual derived figure is ~62%.

- **Devil's Advocate's framing was accurate**: The ~38% relative drop at the
  gate is mathematically correct (1 - 40.1/65 = 38.3%).

## What This Means for The Hermetic Flight

The email gate will cause a meaningful drop. The best available data says:

- ~62% of completers will submit email (industry average)
- ~76% for coaching/education-adjacent niches
- ~38% relative loss from completion to lead capture

For a spiritual/personality quiz with a niche audience, the rate is genuinely
uncertain. Service providers show 89% (warm leads), while e-commerce shows 68%
(cold/curious). A tarot audience taking a self-discovery quiz is probably
somewhere between warm and curious -- estimate 65-75% gate conversion as a
reasonable range.

## Other Benchmark Sources

| Source | Claimed Rate | What It Measures | Verdict |
|--------|-------------|-----------------|---------|
| KyLeads Benchmark (2024) | 30-40% | Quiz opt-in rate (start-to-lead) | VERIFIED via Dupple |
| Interact 2026 | 40.1% | Start-to-lead | VERIFIED (direct source) |
| LeadQuizzes (2016) | 33% | Average lead capture rate | VERIFIED (their own data) |
| Ramit Sethi quiz | 45%+ | Opt-in rate | UNVERIFIED (anecdotal) |
| Riddle Lab | 47-50% | Form completion if form is seen | VERIFIED (A/B test, N=2024) |
| RightMessage | 80%+ | Completion rate (NOT lead rate) | UNVERIFIED (marketing claim) |
| Okendo | 60% | Quiz completion rate benchmark | VERIFIED (platform data) |

Note: The Riddle Lab figure of 47-50% "form completion among those who see the
gate" from the Round 1 artifact is the closest to the derived 62% from Interact.
The difference may be because Riddle's study used different question formats
(Likert vs. situational), or because Interact's data includes quizzes where the
gate is more compelling.
