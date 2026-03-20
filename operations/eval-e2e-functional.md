# E2E Functional Integrity Evaluation

**Date:** 2026-03-19
**Evaluator:** Functional Integrity (Sonnet)
**Score:** 4.1/5.0

---

## Coverage Assessment

The E2E suite is structurally sound for the critical user paths. The 65 tests across 6 files cover the core funnel adequately, with identifiable gaps in depth rather than width.

**Paths covered well:**

- Quiz full flow (quiz-v2-e2e.spec.ts, quiz-flow.spec.ts) — happy path through all 12 questions, email gate, result page
- Journey page gating (quiz-gate-e2e.spec.ts Layer 2) — 4 scenarios: no cookie, correct single-slug, wrong archetype, correct multi-slug
- Accessibility basics (quiz-a11y.spec.ts)
- Thank-you redirect (thank-you-redirect.spec.ts)
- Raw journey page content structure (journey-pages.spec.ts)

**Gaps between unit tests (639) and E2E (65):**

The unit/E2E coverage ratio is 639:65, which is healthy in absolute terms. However, several paths exercised by unit tests are not validated at the integration layer:

1. **Quiz engine phase transitions** — The 54-test quiz-engine suite validates state machine behavior exhaustively in isolation. The E2E tests validate only the rendered quiz flow end-to-end, not that individual phase transitions (e.g., `email-gate` → `calculating` → `self-select`) are correctly wired to the UI. A broken phase transition that still renders the correct final screen would pass E2E but fail unit tests — and vice versa, a passing unit test doesn't confirm the UI calls the engine correctly.

2. **Classifier output diversity** — No E2E test validates that the quiz flow produces more than one archetype result. All E2E quiz completion paths presumably produce the same archetype (since answers are fixed). The Monte Carlo distribution (EI 26.9%, AW 9.3%) is not exercised at the integration layer.

3. **Cookie merge on retake** — Unit tests for quiz-submit cover the multi-slug merge logic. No E2E test completes the quiz twice with different answer sets and verifies the cookie contains both slugs. This is the scenario that triggers the known HIGH finding in the previous UX eval (Layer 1 regex too strict for multi-slug).

4. **API error states** — Unit tests cover quiz-submit and journey-subscribe error paths (400, 429, 500). No E2E test covers what the user sees when the API returns an error (e.g., rate limit hit, email already registered). These are unit-covered but not E2E-covered.

5. **Self-select path** — The quiz engine supports a `self-select` phase for low-confidence results. This branch is unit-tested but there is no E2E test for it. If the UI handling of self-select is broken, the unit tests would not catch it.

**Assessment:** Coverage is acceptable for launch preparation. The gaps are all in secondary paths (retake, error states, self-select) rather than the primary funnel path. The 12/12 quiz-gate-e2e pass confirms the most security-critical integration point is exercised.

---

## Live Behavior Assessment

Live server behavior matches the plan's expected behavior on all testable paths.

**Verified via hardening reports:**

- Cookie renewal on authenticated archetype page visit: PASS. `set-cookie: thf_sub=air-weaver; Max-Age=15552000; Path=/; SameSite=Lax` returned with all correct attributes. Dev-mode absence of `Secure` is correct conditional behavior per `secure: import.meta.env.PROD`.

- Gate enforcement on mismatched archetype: PASS. `thf_sub=shadow-dancer` on `/archetype/air-weaver` produces `isGated=true`, no Set-Cookie emitted, no content leaked.

- Gate enforcement on absent cookie: PASS. No `thf_sub` in request, `isGated=true`, no Set-Cookie emitted.

- Multi-slug access grant: PASS. `thf_sub=shadow-dancer%2Cair-weaver` correctly unlocks `/archetype/air-weaver` (`decodeURIComponent` + `split(',')` chain working correctly in SSR context).

- Forged cookie isolation: PASS. `thf_sub=INJECTED` is treated as an unrecognized slug token — no crash, no access granted.

- XSS non-reflection: PASS. Script tag injection in cookie value not reflected in HTML output. Confirmed by source inspection: cookie value is used only for the server-side boolean `isGated`, never interpolated into the response body.

- Path traversal safety: PASS. `../../etc/passwd` token is only compared via `slugList.includes(urlSlug)` — no filesystem interaction, no crash.

- SEO structured data presence: PASS. `isAccessibleForFree: false` with `cssSelector: "#journey-content"` present in `<head>` regardless of gate state.

**Untestable in dev (known limitation):** API endpoints `quiz-submit` and `journey-subscribe` exit at the `LOOPS_API_KEY` check (lines 319 and 184 respectively) before reaching the Set-Cookie path. Live cookie header verification for these endpoints is not possible without a configured `LOOPS_API_KEY`.

---

## Remediation Quality

The `display:none` → conditional rendering fix is correct in kind, well-executed in implementation, and consistent with the existing pattern already used elsewhere in the template.

**Assessment of the fix itself:**

The pre-fix state (`style={isGated ? 'display:none' : ''}`) is a client-side CSS gate: the HTML is delivered to every visitor but visually suppressed. Any visitor who curls the page or views source can read all gated content. The hardening audit confirmed this empirically — pre-fix `grep -c 'journey-content'` returned 2 matches even without a cookie.

The post-fix state (`{!isGated && (...)}`) is a server-side rendering gate: the HTML is excluded from the response for gated visitors. The hardening audit confirms this — post-fix `grep -c 'journey-content'` returns 1 (JSON-LD schema reference only). The actual `<div id="journey-content">` and all its children are absent from the response body.

**Pattern consistency check:**

Reviewing `[slug].astro` as read from source, the conditional rendering pattern is consistently applied to all gated blocks:

| Block | Line | Pattern | Correct |
|---|---|---|---|
| `#journey-quiz-cta` | 146 | `{isGated && (...)}` | Yes |
| `#journey-content` | 171 | `{!isGated && (...)}` | Yes (post-fix) |
| `#journey-email-form` section | 272 | `{!isGated && (...)}` | Yes |
| Footer CTA | 317 | `{!isGated && (...)}` | Yes |

No CSS-hidden elements remain in the gated path. The hero section (`#journey-hero`) and extended description remain unconditionally rendered — this was assessed as either intentional teaser content or an oversight in the previous UX eval (MEDIUM-1 finding). The source confirms this is still unresolved: `description_extended` is inside `#journey-hero` which is always rendered. This evaluator concurs with MEDIUM-1: if `description_extended` is premium content, it is ungated; if it is teaser content, a code comment should document the intent.

**JSON-LD `cssSelector` reference:** The `cssSelector: "#journey-content"` in the schema head block correctly references the gated div for Google's metered content signaling. Post-fix, this reference appears in the HTML even for gated visitors (as a `<script>` tag in `<head>`), which is the correct behavior — it tells Google what is gated, it does not expose the gated content itself.

**Verdict:** The fix is the right fix. No other `display:none` CSS gate patterns were found in the template. The fix was applied surgically and did not introduce side effects. The 639/639 unit test pass and 12/12 quiz-gate-e2e pass after the fix confirm no regressions.

---

## Known Limitations

**API endpoint Set-Cookie untestability in dev:**

Both `quiz-submit.ts` and `journey-subscribe.ts` early-exit at the `LOOPS_API_KEY` check before reaching the Set-Cookie path. This is a structural property of how the endpoints are written: Set-Cookie is only emitted on the `200` success path after a successful Loops.so API round-trip. In dev mode without `LOOPS_API_KEY`, the curl verification gap is inherent and accepted.

The mitigation — unit tests that mock `LOOPS_API_KEY` and the Loops.so `fetch` — is adequate for launch-preparation confidence. The Set-Cookie string in both files is a literal:

```
thf_sub=${encodeURIComponent(mergedSlugs)};Path=/;Max-Age=15552000;SameSite=Lax;Secure
```

This is not conditionally assembled — `Secure` is always present in the string literal (unlike the SSR page's `secure: import.meta.env.PROD` conditional). The unit test coverage (63 tests for quiz-submit, 29 for journey-subscribe) directly exercises this code path with mocked dependencies. The gap between "unit-tested" and "live-curl-verified" is real but acceptable given the mocking fidelity.

One structural concern worth noting: the SSR page uses `Astro.cookies.set()` with `secure: import.meta.env.PROD` (conditional on environment), while the API endpoints emit a raw Set-Cookie string with `Secure` always present. In production this is consistent (both include `Secure`). In dev, the archetype page omits `Secure` but the API endpoints would include it if reachable. This inconsistency exists today, is harmless in production, and was documented in the cookie header audit as Finding 3. It is not a bug but a mild design inconsistency that could be normalized if desired.

**`Secure` flag conditionally absent in dev:**

`secure: import.meta.env.PROD` on the archetype page SSR cookie renewal is correct. Localhost does not serve HTTPS; requiring `Secure` in dev would make the cookie unreachable to browsers on `http://localhost`. The production path (`PROD=true`) includes the flag. This is standard Astro pattern and requires no action.

**`journey-pages.spec.ts` — raw Playwright, DOM-not-visibility queries:**

This file uses `playwright` (not `@playwright/test`), which means it lacks test reporter integration, retry logic, and parallelism. More importantly, its content-section queries (`page.$()` for sections inside `#journey-content`) are DOM-presence checks, not visibility checks. Post-remediation, `#journey-content` is not rendered at all for gated visitors, so these queries would return null for a cookieless visit — meaning the test may now fail or pass for a different reason than before the fix. The previous UX eval noted this as MEDIUM-2. Given the fix converted CSS-hidden DOM presence to conditional rendering, the character of this test's behavior has changed: sections that previously existed in the DOM (hidden) now do not exist at all. If `journey-pages.spec.ts` passed all 5/5 tests, it implies some tests were called with appropriate cookies. This should be verified.

---

## Delta from Previous Eval

The previous UX eval scored 3.9/5.0 on 2026-03-19, before the `display:none` → conditional rendering remediation and before E2E execution.

**Improvements since previous eval:**

- The CSS gate finding (Lens E MEDIUM-2 in prev eval, now Test 10 in injection audit) has been **remediated**. This was the most significant functional finding — gated content was present in every HTML response. Post-fix, it is excluded from the response body entirely.

- 65 E2E tests executed against a live dev server and all passed. This converts the prior eval's "tests updated but never run" state to verified live behavior.

- 10/10 curl injection tests passed, confirming the live server behavior matches the implementation intent. The previous eval could only reason from source; this eval has live verification.

**Remaining from previous eval:**

- HIGH-1 (Layer 1 cookie regex too strict for multi-slug): Not remediated. `tests/quiz-gate-e2e.spec.ts` lines 171 and 192 still use `/^[a-z]+-[a-z]+$/`. This is a test regression risk, not a production bug.
- MEDIUM-1 (`description_extended` ungating intent unclear): Not resolved. Source confirms `description_extended` is in `#journey-hero` (always rendered).
- MEDIUM-2 (`journey-pages.spec.ts` visibility-blind queries): Status uncertain post-fix. If the tests passed all 5/5 with the new conditional rendering, they may be passing for different reasons.
- LOW-1 (WebPage structured data not validated by `testJourneyPageSEO`): Not addressed.
- LOW-2/3 (cookie renewal and malformed cookie edge cases): Not addressed.

**Score delta rationale:** Previous eval was 3.9/5.0 without live verification and with the CSS gate finding open. This eval scores 4.1/5.0, reflecting: (1) the CSS gate remediation closes the most material functional gap, (2) live E2E verification provides higher confidence than source review alone, (3) the HIGH-1 regex issue and MEDIUM-1 description_extended ambiguity persist and prevent a higher score.

---

## Findings

| # | Severity | Finding | Recommendation |
|---|----------|---------|----------------|
| F-01 | HIGH | Layer 1 cookie regex `/^[a-z]+-[a-z]+$/` in `quiz-gate-e2e.spec.ts` lines 171 and 192 does not match multi-slug cookie values. A retake scenario producing a different archetype will cause the cookie to contain two slugs (e.g. `air-weaver%2Cshadow-dancer`), which fails this assertion. Tests pass today only because the fresh-quiz path produces a single slug. | Update regex to: `const decoded = decodeURIComponent(thfCookie!.value); expect(decoded).toMatch(/^[a-z]+-[a-z]+(?:,[a-z]+-[a-z]+)*$/);` |
| F-02 | MEDIUM | `description_extended` from journey JSON is rendered inside `#journey-hero` (always visible), not inside `#journey-content` (gated). Source: `[slug].astro` line 139. Intent is undocumented — teaser vs. premium content. | Add a code comment at line 138 clarifying intent. If it is premium content, move it inside `#journey-content`. |
| F-03 | MEDIUM | `journey-pages.spec.ts` content-section queries execute without a cookie. Post-remediation, `#journey-content` is not in the DOM for cookieless visits. Depending on how the test handles null returns from `page.$()`, these tests may pass vacuously or produce misleading assertions. | Set a `thf_sub` cookie before navigating in `testAirWeaverJourneyPageContent`. Confirm section visibility with `.isVisible()` rather than DOM presence. |
| F-04 | LOW | No E2E test covers the quiz retake / multi-slug cookie accumulation path end-to-end. Unit tests cover the merge logic in isolation; no integration test validates the full cycle of two quiz completions producing a two-slug cookie and both archetype journey pages unlocking. | Add an E2E test: complete quiz → cookie = slug1; complete quiz again with different answers → cookie = slug1%2Cslug2; verify both journey pages unlock. |
| F-05 | LOW | API endpoint Set-Cookie cannot be curl-verified in dev due to `LOOPS_API_KEY` gate. Unit test coverage (63 + 29 tests) is the only live-environment substitute. | Before launch, run a smoke test against staging with `LOOPS_API_KEY` set (or a mock key returning `{"success":true}`) to verify the Set-Cookie path is reached in a real HTTP server context. |
| F-06 | LOW | No test validates that the WebPage `isAccessibleForFree` JSON-LD schema is present. `testJourneyPageSEO` in `journey-pages.spec.ts` only checks the first `<script type="application/ld+json">` tag (FAQPage). A regression removing the WebPage schema would be silent. | Add assertion: query all LD+JSON script elements and confirm at least one contains `"isAccessibleForFree"`. |
| F-07 | INFO | Set-Cookie `Secure` flag is conditionally absent in dev (SSR archetype page) but unconditionally present in API endpoint string literals. Harmless in production; creates a minor dev/prod behavioral difference that could surprise developers inspecting cookies locally. | No action required. Document in a comment at `[slug].astro` line 47 that the asymmetry is intentional. |

---

## Score Justification

**4.1/5.0**

The implementation is functionally correct and the live server behavior is well-verified. The single most important fix — server-side gate enforcement via conditional rendering rather than CSS hiding — was identified by the hardening audit and correctly applied. All 65 E2E tests pass against a live dev server, and 10/10 curl injection tests confirm the gate holds under adversarial inputs. The cookie renewal, multi-slug parsing, and SEO structured data all behave as specified.

Points withheld:

- **HIGH-1 (F-01)** prevents a score above 4.3. A test regression that will fail in a realistic retake scenario is an active defect in the test suite, not just a hypothetical. It erodes confidence in CI as a regression gate.

- **MEDIUM findings (F-02, F-03)** represent unresolved ambiguity (intent of `description_extended`) and a test coverage gap (visibility-blind content queries) that reduce overall confidence in the test-as-specification quality.

- **Coverage gaps (F-04)** for the retake path, error states, and self-select branch are acceptable for current phase but represent integration paths that unit tests cannot fully substitute for.

The score would reach 4.5+ if F-01 is fixed and F-02 intent is documented.
