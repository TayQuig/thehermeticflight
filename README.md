# The Hermetic Flight

An aerial tarot deck website — pre-launch campaign for a Kickstarter (target: August 8, 2026).

## Tech Stack

- **Astro 5 SSG** — static site generator
- **Tailwind CSS 3.4** — utility-first styling (Hermetic theme: gold/emerald/sulfur/void palette)
- **Vercel** — hosting + serverless functions
- **Vitest** — unit and integration tests
- **Playwright** — end-to-end tests

## Quick Start

```bash
npm install
npm run dev        # start local dev server
npm run build      # production build
npm run preview    # preview production build locally
npm run test       # run Vitest unit tests
```

## Project Structure

```
src/pages/         # Astro pages and API routes
src/lib/           # Quiz data, classifier, archetype content
src/layouts/       # Shared page layouts
tests/             # Vitest unit tests and Playwright e2e tests
docs/plans/        # Feature plan documents
operations/        # Audit reports, research artifacts, API references
```

## Environment Variables

Copy `.env.example` to `.env` (or create `.env`) and set:

```
LOOPS_API_KEY=your_loops_api_key_here
```

`LOOPS_API_KEY` is required for the quiz submission API route (`/api/quiz-submit`) to forward
archetype results to Loops.so for email onboarding sequences.

## Key Features

- Multi-step archetype quiz — scores 4 dimensions, classifies into 6 archetypes
- Static result pages at `/quiz/result/[archetype]` with OG/Twitter Card meta tags and share buttons
- Serverless quiz submission to Loops.so with rate limiting and fetch timeout
- Blog powered by Astro content collections
