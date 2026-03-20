# Round 1 — Builder

## Lens: Pragmatic Implementation

---

## 1. Current State of the Codebase (What Actually Exists)

### Files and Their Roles

| File | Role | Lines | SSR? |
|------|------|-------|------|
| `src/pages/archetype/[slug].astro` | Journey page with cookie gate | ~461 | Yes (`prerender = false`) |
| `src/pages/quiz.astro` | Quiz flow, sets `thf_sub` cookie on email submit | ~1118 | No (static + client JS) |
| `src/pages/quiz/result/[archetype].astro` | Static result pages, links to journey | ~95 | No (SSG) |
| `src/pages/api/journey-subscribe.ts` | API endpoint for journey-page email forms | ~305 | Yes (serverless) |
| `src/lib/archetype-content.ts` | Archetype data + slug converters | ~87 | Shared |
| `tests/journey-subscribe.test.ts` | Unit tests for journey-subscribe API | ~318 | N/A |
| `tests/journey-pages.spec.ts` | Playwright E2E for journey pages | ~245 | N/A |
| `tests/quiz-gate-e2e.spec.ts` | Playwright E2E for email gate + journey gating | ~329 | N/A |

### Current Access Control Flow

The journey page (`[slug].astro`) has a **two-layer access model** today:

1. **Server-side cookie check** (line 35-36): reads `thf_sub` cookie, sets `isGated` boolean
2. **Gate form** (lines 123-161): shown when `isGated === true` -- collects email, calls `/api/journey-subscribe`, sets cookie client-side, reveals content via JS
3. **Journey content** (lines 164-260): hidden via `style="display:none"` when gated, visible when cookie matches
4. **Email series form** (lines 262-303): "Continue the Path" -- always visible regardless of gate status
5. **Footer CTAs** (lines 305-323): "Your Result" link + "Retake the Quiz" link -- always visible

The `thf_sub` cookie is set in exactly two places:
- `quiz.astro:739-740` -- `setThfSubCookie()` called after email submit (line 919) or re-capture (line 980)
- `[slug].astro:369` -- gate form handler sets it after email submit

**Critical observation:** The cookie value is a single archetype slug (kebab-case). The server-side check on `[slug].astro:36` is `cookie.value !== urlSlug` -- meaning the cookie must match the *specific archetype* of the page being visited. A user who took the quiz and got "air-weaver" can only unlock the air-weaver journey page, not any other.

### What "Close the Side Door" Means Concretely

Today, there are **three paths** to journey content:

1. **Quiz path** (intended): Take quiz -> submit email -> get `thf_sub` cookie -> visit journey page -> content unlocked
2. **Gate form path** (side door): Visit journey page directly -> submit email on gate form -> cookie set -> content revealed
3. **Email series path** (unintended leakage): The "Continue the Path" form at the bottom is always visible, but submitting it does NOT set the cookie or reveal content -- it's a separate conversion action

The operator wants to eliminate path #2 (gate form) and replace it with a quiz CTA. Path #3 (email series form) becomes redundant for cookie-bearing users and irrelevant for non-cookie users (they can't see the journey content it references).

---

## 2. Implementation Plan

### Phase 1: Replace Gate Form with Quiz CTA (The Core Change)

**Files to modify:** `src/pages/archetype/[slug].astro`

**What to remove:**
- Lines 123-161: The entire `#journey-gate-form` section (gate form HTML)
- Lines 328-398: The entire gate form JS handler (`gateForm` event listener, `gateErrorEl`, `journeyGateFormWrapper` references)

**What to add (gated state):**
Replace the gate form with a hero teaser + quiz CTA section. This goes in the same conditional slot where `{isGated && (...)}` currently renders the gate form:

```astro
{isGated && (
  <div id="journey-quiz-cta">
    <section aria-label="Discover your archetype" class="glass-panel p-8 md:p-12 rounded-lg text-center relative">
      <!-- Corner marks (reuse existing pattern) -->
      <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-30"></div>
      <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-30"></div>
      <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-30"></div>
      <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-30"></div>

      <h2 class="font-serif text-2xl md:text-3xl text-hermetic-gold mb-4 tracking-wide">
        This Journey Awaits Your Archetype
      </h2>
      <p class="text-gray-300 font-sans font-light leading-relaxed mb-8 max-w-lg mx-auto">
        Affiliated cards, personalized spreads, journaling prompts, and curated reading guides --
        unlocked when you discover which archetype speaks through your cards.
      </p>
      <a
        href="/quiz"
        class="btn-flame inline-block px-10 py-4 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline"
      >
        Take the Quiz
      </a>
      <p class="text-gray-500 font-sans text-xs mt-4">Twelve questions. Five minutes. One revelation.</p>
    </section>
  </div>
)}
```

**What to change (cookie logic):**
The `isGated` check on line 36 stays exactly as-is:
```ts
const cookie = Astro.cookies.get('thf_sub');
const isGated = !cookie || cookie.value !== urlSlug;
```

No change needed here. The existing SSR cookie check is the right mechanism. Quiz completers who submitted email have the cookie; everyone else sees the CTA.

**Decision point -- strictness of gate:** The current gate checks `cookie.value !== urlSlug`, meaning the cookie must match the *specific* archetype of the page. Should we relax this to "any valid `thf_sub` cookie value"?

Arguments for relaxing: A user who took the quiz and got air-weaver should be able to explore shadow-dancer's journey too -- they've proven they're an engaged quiz completer.

Arguments for keeping strict: Each journey is positioned as "your" journey. Showing someone else's journey undermines the personalization narrative. The quiz CTA on a mismatched page creates re-engagement opportunity.

**My recommendation:** Relax to "any valid `thf_sub` cookie" for now. The purpose of the gate is to ensure quiz completion, not to lock per-archetype access. A returning user exploring other archetypes is a sign of engagement, not a leak. The change is trivial:

```ts
const cookie = Astro.cookies.get('thf_sub');
const isGated = !cookie;  // Any thf_sub cookie = quiz completer
```

This is a product decision the operator should confirm.

### Phase 2: Handle the Email Series Form

**Files to modify:** `src/pages/archetype/[slug].astro`

The "Continue the Path" email series form (lines 262-303) has three possible treatments:

**Option A (recommended): Conditional rendering based on gate state**

For cookie-bearing users (quiz completers who already gave email): hide the email series form entirely. They're already in Loops.so from the quiz submission. Showing another email form is redundant and friction-adding.

For non-cookie users: they see the quiz CTA instead of the gate form, and the page content is hidden. The email series form references content they can't see ("8-week email series tailored to the archetype"). Showing it below the quiz CTA is confusing. Hide it.

Implementation:
```astro
{!isGated && (
  <section aria-label="Email series signup" class="glass-panel p-8 rounded-lg relative">
    <!-- existing email series form HTML -->
  </section>
)}
```

Wait -- but the eval report (m-1) already flagged that showing two email forms simultaneously is confusing. The operator wants to close the side door. Making the email series form visible ONLY for unlocked users preserves the conversion opportunity for quiz completers who want the drip series, while hiding it for gated users.

Actually, re-reading the operator's intent: "The 'Continue the Path' email series form becomes redundant for cookie-bearing users." This suggests the operator wants it hidden for cookie-bearing users AND it's already irrelevant for non-cookie users (they can't see the content). So: **remove it entirely** or wrap it in `{!isGated && showEmailSeries}` conditional.

**My recommendation:** Keep the email series form but only show it to unlocked users (`!isGated`). The drip series is a separate value-add beyond the journey content -- some quiz completers may want weekly reflections even though they already gave email via the quiz. But add a note that they're already subscribed if the quiz already enrolled them.

Actually, the simplest correct answer: **The quiz email submission already triggers Loops.so with archetype data.** The journey-subscribe endpoint sends a `journey_subscribe` event to Loops.so, which is presumably what triggers the 8-week drip. If the quiz-submit endpoint already handles this, the form is truly redundant.

Let me check what happens:
- Quiz submit -> `POST /api/quiz-submit` -> Loops.so event `quiz_completed` with archetype
- Journey subscribe -> `POST /api/journey-subscribe` -> Loops.so event `journey_subscribe` with archetype

These are **different Loops.so events**. The quiz-submit creates the contact with `quiz_completed`; the journey-subscribe triggers the drip series with `journey_subscribe`. The drip series is an opt-in on top of quiz completion.

**Revised recommendation:** Keep the email series form for unlocked users. They completed the quiz (have cookie), but haven't necessarily opted into the 8-week drip. The form becomes the single email touchpoint on the page.

```astro
<!-- Email series form: only shown to unlocked users who may want the drip -->
{!isGated && (
  <section aria-label="Email series signup" ...>
    <!-- existing form -->
  </section>
)}
```

### Phase 3: Clean Up journey-subscribe.ts

**Files to modify:** `src/pages/api/journey-subscribe.ts`

With the gate form removed, `journey-subscribe.ts` is only called from the "Continue the Path" email series form. No structural changes needed to the API -- it still receives `{ email, firstName, archetype }` and pushes to Loops.so.

**Do NOT delete `journey-subscribe.ts`.** It serves the email series form which we're keeping for unlocked users.

### Phase 4: Clean Up Client-Side JS

**Files to modify:** `src/pages/archetype/[slug].astro` (script block)

Remove the gate form handler (lines 328-398):
- `gateForm` variable and its `addEventListener`
- `gateErrorEl` reference
- `journeyContent` and `journeyGateFormWrapper` references used by the gate handler
- The `document.cookie = thf_sub=...` line inside the gate handler (line 369)

The email series form handler (lines 400-458) stays intact.

The GA4 `journey_page_view` event (lines 330-336) stays intact.

### Phase 5: Update Tests

**Files to modify:**

1. **`tests/quiz-gate-e2e.spec.ts`** -- The Layer 2 tests (lines 261-328) need updating:
   - `test('without cookie: shows gated view')` -- change assertions from checking `#journey-gate-form` to checking `#journey-quiz-cta`
   - `test('with correct cookie: shows full content')` -- stays mostly the same, but verify `#journey-quiz-cta` is NOT visible
   - `test('with wrong archetype cookie: shows gated view')` -- if we relax the cookie check, this test inverts (user sees content). If we keep strict, update to check for quiz CTA instead of gate form
   - `test('submitting email on gated page sets cookie and reveals content')` -- **DELETE entirely**. There's no gate form to submit anymore.

2. **`tests/journey-pages.spec.ts`** -- The Playwright E2E tests here test page structure. Need to verify:
   - `testAirWeaverJourneyPageContent` -- currently checks for sections that are inside `#journey-content` (which is hidden for gated users). If the test runs without a cookie, these sections won't be visible. The test needs to either (a) set the cookie before navigating, or (b) assert on the quiz CTA for the gated case.
   - `testJourneyPageBackLink` -- same issue: the "Your Result" link is in the footer, which IS visible regardless of gate state, so this should still pass.

3. **`tests/journey-subscribe.test.ts`** -- **No changes needed.** The API endpoint is unchanged; only the client-side form that calls it changes context.

4. **`tests/archetype-journey-schema.test.ts`** -- **No changes needed.** Schema tests are data-layer only.

---

## 3. Build Order

```
Phase 1: Replace gate form with quiz CTA         [~30 min]
  - Modify [slug].astro HTML: remove gate form, add quiz CTA
  - Modify isGated logic if relaxing cookie check (operator decision)

Phase 2: Conditional email series form            [~10 min]
  - Wrap email series form in {!isGated && (...)}

Phase 3: Clean up client-side JS                  [~15 min]
  - Remove gate form handler from <script> block
  - Remove unused DOM references

Phase 4: Update E2E tests                         [~45 min]
  - Update quiz-gate-e2e.spec.ts Layer 2 tests
  - Update journey-pages.spec.ts to handle gated state
  - Run full test suite to verify no regressions
```

Total estimated effort: **~1.5-2 hours** for an experienced developer familiar with this codebase.

---

## 4. Complexity Risks and Gotchas

### Risk 1: E2E Tests Assume Gate Form Exists (Medium)

The Playwright E2E suite in `tests/quiz-gate-e2e.spec.ts` has 4 tests in the "Journey page -- cookie-based gating" describe block. Three of them reference `#journey-gate-form` directly. The fourth tests submitting email on the gate form -- this entire test must be deleted or rewritten. The test that checks "wrong archetype cookie" becomes a product decision test (do we show content or not?).

The `journey-pages.spec.ts` tests are more subtle: `testAirWeaverJourneyPageContent` asserts that sections like "Affiliated tarot cards" exist on the page. But if the test browser has no cookie, these sections are rendered with `display:none`. Playwright's `page.$()` finds hidden elements, so the existence check passes. BUT if the test checks visibility (`.toBeVisible()`), it would fail. Current tests use `page.$()` (existence, not visibility), so they should pass. Verify.

### Risk 2: SEO Impact of Hiding Content (Low-Medium)

Currently, the journey content IS in the SSR HTML even when gated -- it's just hidden with `style="display:none"`. Search engines may or may not index hidden content. Google generally ignores `display:none` content. This is actually the current behavior and isn't changing -- the content remains in the HTML for both gated and ungated states. The change only swaps the gate form for a quiz CTA in the gated view. No SEO regression.

**However:** If we wanted to be more aggressive and NOT render journey content at all for gated users (removing it from SSR output entirely), that WOULD have SEO impact. The JSON-LD FAQ schema uses journaling prompts, which would also need to be gated. I recommend against this -- keep content in HTML, hidden via CSS, as it is today.

### Risk 3: Cookie Relaxation Creates Archetype Mismatch (Low)

If we relax `isGated` to `!cookie` (any thf_sub value unlocks any journey page), a user with cookie value "air-weaver" visiting `/archetype/shadow-dancer` sees the Shadow Dancer journey. The email series form at the bottom still submits to `/api/journey-subscribe` with the URL's archetype slug (shadow-dancer), which is correct. No data integrity issue.

But the footer "Your Result" link (line 311-313) uses `urlSlug` to link back to `/quiz/result/${urlSlug}`, which links to the page's archetype, not the user's actual quiz result. This could be confusing. A user who got air-weaver clicking "Your Result" on the shadow-dancer journey goes to the shadow-dancer result page, which isn't their result.

**Mitigation:** If relaxing, consider reading the cookie value and using it for the "Your Result" link instead of the page's slug. Or remove the "Your Result" link from non-matching archetype pages.

### Risk 4: Fire-and-Forget Pattern Becomes the Only Path (Already True)

The eval reports flagged that the gate form's fire-and-forget API call (set cookie + reveal content before API response) creates silent funnel leaks. By removing the gate form, this concern disappears for the gate path. But the email series form still has the same fire-and-forget pattern (lines 427-456). This is a pre-existing concern, not a regression.

### Risk 5: journey-subscribe.ts Dual-Purpose Identity

Today, `journey-subscribe.ts` serves two callers:
1. The gate form (being removed) -- sends `{ email, archetype }` (no firstName)
2. The email series form (staying) -- sends `{ email, firstName, archetype }`

After the change, only caller #2 remains. The API endpoint's behavior doesn't change, but the gate form was the higher-volume caller (every non-cookie visitor who engaged). With only the email series form calling it, the endpoint becomes a secondary conversion point with lower traffic. The rate limiter settings (global: 10, per-email: 3) remain appropriate.

---

## 5. What I Would NOT Do

1. **Do not make journey pages static (SSG).** The SSR cookie check is the correct architecture. Making them static would require client-side gating only, which is trivially bypassable and creates a flash of content.

2. **Do not introduce a new cookie or storage mechanism.** The `thf_sub` cookie is the established contract. The quiz sets it, the journey page reads it. Adding localStorage, session tokens, or a server-side session would be overengineering.

3. **Do not add a "preview" or "sample" mode.** The hero section already serves as the teaser for gated users. Adding partial content reveal (show 1 card, hide the rest) creates a half-state that's harder to maintain and test.

4. **Do not remove journey-subscribe.ts.** It still serves the email series form. Even if the operator later decides to remove the email series form too, the endpoint should stay until that decision is made.

5. **Do not change the quiz flow.** The quiz already sets the `thf_sub` cookie correctly. No changes needed to `quiz.astro`, `quiz-engine.ts`, or `quiz-submit.ts`.

---

## 6. Open Questions for the Operator

1. **Cookie strictness:** Should any quiz completer (any `thf_sub` value) unlock all journey pages, or only the matching archetype? Recommend: relax to any.

2. **Email series form disposition:** Keep it visible for unlocked users only, or remove it entirely? If quiz submission already enrolls users in the drip series via Loops.so, the form is truly redundant.

3. **"Your Result" footer link:** If relaxing cookie strictness, should the footer link go to the user's actual archetype result (read from cookie) or the current page's archetype result?

4. **Copy for the quiz CTA section:** The placeholder copy above ("This Journey Awaits Your Archetype") needs operator review. The quiz CTA is the first thing a direct visitor sees after the hero -- it needs to sell the quiz without breaking the mystical tone.

---

## 7. Diff Summary (What Actually Changes)

```
Modified files:
  src/pages/archetype/[slug].astro
    - REMOVE: gate form HTML (~40 lines)
    - ADD: quiz CTA section (~20 lines)
    - MODIFY: isGated check (1 line, if relaxing)
    - MODIFY: email series form conditional rendering (2 lines)
    - REMOVE: gate form JS handler (~70 lines)

  tests/quiz-gate-e2e.spec.ts
    - MODIFY: 3 tests update selectors from #journey-gate-form to #journey-quiz-cta
    - REMOVE: 1 test (gate form email submission)
    - MODIFY: 1 test if cookie strictness relaxes (wrong archetype test)

  tests/journey-pages.spec.ts
    - MODIFY: tests that check journey content sections may need cookie setup

Unchanged files:
  src/pages/quiz.astro (no changes)
  src/pages/quiz/result/[archetype].astro (no changes)
  src/pages/api/journey-subscribe.ts (no changes)
  src/lib/archetype-content.ts (no changes)
  tests/journey-subscribe.test.ts (no changes)
  tests/archetype-journey-schema.test.ts (no changes)
```

Net line delta: approximately -90 lines (removing gate form + JS handler, adding smaller quiz CTA). This is a simplification, not an expansion.
