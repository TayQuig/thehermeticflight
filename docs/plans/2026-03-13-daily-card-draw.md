# Daily Card Draw — Implementation Plan

> Supersedes `docs/plans/2026-03-09-daily-card-draw.md`. That plan used 6
> placeholder cards and inlined all data/logic in the page script. This plan
> uses the operator-provided 78-card CSV and imports from lib modules.

**Goal:** Create `/daily` page — deterministic daily card draw with
interpretation, aerial connection, journaling prompt, share buttons,
and pre-reveal/post-reveal modes. Drives repeat visits and daily CTA
impressions ahead of Kickstarter launch (2026-08-08).

**Architecture:** Client-side only. Astro 5 SSG page imports utility
functions from `src/lib/` via standard `<script>` imports (bundled by
Vite at build time). Date-seeded Mulberry32 PRNG selects one of 78 cards
per UTC calendar day. No backend required.

**Key Dates:**
- `REVEAL_DATE`: 2026-06-07 (card art reveal begins)
- Kickstarter launch: 2026-08-08
- ~2 months of visual daily draw driving repeat visits before campaign

**Content Source:** `src/data/Card Meanings with Aerial Correlation.xlsx - Sheet1.csv`
- 78 cards: 22 Major Arcana + 56 Minor Arcana (Torches/Cups/Swords/Pentacles)
- Columns: Card List, Meaning, Circus relation
- Missing: `journalingPrompt` — AI-generated as placeholders, operator review
  recommended before launch

**Tech Stack:** Astro 5 SSG, Tailwind CSS (hermetic design tokens), Vitest

**Design improvement over prior plan:** The prior plan (2026-03-09) inlined
the PRNG algorithm and full card array inside the `<script is:inline>` block,
duplicating code between the testable lib module and the page. Astro's
`<script>` tags (without `is:inline`) are processed by Vite and resolve
imports — confirmed by existing pattern in `quiz.astro`. This plan uses
imports, eliminating duplication and reducing maintenance surface.

---

## Task 1: Create card data module from CSV

**Files:**
- Read: `src/data/Card Meanings with Aerial Correlation.xlsx - Sheet1.csv`
- Create: `src/lib/card-data.ts`

**[SUBAGENT: sonnet]**

### Step 1: Parse and clean CSV data

Read the CSV and transform into the `CardData` interface. Handle these
cleanup items:

1. **Skip separator rows** (rows 24, 40, 56, 72 in CSV) — empty rows
2. **Skip suit header rows** (rows 25, 41, 57, 73) — "Torches", "Cups",
   "Swords", "Pentacles" with element info in column 3. BUT extract the
   current suit name for court card normalization.
3. **Normalize court card names** — track current suit context while
   iterating. When a row has just "Page", "Knight", "Queen", or "King"
   (with optional trailing space) without suit prefix, prepend the current
   suit: "Page" → "Page of Torches", "Knight" → "Knight of Cups", etc.
4. **Fix known typos:**
   - "The High Preistess" → "The High Priestess"
   - "The Hieropant" → "The Hierophant"
   - Trim trailing whitespace from all field values
5. **Generate slug** from cleaned card name: `name.toLowerCase()`,
   replace spaces with hyphens, strip anything not `[a-z0-9-]`
   - "Ace of Torches" → "ace-of-torches"
   - "The Fool" → "the-fool"
   - "10 of Pentacles" → "10-of-pentacles"

### Step 2: Write `src/lib/card-data.ts`

```typescript
/**
 * Card Data — Hermetic Flight Tarot
 *
 * 78 cards parsed from operator-provided CSV.
 * Source: src/data/Card Meanings with Aerial Correlation.xlsx - Sheet1.csv
 *
 * journalingPrompt values are AI-generated placeholders.
 * Operator review recommended before launch.
 */

export interface CardData {
  /** URL-safe slug for image paths and share URLs (e.g. 'the-fool') */
  slug: string;
  /** Display name (e.g. 'The Fool') */
  name: string;
  /** Core meaning of the card */
  meaning: string;
  /** How this card connects to aerial circus / performance themes */
  aerialConnection: string;
  /** Open-ended journaling prompt for the reader */
  journalingPrompt: string;
  /**
   * True once card art PNG is at /public/images/cards/[slug].png.
   * Controls pre- vs post-reveal rendering.
   */
  artReady: boolean;
}

export const CARDS: CardData[] = [
  // ... 78 entries from CSV
];

export const TOTAL_CARDS = CARDS.length;
```

Field mapping from CSV:
| CardData field | CSV source | Notes |
|---|---|---|
| `slug` | Generated from `Card List` | lowercase, hyphenated |
| `name` | `Card List` column | Cleaned, typos fixed, court cards prefixed |
| `meaning` | `Meaning` column | Trimmed |
| `aerialConnection` | `Circus relation` column | Trimmed |
| `journalingPrompt` | AI-generated | Based on card meaning. Reflective question. |
| `artReady` | Hardcoded | `false` for all cards |

Journaling prompt style guide (match existing 6 placeholders from prior plan):
- One question per card
- Reflective, open-ended, no right answer
- Connect the card's meaning to the reader's lived experience
- 15-25 words
- Examples from prior plan:
  - The Fool: "What would you begin today if you allowed yourself to not know how it ends?"
  - The Magician: "What resources do you already have that you have been treating as incomplete?"

### Step 3: Verify

```bash
npx tsc --noEmit
```

**Entry point:** `src/lib/card-data.ts`
**Pass/fail:** File compiles. Exports 78 `CardData` entries. All slugs
unique and match `^[a-z0-9-]+$`. All text fields non-empty. All 22 Major
Arcana present. All 4 suits represented with 14 cards each.
**Known risks:** Court card context tracking — suit must be inferred from
CSV row position, not from the card name field (which may just say "Page").
CSV may have encoding artifacts from Excel export (smart quotes, BOM).
**Failure triage:** If slug collision, inspect duplicate names. If encoding
issues, normalize Unicode. If court card misattribution, check suit header
detection logic.

---

## Task 2: Write contract tests (FTF: test author)

**Files:**
- Create: `tests/daily-draw.test.ts`

**[Main thread — Opus]** (FTF test author — must NOT be the agent that
implements `daily-draw.ts` in Task 3)

### Step 1: Write `tests/daily-draw.test.ts`

Contract tests covering both `card-data` and `daily-draw` modules.

**card-data module assertions:**
1. `TOTAL_CARDS === 78`
2. `TOTAL_CARDS === CARDS.length`
3. Every card has all required fields: slug, name, meaning,
   aerialConnection, journalingPrompt, artReady
4. Every slug matches `^[a-z0-9-]+$` and is non-empty
5. All 78 slugs unique (no collisions)
6. `artReady` is boolean on every card
7. All 22 Major Arcana present by name (The Fool through The World)
8. All 4 suits represented: at least 1 card name containing "Torches",
   "Cups", "Swords", "Pentacles" respectively
9. No court card has a bare name (every Page/Knight/Queen/King includes
   "of [Suit]")

**daily-draw utility assertions:**
1. `dateToSeed`: same date → same seed
2. `dateToSeed`: different dates → different seeds
3. `dateToSeed`: returns a number
4. `dateToSeed`: 10 consecutive dates → 10 distinct seeds
5. `getDailyCardIndex`: same date → same index (deterministic)
6. `getDailyCardIndex`: always in `[0, 77]`
7. `getDailyCardIndex`: always an integer
8. `getDailyCardIndex`: 30 different dates → at least 10 unique indices
   (distribution check — with 78 cards, expected ~25 unique over 30 days)
9. Date boundary: 23:59:59 UTC on day N → same index as midnight day N
10. Date boundary: differs from day N+1 midnight
11. Same UTC calendar day at any hour → same index
12. `getDailyCard`: returns valid CardData with all required fields
13. `getDailyCard`: name is non-empty string
14. `getDailyCard`: meaning is non-empty string
15. `getDailyCard`: same date → same card object returned

### Step 2: Record frozen baseline

```bash
sha256sum tests/daily-draw.test.ts > tests/.daily-draw.test.ts.sha256
```

### Step 3: Verify tests fail (baseline confirmation)

```bash
npm test -- tests/daily-draw.test.ts
```

Expected: tests fail because `src/lib/daily-draw.ts` does not exist yet.
Card-data tests may pass or fail depending on Task 1 completion order —
either outcome is acceptable for baseline.

**Entry point:** `tests/daily-draw.test.ts`
**Pass/fail:** Test file exists, sha256 recorded, tests fail with expected
import errors for daily-draw module.
**Known risks:** If stale `daily-draw.ts` exists from prior work, tests
may pass unexpectedly — delete it first.
**Failure triage:** If tests pass, verify no prior implementation exists.
If sha256sum unavailable on macOS, use `shasum -a 256` instead.

**HARD GATE:** Task 3 cannot begin until this task completes and baseline
is recorded.

---

## Task 3: Implement daily draw utility (FTF: implementer)

**Files:**
- Create: `src/lib/daily-draw.ts`

**[SUBAGENT: sonnet]** (FTF implementer — different agent from Task 2
test author)

**Depends on:** Task 1 (card-data.ts exists) + Task 2 (tests written,
baseline recorded)

### Step 1: Implement `src/lib/daily-draw.ts`

```typescript
/**
 * Daily Draw Utility — Hermetic Flight
 *
 * Deterministic card selection: same date → same card for all users.
 * Algorithm: UTC date string → polynomial hash → Mulberry32 PRNG → card index
 */

import { CARDS, TOTAL_CARDS } from './card-data';
import type { CardData } from './card-data';

// Mulberry32 — fast, seedable 32-bit PRNG
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Horner's method polynomial hash of 'YYYY-MM-DD'
export function dateToSeed(date: Date): number {
  const dateStr = date.toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = (Math.imul(seed, 31) + dateStr.charCodeAt(i)) | 0;
  }
  return seed;
}

export function getDailyCardIndex(date: Date): number {
  const seed = dateToSeed(date);
  const rng = mulberry32(seed);
  return Math.floor(rng() * TOTAL_CARDS);
}

export function getDailyCard(date: Date = new Date()): CardData {
  return CARDS[getDailyCardIndex(date)];
}
```

### Step 2: Run tests

```bash
npm test -- tests/daily-draw.test.ts
```

Pass: all tests green.
Fail: fix implementation. Do NOT modify test file.

### Step 3: Verify frozen test file

```bash
shasum -a 256 -c tests/.daily-draw.test.ts.sha256
```

Pass: "OK" — test file unchanged.
Fail: test file was modified → ABORT. Restore test from git, re-implement.

### Step 4: Run full test suite

```bash
npm test
```

Pass: all existing + new tests pass.

**Entry point:** `src/lib/daily-draw.ts`
**Pass/fail:** All tests pass. Frozen test file unchanged per sha256.
`npx tsc --noEmit` clean.
**Known risks:** PRNG distribution — Mulberry32 is well-characterized but
the distribution test uses a conservative threshold (10/30). If it fails,
the hash function may be clustering adjacent dates — unlikely with
polynomial accumulator but check.
**Failure triage:** If boundary test fails, verify `toISOString()` returns
UTC date string (it does per spec). If distribution test fails, log the
actual indices and seeds to inspect clustering.

---

## Task 4: Create /daily page

**Files:**
- Create: `src/pages/daily.astro`
- Create: `public/images/cards/card-back.png` (placeholder)
- Create: `public/images/og/daily.png` (placeholder)

**[SUBAGENT: sonnet]**

**Depends on:** Task 1 (card-data.ts) + Task 3 (daily-draw.ts)

### Step 1: Create placeholder images

```bash
mkdir -p public/images/cards
cp public/images/og/default.png public/images/cards/card-back.png
cp public/images/og/default.png public/images/og/daily.png
```

### Step 2: Implement `src/pages/daily.astro`

Architecture: static Astro page wrapping a client-side `<script>` that
imports from lib modules.

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout
  title="Daily Card Draw | The Hermetic Flight"
  description="See today's aerial tarot card — a new card every day, the same for everyone."
  ogImage="/images/og/daily.png"
>
  <main> <!-- page shell with placeholder elements --> </main>

  <script>
    import { getDailyCard } from '../lib/daily-draw';
    import { CARDS, TOTAL_CARDS } from '../lib/card-data';
    import type { CardData } from '../lib/card-data';

    const REVEAL_DATE = new Date('2026-06-07T00:00:00Z');
    // ... render logic
  </script>
</Layout>
```

**Page structure** (follow existing patterns from quiz.astro):

| Section | Pattern | Source |
|---|---|---|
| Header | Logo + serif gold site name link | quiz.astro |
| Hero | Gold label + serif h1 + date line | quiz.astro |
| Card panel | `glass-panel` with corner accents + radial glow | quiz.astro, archetype/[slug].astro |
| Card image | Card-back (pre-reveal) or card art (post-reveal) in flip container | New |
| Card name | `font-serif text-2xl md:text-3xl text-hermetic-white` | quiz.astro |
| Meaning | `text-gray-300 font-light font-sans leading-relaxed` | archetype/[slug].astro |
| Aerial connection | Gold label + `text-gray-400 italic` | New, matches archetype style |
| Journaling prompt | Nested `glass-panel` with gold label + serif text | New |
| Share buttons | X, Facebook, Copy Link — same button classes | quiz.astro |
| CTA | "Discover Your Archetype" → /quiz with `btn-flame` | quiz.astro |

**Card flip behavior:**
- Container: `perspective: 1000px`, inner: `transform-style: preserve-3d`,
  `transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)`
- Back face: card-back.png, `backface-visibility: hidden`
- Front face: card art, `backface-visibility: hidden; transform: rotateY(180deg)`
- Pre-reveal (`new Date() < REVEAL_DATE || !card.artReady`): static card-back,
  all text visible, no flip interaction
- Post-reveal: click toggles `card-inner.style.transform = 'rotateY(180deg)'`,
  "Tap card to reveal" hint visible

**Staggered reveal animation:**
```javascript
setTimeout(() => showEl('card-name'), 100);
setTimeout(() => showEl('card-meaning'), 300);
setTimeout(() => showEl('aerial-connection-block'), 500);
setTimeout(() => showEl('journaling-block'), 700);
```

**Analytics** (match existing patterns):
```javascript
// Guard all calls
if (typeof gtag === 'function') {
  gtag('event', 'daily_draw_view', {
    card_name: card.name,
    card_slug: card.slug,
    date_utc: dateStr,
    reveal_mode: isRevealed ? 'post_reveal' : 'pre_reveal',
  });
}

// Share tracking via event delegation on share-buttons container
gtag('event', 'share', {
  method: platform, // 'x' | 'facebook' | 'copy_link'
  content_type: 'daily_card',
  item_id: card.name,
});
```

**Share URLs:**
```javascript
const pageUrl = 'https://www.thehermeticflight.com/daily';
const shareText = `Today's aerial tarot card is ${card.name}. ...`;
// X: https://x.com/intent/tweet?text=...&url=...
// Facebook: https://www.facebook.com/sharer/sharer.php?u=...
// Copy: navigator.clipboard.writeText(pageUrl)
```

### Step 3: Build verification

```bash
npm run build
```

Pass: build succeeds, `/daily` in output.

### Step 4: Dev server smoke test

```bash
npm run dev
# Visit http://localhost:4321/daily
```

Visual checklist:
- [ ] Date displays in "Wednesday, March 13, 2026" format
- [ ] Card name and meaning render
- [ ] Aerial connection section visible
- [ ] Journaling prompt section visible
- [ ] Share buttons have correct href values
- [ ] CTA links to /quiz
- [ ] Glass panel styling matches quiz page
- [ ] Corner accents visible
- [ ] Background layers (stars, fog, gold line) visible

**Entry point:** `src/pages/daily.astro`
**Pass/fail:** `npm run build` succeeds with `/daily` in output. Page
renders with card content at localhost:4321/daily. Share URLs correctly
encoded with `encodeURIComponent`. CTA links to /quiz.
**Known risks:** Astro script import resolution — if Vite can't bundle
lib imports in `<script>` tag, the page will render blank. Confirmed this
works in quiz.astro, but card-data.ts is larger (~78 entries).
**Failure triage:** If imports fail in `<script>`, verify no `is:inline`
attribute. If bundle size causes build warning, the data is ~5KB gzipped
which is acceptable. If card content doesn't render, check browser console
for JS errors.

---

## Task 5: Integration + shallow harden

**[Main thread — Opus]**

**Depends on:** Tasks 1-4 complete

### Step 1: Full test suite

```bash
npm test
```

All existing + new tests pass.

### Step 2: Build verification

```bash
npm run build
```

Clean build with `/daily` page in output.

### Step 3: Evaluation (3 evaluators)

Deploy 3 independent evaluators with orthogonal lenses:

**Evaluator 1 — Correctness** [SUBAGENT: sonnet]
- Files to read: `src/lib/card-data.ts`, `src/lib/daily-draw.ts`
- Verify: 78 cards in CARDS array, all Major Arcana present, all 4 suits ×
  14 cards, PRNG produces valid indices over 365-day range, no adjacent-day
  collisions, UTC boundary correct
- Pass/fail: all 78 cards present with correct names, PRNG indices always
  in [0, 77], no two adjacent days share the same card

**Evaluator 2 — UX Pattern Compliance** [SUBAGENT: sonnet]
- Files to read: `src/pages/daily.astro`, `src/pages/quiz.astro`,
  `src/layouts/Layout.astro`, `src/styles/global.css`
- Verify: Layout wrapper, header pattern, glass-panel, corner accents,
  btn-flame CTA, share button styling, hermetic color tokens, responsive
  breakpoints (max-w-2xl, px-4, md:), font usage (Cinzel serif, Lato sans)
- Pass/fail: daily.astro follows same patterns as quiz.astro, no rogue
  color values or font families

**Evaluator 3 — Test Contract Integrity** [SUBAGENT: sonnet]
- Files to read: `tests/daily-draw.test.ts`, `src/lib/card-data.ts`,
  `src/lib/daily-draw.ts`
- Verify: frozen test file sha256 matches baseline, all test assertions
  are meaningful (not tautological), test coverage spans card-data module,
  dateToSeed, getDailyCardIndex, date boundaries, getDailyCard
- Pass/fail: sha256 matches, no dead tests, all described invariants
  have corresponding test assertions

### Step 4: Synthesize evaluator findings

Convergence analysis: if all 3 evaluators pass → proceed. If any evaluator
flags an issue → fix and re-evaluate that lens only.

### Step 5: Shallow harden

- **CSP:** No new `script-src`, `connect-src`, or `frame-src` requirements
  (page uses only existing gtag, fbq patterns already in Layout.astro).
  Verify no new CSP violations beyond documented ones in taskboard handoff.
- **XSS:** Verify share button URLs use `encodeURIComponent` for all
  dynamic values. Card data is static/build-time — no user input injection
  surface.
- **Data integrity:** Verify card-data.ts contains no `<script>` tags or
  HTML entities in meaning/aerialConnection strings that could break the
  page.

### Step 6: Commit

```bash
git add src/lib/card-data.ts src/lib/daily-draw.ts src/pages/daily.astro \
  tests/daily-draw.test.ts tests/.daily-draw.test.ts.sha256 \
  public/images/og/daily.png public/images/cards/card-back.png
git commit -m "feat: add /daily page with 78-card deterministic daily draw"
```

Do NOT push without operator confirmation.

**Entry point:** Full test suite + build
**Pass/fail:** All tests pass, build clean, 3 evaluators report no issues,
shallow harden finds no vulnerabilities.
**Known risks:** Pre-existing CSP violations (Meta CAPI, Facebook, GTM)
documented in taskboard handoff — not caused by this feature.
**Failure triage:** If evaluator finds pattern mismatch, update daily.astro
to match quiz.astro patterns. If harden finds unescaped HTML in card data,
sanitize in card-data.ts.

---

## Execution Order + Dependencies

```
Task 1 (card-data.ts) ──────┐
                             ├──→ Task 3 (daily-draw.ts) ──┐
Task 2 (tests, FTF author) ─┘                              ├──→ Task 5 (integration)
                                                            │
Task 4 (daily.astro) ─── depends on 1+3 ───────────────────┘
```

- Tasks 1 and 2: **parallel** (no dependency between them)
- Task 3: blocked by Tasks 1 AND 2
- Task 4: blocked by Tasks 1 AND 3
- Task 5: blocked by Tasks 1-4

## FTF Protocol Summary

| Role | Agent | File |
|---|---|---|
| Test Author | Main thread (Opus) | `tests/daily-draw.test.ts` |
| Implementer | Subagent (Sonnet) | `src/lib/daily-draw.ts` |
| Baseline | `shasum -a 256` | `tests/.daily-draw.test.ts.sha256` |
| Verify | `shasum -a 256 -c` | After Task 3 implementation |

## Files Created

| File | Task | Purpose |
|---|---|---|
| `src/lib/card-data.ts` | 1 | 78-card typed data module |
| `src/lib/daily-draw.ts` | 3 | Deterministic PRNG utility |
| `tests/daily-draw.test.ts` | 2 | Contract tests (frozen) |
| `tests/.daily-draw.test.ts.sha256` | 2 | FTF baseline hash |
| `src/pages/daily.astro` | 4 | The /daily page |
| `public/images/og/daily.png` | 4 | OG image placeholder |
| `public/images/cards/card-back.png` | 4 | Card back placeholder |

## Files Read (not modified)

| File | Purpose |
|---|---|
| `src/data/Card Meanings with Aerial Correlation.xlsx - Sheet1.csv` | Source data |
| `src/layouts/Layout.astro` | Layout wrapper pattern |
| `src/pages/quiz.astro` | UX pattern reference |
| `src/styles/global.css` | CSS class reference |
| `tailwind.config.mjs` | Color token reference |
