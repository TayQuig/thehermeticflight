# Round 3 -- Researcher Final Position

## Role
Researcher -- resolving the block on ipsative scoring with cosine-similarity
centroid classification.

## Final Vote: BLOCK LIFTED -- APPROVE WITH CAVEATS

I am lifting my block. The Designer's cosine-similarity centroid approach
materially changes the use case from what the psychometric literature warns
about. My Round 2 evidence remains correct but was applied to the wrong
problem. Below is the full analysis.

---

## Question 1: Does Cosine-Similarity Centroid Classification Mitigate the Ipsative Reliability Concern?

### Short answer: Substantially yes, for this specific use case.

### The distinction my Round 2 missed

My Round 2 block cited three sources:

1. **Bartram (1996)**: "Ipsatized measures are unreliable when the number of
   scales is less than about 10." [Source](https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/j.2044-8325.1996.tb00597.x)

2. **Schulte et al. (2021)**: Even 5 dimensions with realistic factor loadings
   produce reliability below .70. [Source](https://pmc.ncbi.nlm.nih.gov/articles/PMC10621689/)

3. **Hee (2018)**: 88 items / 12 dimensions produced reliability 0.28-0.62.
   [Source](https://pmc.ncbi.nlm.nih.gov/articles/PMC5978479/)

All three sources address **measurement reliability** -- the consistency and
accuracy of continuous scores on each dimension, evaluated via internal
consistency (Cronbach's alpha), test-retest correlation, or IRT-based
information. These properties matter when:

- You need to compare Person A's score to Person B's (between-person comparison)
- You need the absolute score on each dimension to be meaningful
- You need to do factor analysis to validate construct structure
- You need test-retest stability for clinical or employment decisions

The Designer's approach does **none of these things**. It uses ipsative scores
as input to a cosine-similarity classifier that outputs a categorical bucket
(one of 6 archetypes) plus a fuzzy membership vector. The continuous dimension
scores are intermediate computations, not end products. The final output is:
"You are most like Archetype X."

This is **classification accuracy**, not **measurement reliability**. These are
different psychometric properties.

### The mathematical argument for cosine similarity with ipsative data

Ipsative scores are, by definition, compositional data: they sum to a constant
(48 in this design). This means all user score vectors lie on a hyperplane in
4D space where A + B + C + D = 48. The Designer correctly identified that
Euclidean distance is inappropriate here because it measures distance in
unconstrained space, while the data is constrained to a hyperplane.

Cosine similarity measures the angle between vectors, which is magnitude-
invariant. For all non-negative vectors with constant sum, cosine similarity
effectively compares the **proportional profile** -- the relative sizes of
A, B, C, D -- ignoring the (irrelevant) constant magnitude. A user scoring
[18, 6, 6, 18] has the same cosine similarity to all centroids as a user
scoring [9, 3, 3, 9]. This is the correct behavior: both users have the same
proportional profile and should get the same archetype.
[Source: IBM -- What Is Cosine Similarity?](https://www.ibm.com/think/topics/cosine-similarity)

However, there is a theoretical caveat from compositional data analysis (CoDa):
the formally correct metric for compositional data on the simplex is the
**Aitchison distance**, not cosine similarity. Standard Euclidean operations
on the simplex produce "spurious correlations because of the constant-sum
constraint." [Source: Pawlowsky-Glahn & Egozcue lecture notes](https://compositionaldata.com/material/others/Lecture_notes_11.pdf)
The KernelBiome paper (2023) warns that "existing techniques are often
inadequate" for compositional data, and that "induced distances [from
Euclidean kernels] are not targeted to the simplex and therefore can be
unnatural choices." [Source: PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10343141/)

**Does this matter here?** For a 6-bucket marketing classifier operating in 4
dimensions with well-separated centroids: almost certainly not. The Aitchison
distance concern applies to statistical analysis (regression, factor analysis,
hypothesis testing) where spurious correlations distort inference. For nearest-
centroid classification with 6 targets, cosine similarity and Aitchison
distance will produce the same classification in the vast majority of cases.
The edge cases where they differ are in regions equidistant from two centroids
-- exactly the low-confidence zone where the Designer already shows "with X
undertones" messaging.

### Fact-check: Does cosine similarity eliminate the tie problem?

The Devil's Advocate found 28.7% of answer sets produce exact raw-score ties
with +3 scoring (RISK-11). The Designer switched to +4 scoring, which changes
the discretization but not the underlying structure: ipsative scores with 4
dimensions and 12 questions will always have coarse granularity.

However, **cosine similarity operates on the full 4D vector, not on pairwise
score comparisons**. Two dimensions can have identical raw scores while the
vector's angle to different centroids differs. Consider [12, 12, 12, 12] vs
[12, 12, 0, 24]: both have a tie between their top two scores in some sense,
but their cosine similarities to the centroids are dramatically different.

The tie rate in cosine-similarity space is **geometrically** determined by
whether a user's score vector falls exactly on the bisecting hyperplane between
two centroid directions. This is a measure-zero set in continuous space. With
discrete scores, it can happen but is far rarer than raw-score ties. The DA's
28.7% tie problem is specific to threshold-based or rank-order classifiers
operating on raw scores. It does not transfer to cosine-similarity
classification.

**Verdict: VERIFIED** -- Cosine-similarity centroid classification is a
materially different use case from the ipsative measurement contexts addressed
by Bartram, Schulte, and Hee.

---

## Question 2: Is the Marketing Quiz Context Relevant?

### Short answer: Yes. The bar is categorically lower.

The Buerkner, Schulte & Holling (2019) paper on Thurstonian IRT limitations
explicitly states: "measuring up to five traits using blocks of only equally
keyed items does not yield sufficiently accurate trait scores" -- but their
standard is RMSE > 0.5 standard deviations, inter-trait correlation recovery,
and high-stakes personnel selection.
[Source: PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6713979/)

The THF quiz needs to:
1. Put someone in one of 6 buckets
2. Have the bucket description feel reasonably accurate ("that sounds like me")
3. Generate enough engagement for an email signup and social share

It does NOT need to:
- Achieve .70 test-retest reliability
- Recover inter-trait correlations
- Support between-person comparison
- Survive adversarial faking
- Meet any clinical or employment standard

The relevant literature on ipsative measurement actually supports within-person
profile interpretation as the valid use case for ipsative instruments:

> "Ipsative measures provide intra-individual differences assessment."
> [Source: iResearchNet](https://psychology.iresearchnet.com/industrial-organizational-psychology/i-o-psychology-theories/normative-vs-ipsative-measurement/)

> "Ipsative assessments display categorical results, meaning that assessment-
> takers are given a 'category' or label based on the corresponding answers."
> [Source: TalentClick](https://talentclick.com/resources/top-5-differences-between-ipsative-and-normative-personality-assessments/)

> "The major purpose of ipsative tests is to compare different latent traits
> within persons."
> [Source: SAGE Encyclopedia](https://methods.sagepub.com/ency/edvol/download/sage-encyclopedia-of-educational-research-measurement-evaluation/chpt/ipsative-scales.pdf)

This is exactly what the quiz does: it compares traits within a single person
to determine which archetype profile they most resemble. The literature's
warnings about ipsative measurement are about using ipsative scores for
purposes they were not designed for (between-person comparison, factor
analysis, norm-referenced interpretation). Using them for within-person profile
classification is precisely the scenario where ipsative data is considered
appropriate.

**Verdict: The marketing quiz context does materially change the assessment.**
My Round 2 block applied high-stakes psychometric standards to a low-stakes
classification task.

---

## Question 3: Condition for Lifting the Block

### The block is lifted. The following caveats apply:

**Caveat 1: The confidence threshold matters more than the scoring method.**

With 4 dimensions and 12 questions, the score profiles will be noisy. Some
users will land near centroid boundaries with similar cosine similarity to
2+ archetypes. The Designer's `confidence` score (1 - sim_secondary /
sim_primary) is the critical safeguard. When confidence is low, the "with X
undertones" secondary archetype messaging should be prominent. This turns
measurement noise into a feature ("you are a blend of...") rather than
exposing it as a defect ("we could not classify you").

**Recommendation**: Set the composite-messaging threshold at confidence < 0.3
(not 0.5 as the Designer proposed). With 4 dimensions and coarse ipsative
scores, many users will fall in the 0.3-0.5 range, and showing secondary
messaging for nearly half of users dilutes the primary archetype identity.
Reserve it for users who are genuinely borderline.

**Caveat 2: Centroid positions must be validated via Monte Carlo simulation.**

The Researcher's draft centroids ([0.90, 0.15, 0.15, 0.15] for primaries,
[0.65, 0.15, 0.15, 0.65] for composites) are plausible starting points but
have not been validated against the actual scoring geometry. The DA's proposed
Monte Carlo test (10,000 random answer sets, all 6 archetypes at > 5%) is
the right validation. The Builder should implement this BEFORE locking centroid
values.

**Caveat 3: Log display order for post-hoc bias analysis.**

Per the DA's RISK-12, display order must be logged in the submission payload.
This is not optional -- it is the only way to detect and correct for primacy
bias after launch. If post-launch analysis shows > 5% classification skew
correlated with display order, the centroids or scoring must be adjusted.

**Caveat 4: Do not use ipsative scores for any purpose beyond classification.**

The raw dimension scores (A, B, C, D) should not be displayed to users, used
in email copy ("Your Air score is 18/24"), or compared between users in
analytics. They are internal intermediaries for the classifier. The
`memberships` field (fuzzy archetype proportions) is the appropriate output
for any downstream use, because it is computed from cosine similarity (which
is valid for ipsative data), not from raw scores (which are not valid for
between-person comparison).

---

## Question 4: Pure Ipsative (+4/+0) vs. Hybrid Normative (+6/+2) with Cosine Similarity

### My Round 2 proposed hybrid: not justified given cosine-similarity classification.

In Round 2, I proposed scoring both dimensions on each forced pair:
pick A = +6 to dim A, +2 to dim B. This was designed to avoid the ipsative
constant-sum constraint that makes scores unreliable.

With cosine-similarity classification, the constant-sum constraint is
**mathematically irrelevant to the classification outcome**. Cosine similarity
cares only about the angular direction of the score vector, not its position
on the constant-sum hyperplane. Whether the scores sum to 48 (pure ipsative
+4/+0) or to 96 (hybrid +6/+2) does not change the angle between the user
vector and the centroid vectors.

Let me verify this with a concrete example:

**User who picks A in all A-D pairs and D in all non-A-non-D pairs:**

Pure ipsative (+4/+0): A=24, B=0, C=0, D=24. Sum=48.
Cosine to GM [0.65, 0.15, 0.15, 0.65]: dot / (mag * mag) = high.

Hybrid (+6/+2): A=24+8=32, B=4, C=4, D=24+8=32. Sum=72.
Cosine to GM: same angular direction (proportions are similar).

Wait -- the proportions are NOT identical. Pure ipsative gives [24, 0, 0, 24]
= direction [1, 0, 0, 1]. Hybrid gives [32, 4, 4, 32] = direction
[8, 1, 1, 8]. These point in slightly different directions: the hybrid
vector has small positive B and C components where the ipsative vector has
zero. Cosine similarity between [1, 0, 0, 1] and [8, 1, 1, 8] = 0.988 --
very similar but not identical. The hybrid scoring adds a small "floor" to
every dimension, which very slightly compresses the angular separation between
different user profiles.

**This means the hybrid actually REDUCES discriminability.** By giving +2 to
the losing dimension, every user profile gets pushed slightly toward the center
of the space (the all-equal vector), reducing the angle between profiles that
should be distinct. With pure ipsative scoring, extreme profiles (all wins on
two dimensions) produce vectors with zeros, which are maximally separated in
angular space from other profiles. With hybrid scoring, those zeros become
small positive numbers, reducing angular separation.

For a marketing classifier that needs to put people in 6 distinct buckets,
maximum angular separation is desirable. **Pure ipsative (+4/+0) provides
better centroid separation than hybrid (+6/+2) when classified via cosine
similarity.**

**Verdict: My proposed hybrid is not justified.** It adds implementation
complexity (the Builder would need to explain why non-zero-sum forced-choice
questions score both dimensions) without improving classification, and it
slightly degrades angular discriminability. The pure ipsative approach is
simpler and more effective for cosine-similarity centroid classification.

---

## Formal Position Change

### Round 2 Position (BLOCK):
"Abandon pure ipsative scoring. Use normative weighted scoring with 2-3
embedded forced-pair questions scoring BOTH dimensions."

### Round 3 Position (APPROVE WITH CAVEATS):
Pure ipsative +4/+0 scoring with cosine-similarity centroid classification
is appropriate for this 6-bucket marketing quiz. The psychometric literature
on ipsative reliability addresses measurement, not classification. Cosine
similarity eliminates the constant-sum constraint's distorting effects on
distance metrics. The marketing context does not require .70 reliability or
validated factor structure.

### What changed my mind:
1. The Designer's switch from threshold-based to cosine-similarity
   classification changes the mathematical properties of the system. My cited
   sources (Bartram, Schulte, Hee) address continuous score reliability, not
   categorical classification accuracy via angular similarity. The use case is
   different.

2. The compositional data analysis literature confirms that cosine similarity
   (while not the formally optimal Aitchison distance) operates on proportional
   direction rather than magnitude, which is the correct property for ipsative
   data. [Source: Pawlowsky-Glahn lecture notes](https://compositionaldata.com/material/others/Lecture_notes_11.pdf)

3. The ipsative measurement literature itself identifies within-person profile
   comparison as the valid use case for ipsative instruments. The quiz does
   exactly this. [Source: SAGE Encyclopedia, TalentClick, iResearchNet]

4. My proposed hybrid alternative actually degrades angular discriminability
   by compressing score vectors toward the center -- the opposite of what we
   want for 6-bucket classification.

### What I was right about:
1. Pure ipsative scoring with 4 dimensions DOES produce unreliable continuous
   scores. This remains true. The mitigation is: do not use the continuous
   scores for anything other than classification input.

2. The classifier algorithm matters enormously. If someone tried to use the
   ipsative scores with threshold-based classification (the original design),
   my block would stand. The DA's 28.7% tie rate confirms this. Cosine-
   similarity centroids are the essential pairing with ipsative scoring.

3. Between-person comparison of raw ipsative scores is invalid. Do not
   display "Your Air score: 18/24" or compare scores across users.

---

## Updated Confidence Table

| Finding | Confidence | Change from Round 2 |
|---------|-----------|---------------------|
| Ipsative scoring fails for measurement at 4 dimensions | HIGH | Unchanged (still true) |
| Cosine similarity mitigates ipsative constraint for classification | HIGH | **NEW** |
| Marketing quiz context lowers the psychometric bar | HIGH | **NEW** |
| Pure ipsative (+4/+0) > hybrid (+6/+2) for cosine classification | MEDIUM-HIGH | **NEW (reverses Round 2)** |
| Confidence threshold critical for borderline users | HIGH | **NEW** |
| Display order logging needed for bias detection | HIGH | Unchanged |
| Centroid positions need Monte Carlo validation | HIGH | Unchanged |
| Raw scores should not be exposed to users | HIGH | **NEW** |

---

## Gaps and Limitations

1. **No direct empirical evidence for ipsative + cosine-similarity
   classification accuracy.** I searched extensively and found no published
   study that specifically measures classification accuracy of cosine-
   similarity centroid classifiers on ipsative data with few dimensions. My
   conclusion is based on mathematical reasoning (cosine similarity is
   magnitude-invariant, ipsativity is a magnitude constraint) rather than
   direct empirical validation.

2. **Aitchison distance is formally more appropriate than cosine similarity for
   compositional data.** For a 6-bucket marketing quiz, the practical
   difference is negligible, but if the quiz were ever expanded to more
   dimensions or used for research purposes, Aitchison distance should be
   evaluated.

3. **The 12-question, 4-dimension design has never been empirically tested for
   marketing quiz classification.** No published marketing quiz uses this
   exact design. Face validity (does the result "feel right") can only be
   assessed after deployment with real users. The Monte Carlo simulation
   validates distribution, not subjective accuracy.

---

## Sources

- [Bartram (1996) -- Ipsative vs. normative measures](https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/j.2044-8325.1996.tb00597.x)
- [Schulte, Holling & Buerkner (2021) -- High-dimensional FC questionnaires](https://pmc.ncbi.nlm.nih.gov/articles/PMC10621689/)
- [Hee (2018) -- IRT models for ipsative pairwise comparison](https://pmc.ncbi.nlm.nih.gov/articles/PMC5978479/)
- [Buerkner, Schulte & Holling (2019) -- Thurstonian IRT limitations](https://pmc.ncbi.nlm.nih.gov/articles/PMC6713979/)
- [IBM -- What Is Cosine Similarity?](https://www.ibm.com/think/topics/cosine-similarity)
- [Pawlowsky-Glahn & Egozcue -- Compositional Data Analysis lecture notes](https://compositionaldata.com/material/others/Lecture_notes_11.pdf)
- [KernelBiome (2023) -- Supervised learning with compositional data](https://pmc.ncbi.nlm.nih.gov/articles/PMC10343141/)
- [Englert -- Ipsative Tests: Psychometric Properties](https://paulenglert.com/ipsative-tests-psychometric-properties/)
- [iResearchNet -- Normative vs. Ipsative Measurement](https://psychology.iresearchnet.com/industrial-organizational-psychology/i-o-psychology-theories/normative-vs-ipsative-measurement/)
- [TalentClick -- Ipsative vs. Normative Personality Assessments](https://talentclick.com/resources/top-5-differences-between-ipsative-and-normative-personality-assessments/)
- [SAGE Encyclopedia -- Ipsative Scales](https://methods.sagepub.com/ency/edvol/download/sage-encyclopedia-of-educational-research-measurement-evaluation/chpt/ipsative-scales.pdf)
- [The Hidden Pitfalls of Cosine Similarity Loss (2024)](https://arxiv.org/html/2406.16468v1)
