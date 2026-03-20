# Research: Labor Illusion, Operational Transparency & Calculating Interstitials

## The Core Research: Buell & Norton (2011)

**Citation**: Buell, R.W. & Norton, M.I. (2011). "The Labor Illusion: How Operational Transparency Increases Perceived Value." Management Science, 57(9), 1564-1579.
- Source: https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1376
- Full paper: https://www.hbs.edu/ris/Publication%20Files/Norton_Michael_The%20labor%20illusion%20How%20operational_f4269b70-3732-4fc4-8113-72d0c47533e0.pdf

### Experiment Design

- **266 participants** using simulated travel comparison website
- Variables: wait times (0-60 seconds), transparency conditions (dynamic flight list vs. progress bar)
- 5 experiments total across travel and dating domains

### Key Findings

1. **People preferred longer waits with transparency** over instant results without transparency -- even when results were identical.
2. **Operational transparency increased perceived value by 8%** vs. no transparency.
3. **Satisfaction was higher at ALL wait intervals** when participants saw a dynamic list of what was being searched, compared to just a progress bar.
4. **Mechanism**: Transparency -> perceived effort (beta=0.23, p<0.01) -> reciprocity (beta=0.58, p<0.01) -> perceived value (beta=0.68, p<0.01).

### Follow-Up Finding (Buell, 2015 -- Online Dating)

- When shown a **suitable** match with transparency, satisfaction INCREASED
- When shown an **unsuitable** match with transparency, satisfaction DECREASED
- **Implication**: The labor illusion amplifies existing quality signals. It does not rescue bad results.
- Source: https://www.marketingweek.com/richard-shotton-labour-illusion/

### Real-World Implementations

| Company | Implementation | Effect |
|---|---|---|
| Open-kitchen restaurants | Visible food preparation | **+22% higher ratings** for identical food |
| Domino's Pizza Tracker | Real-time prep stages visible | Industry-leading satisfaction scores |
| Dyson advertising | "5,000+ prototypes tested" messaging | Perceived quality premium |
| BBVA (bank) | ATM animation showing notes being counted | Reduced perceived wait frustration |

- Source: https://www.marketingweek.com/richard-shotton-labour-illusion/

### Andrea Morales Study (USC, 2005)

- 46 participants evaluated estate agents
- Agent who spent 9 hours (manual) vs. 1 hour (computer) finding apartments
- **Additional effort increased ratings by 36%**
- Source: https://www.marketingweek.com/richard-shotton-labour-illusion/

## Application to Quiz Interstitials

### What a "Calculating" Interstitial Should Do

Based on the research, the interstitial between last question and results should:

1. **Show operational transparency** -- not just a generic spinner, but named stages of analysis:
   - "Analyzing your pattern across 4 dimensions..."
   - "Comparing against 6 archetype profiles..."
   - "Calculating your primary alignment..."
   - "Preparing your personalized result..."

2. **Use dynamic, changing content** -- the travel website study shows that a dynamically updating list outperforms a static progress bar at all wait intervals.

3. **Duration: 3-8 seconds** -- long enough to feel substantive, short enough to not test patience. The research tested up to 60 seconds; a 3-8 second window is well within the zone where transparency beats speed.

4. **Include visual richness** -- animation, particle effects, or thematic imagery (stars, cards, flight imagery) that reinforce the brand's mystical aesthetic.

### Timing Considerations

The interstitial should appear BEFORE the email gate (if the gate blocks results) or AFTER the email gate (if the interstitial precedes the reveal). The optimal flow:

**Questions -> Email Gate -> Calculating Interstitial -> Results**

This puts the labor illusion right before the payoff, maximizing the perceived value of the result reveal.

### UX Integration with Interstitial Topic Screens

"Interstitial topic screens help pace the user and allow mental adjustment before a new quiz section begins."
- Source: https://everydayindustries.com/product-recommendation-quiz-tips/

If the quiz is divided into sections (e.g., "About You" / "Your Practice" / "Your Path"), section interstitials can also serve as pacing devices mid-quiz.

## Current State: The Hermetic Flight

The current quiz has **no interstitial** -- after the last question, results appear after a 250ms fade transition. This misses the labor illusion entirely and makes the classification feel trivial/algorithmic rather than personalized/meaningful.
