# Round 1 — Designer Analysis

## Lens: Structure (Components, Contracts, Connections)

---

## 1. System As-Is: Current Architecture Map

### Components and Their Responsibilities

| Component | File | Responsibility | Render Mode |
|-----------|------|---------------|-------------|
| Quiz Page | `src/pages/quiz.astro` | 12-question quiz, email gate, classification, product research, result display | Static (client-side JS state machine) |
| Quiz Engine | `src/lib/quiz-engine.ts` | 7-phase state machine: intro → seg → scored → email-gate → calculating → [self-select] → results | Pure TS, browser-side |
| Classifier | `src/lib/classifier.ts` | Cosine-similarity to 6 centroids, returns `ClassificationResult` | Pure TS, used both server and client |
| Quiz Submit API | `src/pages/api/quiz-submit.ts` | Validates answers, re-classifies server-side, pushes to Loops.so | SSR (Vercel serverless) |
| Quiz Result Page | `src/pages/quiz/result/[archetype].astro` | Shareable archetype result, links to journey page | Static (getStaticPaths) |
| Journey Page | `src/pages/archetype/[slug].astro` | Deep archetype content behind cookie gate | SSR (`prerender = false`) |
| Journey Subscribe API | `src/pages/api/journey-subscribe.ts` | Email collection for journey page side door | SSR (Vercel serverless) |
| Archetype Content | `src/lib/archetype-content.ts` | 6 archetype definitions, slug conversion utilities | Pure TS data module |

### Data Flow: The Current Funnel

```
[1] /quiz (static)
    User answers 12 questions → email gate
    ├── Email provided → cookie set (thf_sub=kebab-slug) → API call → results shown
    └── Email skipped → re-capture form → (same as above on submit)

[2] /quiz/result/[archetype] (static)
    Shareable result page → links to /archetype/[slug]
    No auth check. Anyone with URL sees archetype description + CTA.

[3] /archetype/[slug] (SSR)
    Server reads thf_sub cookie
    ├── Cookie matches slug → full journey content rendered
    ├── Cookie missing/mismatched → hero + gate form rendered
    │   └── Gate form: email → fire-and-forget API → client-side cookie set → JS reveals content
    └── "Continue the Path" email series form always visible at bottom
```

### The Side Door (Problem Statement)

The journey page gate form (`journey-gate-email-form`) is a **standalone email capture** that:
1. Accepts any email address
2. Sets the `thf_sub` cookie client-side (optimistic reveal)
3. Calls `/api/journey-subscribe` (fire-and-forget)
4. Requires zero proof of quiz completion

This means anyone with a shared `/archetype/air-weaver` URL can enter any email and access all journey content immediately. The gate collects an email but creates a Loops.so contact tagged `source: 'journey_page'` with no quiz data, no dimension scores, no classification confidence, and no product research.

### The Cookie Contract

```
Name:     thf_sub
Value:    kebab-case archetype slug (e.g., "air-weaver")
Max-age:  2592000 (30 days)
Path:     /
SameSite: Lax
Set by:   Client-side JS in quiz.astro (line 740) and [slug].astro (line 369)
Read by:  Server-side Astro.cookies in [slug].astro (line 35)
Encoding: URL-encoded
Scope:    Per-archetype (single slug, not multi-archetype)
```

---

## 2. Structural Assessment: What Does "Close the Side Door" Mean?

Closing the side door is a **gate enforcement change** with three structural dimensions:

### Dimension A: Remove the Journey Page Gate Form

The simplest interpretation: remove the `journey-gate-email-form` from `[slug].astro` entirely. Without it, gated visitors see the hero section and nothing else. No email input, no way to set the cookie from the journey page.

**Structural impact:** Low. The form is self-contained (lines 123-161 in the template, lines 341-397 in the script). Removing it does not break any other component.

**Data flow impact:** The `/api/journey-subscribe` endpoint loses its only caller from the gate form path. The endpoint is still called by the "Continue the Path" email series form at the bottom. The series form does NOT set the `thf_sub` cookie — it only subscribes to the drip.

### Dimension B: What Replaces the Gate Form?

If the gate form is removed, gated visitors need guidance. The hero section already renders for everyone (lines 79-120). The question is what sits between the hero and the hidden content:

| Option | Component | Behavior |
|--------|-----------|----------|
| Dead end | Nothing — hero only | Visitor sees archetype teaser, no call to action. Wastes the visit. |
| Quiz redirect | CTA button linking to `/quiz` | Visitor is sent to the quiz. Must complete quiz + email gate to earn cookie. |
| Quiz redirect + context | CTA button with copy explaining they need to take the quiz | Same as above but with explanation of why. |

### Dimension C: The Cookie Remains the Only Key

Regardless of what replaces the gate form, the cookie is the only mechanism that unlocks the journey page. This is already the case — the change simply eliminates one of the two paths to obtaining the cookie.

**Paths to obtaining `thf_sub` cookie after the side door is closed:**
1. Complete quiz + provide email at email gate (quiz.astro line 919)
2. Complete quiz + skip email + provide email at re-capture form (quiz.astro line 980)

Both paths require completing all 12 quiz questions and providing an email address, which triggers server-side classification and Loops.so contact creation with full quiz data.

---

## 3. Proposed Architecture: The Hard Gate

### Component Changes

#### A. `src/pages/archetype/[slug].astro` — Journey Page

**Remove:** The entire `journey-gate-email-form` section (template lines 123-161, script lines 341-397).

**Add:** A quiz redirect CTA in its place, rendered only when `isGated` is true.

**Interface contract for the redirect CTA:**

```typescript
// Template: replaces the gate form section
// Condition: isGated === true (same as current gate form)
// Props consumed: urlSlug (for return-to parameter), archetypeData.name (for copy)
// Links to: /quiz (potentially with return context — see Section 4)
// Does NOT: collect email, set cookies, call APIs
```

**Template structure (conceptual, not implementation code):**

```
{isGated && (
  <section aria-label="Take the quiz to unlock">
    <!-- Same glass-panel styling as current gate form -->
    <h2>Discover If This Is Your Archetype</h2>
    <p>Take the five-minute quiz to unlock your complete
       {archetypeData.name} journey — affiliated cards, spreads,
       journaling prompts, and more.</p>
    <a href="/quiz" class="btn-flame">Take the Quiz</a>
  </section>
)}
```

**Key design decision:** The redirect CTA does NOT include the archetype slug in the quiz URL. The quiz must be taken honestly — pre-seeding or biasing the result defeats the purpose. The user discovers their archetype through the quiz, and if they match this journey, they gain access.

#### B. `src/pages/archetype/[slug].astro` — Bottom Email Series Form

**Current behavior:** The "Continue the Path" email series signup form (lines 263-303) is always visible, even for gated visitors. This is the second issue identified in eval finding m-1: a gated user can fill out the bottom form, which subscribes them but does NOT set the cookie.

**Decision point:** Two valid structural options:

| Option | Behavior | Tradeoff |
|--------|----------|----------|
| Hide when gated | `{!isGated && ( <email-series-form /> )}` | Clean separation: gated visitors see only quiz CTA, ungated see content + series signup. Eliminates confusion. |
| Always visible | Keep current behavior | Gated visitors can subscribe to the drip without seeing content. Collects an email but creates expectation mismatch. |

**Recommendation:** Hide when gated. The email series form's value proposition ("Receive an 8-week email series tailored to the {archetype} archetype") only makes sense after the user has seen their journey content and wants to go deeper. Showing it to someone who has not confirmed this is their archetype is a leak in the funnel's coherence.

#### C. `/api/journey-subscribe` Endpoint

**No changes required.** The endpoint still serves the "Continue the Path" email series form for authenticated visitors. It is no longer called by the gate form (which is removed), but it needs no structural modification.

#### D. `src/pages/quiz.astro` — Quiz Page

**No changes required.** The quiz already sets the `thf_sub` cookie on email submission (line 740) and on re-capture (line 980). The cookie value is the classified archetype's kebab slug. This is the canonical path and remains unchanged.

#### E. `src/pages/quiz/result/[archetype].astro` — Result Page

**No changes required.** This page is statically generated and already links to `/archetype/[slug]`. It carries no authentication. Its purpose is shareability — anyone can see the archetype description and share it. The "Go Deeper" CTA sends visitors to the journey page, where the cookie check enforces access.

This is structurally correct: the result page is a teaser, the journey page is the gated content. The result page does not need gating because it contains no exclusive content.

---

## 4. Open Design Questions

### Q1: Should the quiz redirect include a return parameter?

If a visitor arrives at `/archetype/shadow-dancer` without a cookie and clicks "Take the Quiz," they complete the quiz and land on the results page. They might be classified as shadow-dancer (matching) or as a different archetype.

**Option A: No return parameter.** The quiz completes normally. The user's cookie is set to whatever archetype they are classified as. If they happen to match, navigating back to `/archetype/shadow-dancer` now works. If they do not match, they land on a different journey page via the "Go Deeper" CTA on their result.

**Option B: Return parameter.** `/quiz?return=/archetype/shadow-dancer`. After quiz completion, redirect back to the journey page instead of showing the standard result. The cookie is set to the user's actual classified archetype, which may not match the return URL's archetype.

**Structural assessment:** Option A is simpler and avoids a promise that cannot be kept (the user may not be the archetype they arrived for). Option B introduces a new query parameter contract, state to carry through 12 questions + email gate + calculating phase, and a redirect path that may lead to a gated page if the classification does not match. **Recommend Option A.**

### Q2: Should the cookie support multiple archetypes?

The TASKBOARD already tracks this as a backlog item ("Multi-archetype cookie support," eval finding M-1). It is orthogonal to closing the side door. The side door can be closed with the current single-archetype cookie. Multi-archetype support is a separate concern that should be addressed independently.

**Recommendation:** Do not bundle multi-archetype cookie changes with this work. They have different risk profiles and test surfaces.

### Q3: Should the cookie max-age be extended?

Also tracked in the TASKBOARD (eval finding N-2). Current 30-day expiry means users who take the quiz now lose journey access before the 8/8/26 Kickstarter launch. This is worth fixing but is orthogonal to closing the side door.

**Recommendation:** Can be done as a single-line change alongside this work (change `2592000` to `15552000` in both `quiz.astro` and the new gated redirect section), but it is not structurally coupled to the gate change.

### Q4: What about the footer CTA on the journey page?

The journey page footer (lines 306-323) has two links: "Your Result" (`/quiz/result/[slug]`) and "Retake the Quiz" (`/quiz`). These are inside the main content area but outside the `#journey-content` div, so they are always visible. For gated visitors, the "Your Result" link points to a result page the user may never have seen.

**Recommendation:** Move the footer CTA inside `#journey-content` or conditionally render it only when not gated. A gated visitor should see only the hero + quiz redirect CTA.

---

## 5. Component Boundary Summary

```
BEFORE (Side Door Open):
  /quiz ─── [email gate] ──→ cookie ──→ /archetype/[slug] ✓
  /archetype/[slug] ── [gate form + email] ──→ cookie ──→ /archetype/[slug] ✓  ← SIDE DOOR

AFTER (Side Door Closed):
  /quiz ─── [email gate] ──→ cookie ──→ /archetype/[slug] ✓
  /archetype/[slug] ── [no cookie] ──→ hero + "Take the Quiz" CTA ──→ /quiz
```

### Files Modified

| File | Change | Scope |
|------|--------|-------|
| `src/pages/archetype/[slug].astro` | Remove gate form (template + script). Add quiz redirect CTA. Conditionally hide email series form and footer CTA when gated. | Template: ~40 lines removed, ~20 added. Script: ~55 lines removed. |

### Files NOT Modified

| File | Reason |
|------|--------|
| `src/pages/quiz.astro` | No change. Cookie-setting logic is correct and unchanged. |
| `src/pages/api/journey-subscribe.ts` | No change. Still serves the email series form. |
| `src/pages/api/quiz-submit.ts` | No change. Unrelated to journey page gating. |
| `src/pages/quiz/result/[archetype].astro` | No change. Teaser page, no gating needed. |
| `src/lib/quiz-engine.ts` | No change. Quiz flow is unaffected. |
| `src/lib/classifier.ts` | No change. Classification is unaffected. |
| `src/lib/archetype-content.ts` | No change. Data module, no gating logic. |

### Contracts Preserved

- **Cookie contract:** Unchanged. `thf_sub` cookie name, value format, max-age, path, and SameSite remain the same. The only change is that one of the two cookie-setting code paths (the journey page gate form) is removed.
- **API contract:** `/api/journey-subscribe` request/response format unchanged. It loses one caller (the gate form) but retains the email series form caller.
- **Loops.so contact contract:** No change. Contacts created via the quiz path already have full quiz data. The journey page side door contacts (with `source: 'journey_page'` and no quiz data) will no longer be created.

### Tests Affected

| Test File | Impact |
|-----------|--------|
| `tests/quiz-gate-e2e.spec.ts` — "Journey page — cookie-based gating" suite | The test "submitting email on gated page sets cookie and reveals content" (line 308) tests the side door that is being removed. This test must be **replaced** with a test that verifies: (1) gated page shows quiz redirect CTA, (2) gated page does NOT show gate form, (3) gated page does NOT show email series form or footer CTA. |
| `tests/quiz-gate-e2e.spec.ts` — "without cookie: shows gated view" (line 263) | Update assertions: expect `#journey-gate-form` to NOT exist (not just visible), expect quiz redirect CTA to be visible instead. |

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing Loops.so contacts created via side door lose re-entry | Medium | Low | These contacts still receive emails. Cookie expiry would have locked them out anyway. They can retake the quiz. |
| Shared journey URLs become dead ends for non-quiz-takers | Certain | Medium (by design) | The quiz redirect CTA provides a clear path forward. The hero section still shows archetype teaser content. |
| SEO impact — gate form removal changes SSR HTML | Low | Low | The hero section, FAQ schema (JSON-LD), and meta tags are unchanged. Search engines see the same title, description, and structured data. Journey content was already hidden from bots (gated behind cookie check). |
| Users who completed the quiz but whose cookie expired | Medium (30d expiry) | Medium | They must retake the quiz. Mitigated if cookie max-age is extended to 180 days. |

---

## 7. Implementation Sequence

1. **Template changes to `[slug].astro`:** Remove gate form section. Add quiz redirect CTA. Wrap email series form and footer CTA in `{!isGated && ...}`.
2. **Script changes to `[slug].astro`:** Remove gate form event handler and associated DOM references.
3. **Update E2E tests:** Replace gate-form-related assertions with quiz-redirect-CTA assertions.
4. **Optional (parallel):** Extend cookie max-age from 30d to 180d in `quiz.astro` line 740 and confirm no other references need updating.

This is a single-file change (plus test updates). No new components, no new APIs, no new state. The system becomes simpler by removing a code path.
