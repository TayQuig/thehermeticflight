---
name: "Phase 2: Style Unification Plan"
overview: "Execute Phase 2: Unify the styling by applying the 'main' branch aesthetic (Hermetic Design System) to the 'fresh-start-faq-blog' functional structure."
todos:
  - id: restore-css
    content: Restore global CSS from main into src/styles/global.css
    status: pending
  - id: fix-layout
    content: Update Layout.astro to use hermetic colors and background layers
    status: pending
    dependencies:
      - restore-css
  - id: refactor-components
    content: Refactor Header and Footer components to use hermetic tokens
    status: pending
    dependencies:
      - fix-layout
  - id: fix-index
    content: Update Index page to remove indigo/amber and use hermetic design
    status: pending
    dependencies:
      - fix-layout
---

# Phase 2: Style Unification Plan

## Objective

Merge the superior content structure of `fresh-start-faq-blog` with the established design system of `main`.

## 1. Restore Global Styles

- **Action**: Migrate the inline `<style is:global>` from `main:src/layouts/Layout.astro` into `src/styles/global.css` on the feature branch.
- **Files**: `src/styles/global.css`
- **Details**: Restore `.stars`, `.fog-layer`, `.noise-overlay`, `.glass-panel`, `.btn-flame`.

## 2. Fix Layout & Configuration

- **Action**: Update `tailwind.config.mjs` if necessary (verify `font-cinzel` needs definition or replacement).
- **Action**: Update `src/layouts/Layout.astro` in feature branch:
- Replace `bg-[#0a0a12] `with `bg-hermetic-void`.
- Replace `text-indigo-100` with `text-hermetic-white`.
- Re-integrate the background layer `div`s (stars, fog, noise) from `main`.

## 3. Refactor Components to Hermetic Theme

- **Header (`src/components/header.astro`)**:
- Replace `text-indigo-100` with `text-hermetic-white`.
- Replace `font-cinzel` with `font-serif`.
- **Footer (`src/components/footer.astro`)**:
- Replace `text-indigo-*` with `text-hermetic-white/60`.
- **Index Page (`src/pages/index.astro`)**:
- Replace `indigo`/`amber` gradients with `hermetic-gold`/`hermetic-sulfur` gradients.
- Replace hardcoded hex shadows with `shadow-gold-halo` or `shadow-flame-glow`.
- Replace `font-cinzel` with `font-serif`.

## 4. Verification

- Use `astro build` to ensure no CSS errors.
- Visual check (if possible) or code review to ensure no `indigo` or `amber` classes remain.