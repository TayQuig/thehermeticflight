# Research: Skip vs. No-Skip on Email Gates

## The Question

The Designer proposes an email gate with a "skip for now" option. The DA says
gate the journey content instead of the result. What does the data say?

## 1. Skip Rates on Optional vs. Mandatory Gates

### Finding: No rigorous A/B test data exists comparing skip vs. mandatory gates in quiz funnels specifically.

Despite extensive searching, there is no published study that directly
compares the same quiz with (a) mandatory email gate and (b) optional skip
gate, measuring both email capture rate and downstream engagement.

What exists instead is:

**Platform recommendations (directional, not empirical):**

- **Okendo** (quiz platform): "By allowing users to skip the email question,
  there's a higher likelihood that they will complete the quiz, as some
  quiz-takers simply prefer not to share their email address, especially if
  they are unfamiliar with your brand."
  - Source: https://support.okendo.io/en/articles/9077941-quizzes-completion-rate-optimization
  - Note: No specific skip rate percentage provided.

- **Thrive Themes**: "Skip option: Some quizzes allow 'skip' but show degraded
  results -- NOT recommended for lead gen."
  - Source: https://thrivethemes.com/how-to-create-a-quiz-funnel/
  - Note: This is a recommendation, not data.

- **RightMessage**: Recommends including a "skip this step" link because "it
  builds trust and still lets people move forward without pressure."
  - Source: https://rightmessage.com/grow-your-email-list/quiz-assessment-funnels
  - Note: Platform recommendation, no conversion data provided.

**Verdict: UNVERIFIED.** No empirical data found on skip rates specifically
for quiz email gates. This is a significant gap in the available evidence.

### Adjacent data: Form field optionality (not quiz-specific)

The closest empirical data comes from general form optimization research:

- **Changing phone number from mandatory to optional** decreased abandonment
  from 39% to 4% (a 90% reduction in abandonment).
  - Source: https://www.amraandelma.com/gated-content-conversion-statistics/
    (citing Unbounce Conversion Benchmark Report)

- **Reducing form fields from 4 to 3** boosts conversion by up to 50%.
  - Source: Same (citing Unbounce)

- **Single-field forms (email only)** convert at 23.4%, nearly triple the rate
  of four-field forms.
  - Source: Same (citing Unbounce)

**Extrapolation**: If removing a PHONE field reduces abandonment by 90%, making
the ONLY field optional should also reduce abandonment significantly. But the
magnitude is unknown for quiz contexts where the curiosity gap (wanting to see
results) creates different incentives than a standard lead form.

**Verdict: VERIFIED (for general forms).** UNVERIFIED for quiz-specific
contexts.

## 2. Conversion Rate Impact of Skip Options

### The Tradeoff Framework

The skip option creates a three-way tradeoff:

| Metric | Mandatory gate | Optional (skip) gate |
|--------|---------------|---------------------|
| Email capture rate (of completers) | Higher (est. 62%) | Lower (est. 40-50%) |
| Quiz completion rate | Lower (some abandon) | Higher (skip reduces friction) |
| Net emails collected (per 100 starters) | Higher per completer, fewer completers | Lower per completer, more completers |
| User trust/brand sentiment | Lower (feels coercive) | Higher (feels respectful) |
| Result page shares | Lower (fewer see results) | Higher (more see results) |

**The critical calculation**: Does the skip option result in MORE or FEWER total
emails per 100 quiz starters?

**Scenario modeling (using Interact-derived benchmarks):**

Assume 100 quiz starters, 65 complete all questions.

**Mandatory gate**:
- 62% of 65 completers submit email = 40.3 emails
- 38% of 65 completers abandon at gate = 24.7 people see nothing
- Net: 40.3 emails, 40.3 people see results

**Optional gate (estimate: 50% submit, 30% skip, 20% abandon)**:
- 50% of 65 submit email = 32.5 emails
- 30% of 65 skip = 19.5 people see results without email
- 20% of 65 abandon = 13 people (some who would have abandoned anyway)
- Net: 32.5 emails, 52 people see results

**Delta**: Mandatory gate captures ~8 more emails per 100 starters, but ~12
fewer people see their result. Those 12 people are potential sharers and
potential later converters.

**However**: If completion rate itself increases with an optional gate (because
users know they won't be trapped), the math shifts further. If completion goes
from 65% to 70%:

**Optional gate with higher completion (70% * 50% = 35)**:
- 35 emails, 56 people see results

The gap narrows to ~5 emails, and 16 more people see results.

**Verdict: UNVERIFIED (modeled, not empirical).** The models suggest mandatory
gates capture marginally more emails but significantly fewer people see results.
The right choice depends on whether THF's primary KPI is email count or funnel
reach.

## 3. Partial Results (Name Only) vs. Full Results

### Finding: The "teaser reveal" strategy is widely recommended but lacks controlled evidence.

**The strategy**: Show the archetype NAME immediately after the quiz (satisfying
the curiosity gap and enabling sharing), but gate the DETAILED description,
journey content, and personalized guidance behind email.

**Evidence for this approach:**

- **Gated content best practice**: "Hybrid approaches that offer a sneak peek
  or summary of content for free, but require a form to access the whole piece"
  are increasingly recommended.
  - Source: https://www.benchmarkemail.com/blog/when-to-gate-content/

- **Gated content converts 45% better than free assets** but "hybrid gating
  tactics, like optional forms or teaser content, will play a big role in
  growth."
  - Source: https://www.amraandelma.com/gated-content-conversion-statistics/
    (citing Content Marketing Institute)

- **76% of B2B marketers plan to use hybrid gating** (mixing free and gated
  content) by 2025.
  - Source: Same

- **Greg Faxon's archetype quiz** gates ALL results behind email ("ask
  participants for their email before showing them the result"). He reports
  4,988 subscribers in one year from this approach. No comparison to a partial-
  reveal approach is available.
  - Source: https://www.gregfaxon.com/blog/quiz

**No controlled study compares:**
- Show name only -> gate description -> email
- Show nothing -> email -> full results
- Show name + description -> gate journey content -> email

**Verdict: UNVERIFIED.** The partial-reveal strategy is logically sound and
widely recommended in content marketing, but there is no quiz-specific A/B test
comparing it to full gating.

### Theoretical Analysis: What the Curiosity Gap Literature Suggests

The email gate works because of the "curiosity gap" -- the user has invested
time and wants to know their result. Showing the archetype NAME satisfies the
primary curiosity ("What am I?") but creates a SECONDARY curiosity ("What does
that mean? What's my journey?").

The question is: does satisfying primary curiosity REDUCE the motivation to
provide email?

Arguments FOR partial reveal:
1. The user still has unsatisfied secondary curiosity (what does it mean?)
2. The user can share immediately ("I'm The Shadow Dancer!" -- even without
   the full description), increasing viral reach
3. Trust is higher (the quiz delivered a result; the email is for MORE value)
4. The value proposition shifts from "pay to see" (coercive) to "get the
   premium experience" (aspirational)

Arguments AGAINST partial reveal:
1. Primary curiosity is the strongest motivator. Once satisfied, secondary
   curiosity has ~60-70% of the motivational force (estimated from content
   marketing data: teaser content loses about 30% of gated conversion).
2. Some users will be satisfied with just the name and leave (the "good enough"
   effect)
3. Sharing without context may produce lower-quality viral sharing ("I got
   Shadow Dancer" without understanding what it means)

**Net assessment**: Partial reveal likely trades ~15-25% of email captures for
significantly higher sharing and trust. For a pre-launch Kickstarter funnel
where viral reach may matter more than email count, this is likely the right
trade.

## 4. Evidence from Spiritual/Wellness/Personality Quiz Audiences

### Finding: Very limited audience-specific data exists.

**What we know about this audience:**

- **Personality quizzes** have the highest completion rates (60-80%) among all
  quiz types.
  - Source: https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates

- **Coaching/courses** industry (closest proxy to spiritual/wellness) shows:
  - 44.9% start-to-lead rate (above the 40.1% average)
  - 59.1% completion rate (below the 65% average)
  - 76.0% implied gate conversion (above the 62% average)
  - Source: Interact 2026 Report

  This suggests the coaching/spiritual audience is more willing to provide email
  at the gate (higher gate conversion) but slightly less likely to finish the
  quiz (lower completion). The implication: these users are more engaged when
  they engage, but more selective about starting/continuing.

- **Privacy sensitivity**: The DA's claim that "this audience is
  privacy-sensitive and allergic to 'give us your email to see your results'
  dark patterns" is plausible but UNVERIFIED. No data specifically measures
  privacy sensitivity among tarot/spiritual/wellness quiz audiences. The
  Interact data for coaching/courses (the closest proxy) actually shows HIGHER
  gate conversion, not lower, which weakly contradicts this concern.

- **LonerWolf** (a spiritual archetype test site similar to THF) offers results
  with NO email gate -- results are shown immediately. This suggests at least
  one competitor prioritizes reach over capture.
  - Source: https://lonerwolf.com/spiritual-archetype-test/

- **Yaqeen Institute** (spiritual personality quiz) also appears to show results
  without an email gate.
  - Source: https://myspiritualpersonality.yaqeeninstitute.org/

**Verdict: UNVERIFIED.** No audience-specific data exists for tarot/spiritual
quiz funnels. The closest proxy (coaching/courses) actually shows above-average
gate conversion, which is a mildly positive signal.

## Summary: What the Data Supports

| Question | Answer | Evidence Level |
|----------|--------|----------------|
| Skip rate on optional gates? | Unknown -- no quiz-specific data | UNVERIFIED |
| Mandatory vs. optional capture volume? | Mandatory captures ~8 more emails per 100 starters | MODELED (not empirical) |
| Partial reveal impact? | Widely recommended, likely trades 15-25% capture for higher sharing | UNVERIFIED (logical inference) |
| Spiritual audience behavior? | Coaching proxy shows 76% gate conversion (above average) | WEAKLY VERIFIED (proxy data) |
| Does skip option increase completion? | Likely yes (form field research supports) | WEAKLY VERIFIED (adjacent evidence) |

## Recommendation

The data does not clearly favor one approach over another. What the data DOES
support:

1. **An email gate of SOME form will capture dramatically more emails than the
   current zero-gate design.** Even a poor gate captures 30-40% of starters as
   leads vs. 0% today. This is the highest-leverage change regardless of
   implementation details.

2. **The mandatory vs. optional vs. partial-reveal decision cannot be made from
   existing data.** It must be A/B tested. Ship the simplest implementation
   first (mandatory gate, full block), measure, then iterate.

3. **If A/B testing is not feasible before launch**, the partial-reveal approach
   (show archetype name, gate detailed content) is the safest default because:
   - It preserves sharing (critical for pre-launch viral growth)
   - It still creates email incentive (detailed content, journey, email drip)
   - It avoids the brand-trust risk of full gating in a niche audience
   - The coaching/courses proxy data suggests this audience converts at the
     gate at above-average rates anyway

4. **The DA's proposal (gate journey content instead of result)** is essentially
   the partial-reveal approach with a specific implementation: show full result
   page, gate the archetype journey page. This is a viable alternative that
   moves the gate LATER in the funnel (after result page, before journey page),
   which may actually increase email quality at the cost of email volume.
