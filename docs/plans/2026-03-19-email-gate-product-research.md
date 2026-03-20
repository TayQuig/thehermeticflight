# Email Gate Enforcement + Post-Results Product Research

**Date:** 2026-03-19
**Branch:** `feature/quiz-design-overhaul`
**Problem:** The quiz email gate is functionally decorative — skipping it still
exposes the full archetype journey content. Additionally, the quiz captures no
product research data (card back preference, product interest) needed for
Kickstarter launch decisions.

---

## Architecture Decision: How to Gate Journey Content

**Current flow:**
```
quiz → email-gate (submit OR skip) → calculating → [self-select] → results
  ↓ (both paths)
  Full reveal + "Begin Your Archetype Journey" CTA → /archetype/[slug] (public, ungated)
```

**Decision: Two-layer soft gate.**

1. **Quiz results screen (quiz.astro):** Split into two views:
   - **Email-submitted path:** Full reveal (archetype name, element, description,
     confidence messaging) + product research questions + journey CTA + share buttons.
   - **Skip path:** Archetype name + element only. Description blurred/truncated.
     Inline email form replaces the journey CTA: "Unlock your full reading and
     personalized journey." On submit → reveal full content + product research + CTA.

2. **Journey page (/archetype/[slug]):** Set a `thf_sub` cookie (client-side,
   30-day, archetype slug) when email is submitted. Journey page reads
   `Astro.cookies.get('thf_sub')` server-side. Without the cookie, show hero +
   email form; with it, show full content. This handles direct URL access and
   social sharing edge cases.

**Why not server-side auth?** Disproportionate complexity for a marketing funnel.
Cookie-based soft gating is standard for lead-gen quizzes. The goal is conversion
optimization, not content DRM.

**Why cookie over URL token?** Tokens leak into analytics, browser history, and
shared links. A cookie is invisible to the user, works across page loads, and
survives the quiz → result → journey navigation chain.

---

## Product Research Questions

Positioned **after** the archetype reveal, **before** the journey CTA. Only shown
to users who submitted email (or after inline re-capture for skippers). Non-scored,
not in the quiz engine — handled purely in the UI layer.

### PR01: Card Back Preference
**Type:** Single-select (2 options + "No preference")
```
The Hermetic Flight deck features original card art on every face.
What style speaks to you for the card backs?

  ○ A single signature design — unified and elegant
  ○ Reversible backs — so the orientation adds another layer of reading
  ○ I trust the artist's vision
```

### PR02: Product Interest
**Type:** Multi-select (checkboxes, pick any)
```
Beyond the deck itself, what would enhance your practice?

  ☐ Illustrated guidebook with card meanings and spreads
  ☐ Archetype-themed journal with prompts
  ☐ Companion app with daily draws and tracking
  ☐ Silk reading cloth with spread positions
  ☐ I just want the cards
```

**HUMAN GATE:** Operator must approve exact question text, option wording, and
tone before implementation. The above are proposals.

---

## Phase Plan

### Phase 1: Content Approval (HUMAN GATE)

Operator reviews and approves:
- PR01 and PR02 question text and options
- Tone check (does it maintain mystical atmosphere post-reveal?)
- Any additional product research questions to add

No code changes until approved.

---

### Phase 2: Quiz Results Gating + Product Research UI [FTF]

**What:** Modify quiz.astro to split the results screen into gated/ungated views,
add inline email re-capture for skippers, add product research questions, and set
the `thf_sub` cookie on email submission.

**Entry point:** `src/pages/quiz.astro` — results section (lines 237–302) and
`revealResults()` function.

**Changes:**
1. **Results section HTML:** Add gated container structure:
   - `#result-teaser` — always visible (label, title, element)
   - `#result-full` — hidden until email confirmed (description, tagline,
     product research, share, CTAs)
   - `#result-email-capture` — shown only for skip-path users (inline email
     form mirroring email-gate styling)
2. **Product research HTML:** Two question blocks inside `#result-full`:
   - PR01: radio group (card backs)
   - PR02: checkbox group (product interest)
   - "Continue to Your Journey" button (replaces direct CTA)
3. **revealResults() JS changes:**
   - Check `state.email` — if provided, show full reveal + product research
   - If null, show teaser + email re-capture form
   - On email re-capture submit: validate → fire API → set cookie → reveal full
   - On product research continue: capture answers → append to API payload → show journey CTA
4. **Cookie setting:** After successful email submission (either gate or re-capture):
   ```javascript
   document.cookie = `thf_sub=${finalSlug};path=/;max-age=2592000;SameSite=Lax`;
   ```

**Test contracts (Playwright — written by Test Author, Opus):**
- Skip-path user sees teaser only (archetype name + element visible, description
  not visible or blurred)
- Skip-path user sees inline email form, not journey CTA
- Email-submitted user sees full reveal + product research questions
- Submitting email via re-capture reveals full content
- Product research answers are included in API payload (route interception)
- `thf_sub` cookie is set after email submission
- Product research questions don't appear for skip-path users until email captured

**Pass/fail:** All new Playwright tests pass. Existing 48 E2E tests still pass.
608 unit tests still pass. Build clean.

**Known risks:**
- Staggered reveal animations interact with gated visibility — may need to
  re-sequence opacity transitions for the two-stage reveal
- Re-capture form validation must match email-gate validation (honeypot, timing)
- Product research "Continue" button must not block users who want to skip
  research (add subtle skip link)
- Product research submission uses fire-and-forget (same as existing quiz-submit
  pattern). If API call fails, user still proceeds to journey CTA. Product
  research data is best-effort, not critical path.

**Failure triage:**
- Animation timing issues → adjust delay-[ms] classes on gated elements
- API payload structure changes → update quiz-submit.test.ts in next phase
- Cookie not persisting → check SameSite/Secure attributes for Vercel HTTPS

**FTF protocol:** Test Author (Opus) writes Playwright tests → record baseline →
Implementer (Sonnet) makes tests pass → verify frozen.

---

### Phase 3: API Update for Product Research [FTF] [SUBAGENT: sonnet]

**What:** Update quiz-submit.ts to accept and forward product research answers.

**Entry point:** `src/pages/api/quiz-submit.ts`

**Changes:**
1. Accept optional `productResearch` field in request body:
   ```typescript
   productResearch?: {
     cardBacks?: 'single' | 'reversible' | 'artist_choice';
     productInterest?: string[];  // ['guidebook', 'journal', 'app', 'cloth', 'cards_only']
   }
   ```
2. Forward as Loops.so contact properties (useful for segmentation):
   ```typescript
   card_back_preference: productResearch.cardBacks ?? null,
   product_interest: productResearch.productInterest?.join(',') ?? null,
   ```
3. Include in GA4 event properties.
4. Validate `productInterest` items against allowlist:
   `['guidebook', 'journal', 'app', 'cloth', 'cards_only']`. Strip unknown values
   silently. Validate `cardBacks` against `['single', 'reversible', 'artist_choice']`.

**Test contracts (Vitest — written by Test Author, Opus):**
- API accepts payload with productResearch field and forwards to Loops.so
- API accepts payload without productResearch field (backward compatible)
- Invalid productResearch values are silently dropped (not error)
- productResearch fields appear in Loops.so contact properties

**Pass/fail:** All quiz-submit.test.ts tests pass (existing + new). No
regressions.

**Known risks:**
- Loops.so contact property names must not collide with existing fields
- Loops.so has a limit on custom properties per contact — verify headroom

**Failure triage:**
- Loops.so rejection → check property name format (snake_case, no spaces)
- Type validation → keep permissive (accept strings, coerce quietly)

**FTF protocol:** Test Author (Opus) writes Vitest tests → record baseline →
Implementer (Sonnet) makes tests pass → verify frozen.

**Parallelizable with Phase 4.**

---

### Phase 4: Journey Page Gating [FTF] [SUBAGENT: sonnet]

**What:** Add cookie-based soft gating to `/archetype/[slug].astro`. Without
the `thf_sub` cookie matching the slug, show a gated view with email form.

**Entry point:** `src/pages/archetype/[slug].astro`

**Changes:**
1. Server-side cookie check in frontmatter:
   ```typescript
   const cookie = Astro.cookies.get('thf_sub');
   const isGated = !cookie || cookie.value !== slug;
   ```
   **Cookie scope decision:** The cookie stores a single archetype slug, not a
   boolean. This means a user who retakes the quiz and gets a different archetype
   will see the new archetype's journey ungated (cookie updates on each quiz
   completion), but their old archetype's journey will re-gate. This is correct
   behavior — the cookie represents "the archetype you most recently unlocked,"
   not "you have ever taken the quiz." Users who want multiple journeys provide
   email each time, which is the desired conversion incentive.
2. Template conditional rendering:
   - **Ungated (cookie present):** Current full layout (no changes)
   - **Gated (no cookie):** Hero section (archetype name, element, extended
     description) + email capture form + blurred preview of journey sections.
     On submit → POST to `/api/journey-subscribe` → set `thf_sub` cookie →
     reload page (or client-side reveal).
3. The existing email form at the bottom of the journey page stays — it serves
   a different purpose (enrolling in the 8-week series after someone has already
   read the journey content).

**Test contracts (Playwright — written by Test Author, Opus):**
- Journey page without cookie shows gated view (hero + email form visible,
  cards/spreads/prompts not visible)
- Journey page with correct cookie shows full content
- Journey page with wrong archetype cookie shows gated view
- Submitting email on gated journey page sets cookie and reveals content
- Direct URL access without cookie shows gated view

**Pass/fail:** All new Playwright tests pass. Existing tests unaffected.

**Known risks:**
- SSR cookie reading on Vercel — must use `Astro.cookies` not `document.cookie`
- Blurring content with CSS may still expose text to view-source / screen readers
  (acceptable for marketing soft gate, not sensitive data)
- Client-side cookie setting after form submit needs page reload or JS reveal

**Failure triage:**
- Cookie not readable server-side → verify Vercel SSR mode, check
  `output: 'server'` in astro.config
- Form submission endpoint mismatch → ensure journey-subscribe API exists and
  returns success
- Blurred content accessible via DOM → acceptable; add `aria-hidden="true"` to
  gated sections for a11y

**FTF protocol:** Test Author (Opus) writes Playwright tests → record baseline →
Implementer (Sonnet) makes tests pass → verify frozen.

**Parallelizable with Phase 3.**

---

### Phase 5: Integration Testing [SUBAGENT: sonnet]

**What:** Verify the full end-to-end flow across all paths.

**Entry point:** `tests/quiz-v2-e2e.spec.ts` (extend existing) +
`tests/quiz-gate-e2e.spec.ts` (new)

**Test matrix:**
1. **Happy path (email submitted):**
   quiz → email gate → submit → calculating → reveal (full) → product research
   → continue → journey CTA → journey page (full content)
2. **Skip → re-capture path:**
   quiz → email gate → skip → calculating → reveal (teaser) → email re-capture
   → submit → reveal (full) → product research → journey page (full content)
3. **Skip → direct journey path:**
   quiz → skip → reveal (teaser) → manually navigate to /archetype/[slug] →
   gated view → email form → submit → full content
4. **Cookie persistence:**
   Complete quiz with email → navigate to journey page → close tab → re-open
   journey page → full content (cookie persists)
5. **Product research data flow:**
   Complete quiz with email → answer product research → intercept API call →
   verify productResearch field present in payload

**Pass/fail:** All new + existing E2E tests pass. Full unit suite passes.

**Known risks:**
- Cookie state in Playwright tests requires careful isolation (each test should
  clear cookies in beforeEach)
- API route interception for product research verification

**Failure triage:**
- Cookie not set between pages → check domain/path attributes
- API payload missing fields → check quiz.astro fetch construction

---

### Phase 6: Eval Protocol (2 evaluators)

**What:** Deploy 2 independent evaluators to audit the complete implementation.

**Evaluator 1: UX Funnel Integrity**
- Lens: Does the email gate actually improve conversion without degrading UX?
- Check: Skip-path user experience (is it punishing or encouraging?)
- Check: Product research timing (does it create friction before journey CTA?)
- Check: Re-capture form discoverability and tone

**Evaluator 2: Functional Correctness**
- Lens: Does every code path work correctly?
- Check: Cookie lifecycle (set, read, expiry, wrong archetype)
- Check: Product research data reaches Loops.so
- Check: No regressions in existing quiz flow
- Check: Edge cases (multiple quiz completions, different archetypes)

Synthesize findings → remediate via FTF cycles if needed.

---

## Dependency Graph

```
Phase 1 (HUMAN GATE — content approval)
    ↓
Phase 2 (quiz results gating + product research UI) ──FTF──→ ┐
Phase 3 (API update) ──FTF──→ ────────────────────────────── ├─ Phase 5 (integration)
Phase 4 (journey page gating) ──FTF──→ ───────────────────── ┘
                                                                    ↓
                                                              Phase 6 (eval)
```

Phases 3 and 4 are parallelizable with each other (different files, no overlap).
Phase 2 must complete first (it defines the cookie contract and API payload shape
that 3 and 4 depend on).

---

## Files Touched

| File | Phase | Changes |
|------|-------|---------|
| `src/pages/quiz.astro` | 2 | Results gating, email re-capture, product research UI, cookie setting |
| `src/pages/api/quiz-submit.ts` | 3 | productResearch field handling |
| `src/pages/archetype/[slug].astro` | 4 | Cookie-based gating, email form |
| `src/lib/quiz-data.ts` | 2 | Product research question definitions (optional — may keep in quiz.astro) |
| `tests/quiz-gate-e2e.spec.ts` | 2, 4, 5 | New E2E tests for gating flows |
| `tests/quiz-submit.test.ts` | 3 | Product research API tests |
| `tests/quiz-v2-e2e.spec.ts` | 5 | Extended integration tests |
