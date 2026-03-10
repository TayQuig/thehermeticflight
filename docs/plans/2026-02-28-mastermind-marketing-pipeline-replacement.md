# Mastermind Report: Marketing Pipeline Replacement

**Date:** 2026-02-28
**Rounds:** 2
**Consensus:** Conditional (unanimous on replacing pipeline; approach resolved by moderator synthesis)

## The Idea
"I'd like to do some preliminary brainstorming for a marketing pipeline for this website. Currently I'm paying mailchimp, tally.so, and zapier to handle my email marketing pipeline. I wonder how I could replace/integrate all of these services...or if its better to replace 2 out of 3."

## Consensus Summary

The roundtable unanimously agreed that the current $50-100/mo pipeline (Tally + Zapier + Mailchimp) should be replaced, with the native Astro quiz form as the clear first move. The deliberation initially explored a full self-hosted stack (Resend + Supabase + Vercel Cron) before pivoting through a Mailchimp hybrid and ultimately converging on a third option that nobody proposed at the start: **Loops.so as the email backend, paired with a native quiz form and a single Vercel serverless function**.

The key tension was between cost savings and complexity. The full self-hosted stack (Option A) achieves $0/mo but requires significant engineering for CAN-SPAM compliance, drip scheduling, and email delivery — plus ongoing maintenance of 8 interconnected systems by a non-developer. The Mailchimp hybrid (Option B) reduces complexity but the Researcher discovered that Mailchimp's free tier was gutted in June 2025 — automations were removed entirely, breaking the hybrid's $0/mo thesis.

The Researcher's Round 2 fact-checks surfaced Loops.so as a superior middle path: 1,000 contacts, 4,000 sends/month, full drip automation, built-in CAN-SPAM compliance — all on the free tier. This captures the cost savings of the full replacement with the compliance safety of a managed service, while requiring only the same engineering scope as the hybrid (native quiz + one API route).

**Recommended approach: Native Astro quiz + Vercel serverless function + Loops.so (free tier).**

The full self-hosted stack (Resend + Supabase) remains the aspirational long-term architecture for when scale exceeds 1,000 contacts and the operator has more development experience.

## Agent Contributions

### Daydreamer
Reframed the quiz replacement as an opportunity for a "Living Quiz" — an interactive tarot reading experience rather than a plain form. Proposed storing drip sequences as Astro content collections (MDX files), enabling version-controlled email content that previews in the dev server. Surfaced the "progressive archetype reveal" concept: reveal only the primary dimension immediately, drip the nuances over 8 weeks. These ideas are implementation-ready regardless of email backend choice.

### Designer
Produced a comprehensive 7-component, 3-layer architecture with explicit interfaces, data flow diagrams, and a SQL schema. Key design decisions that carry forward: client-side classification for instant archetype reveal + server-side re-classification for integrity; HMAC-signed unsubscribe tokens; email templates as TypeScript functions for version control and vendor portability. The quiz UI components (QuizForm, QuizStep, ProgressBar) and classifier module are provider-agnostic and apply to all three approaches.

### Researcher
Provided the evidentiary foundation that resolved the deliberation. Five research artifacts on disk covering Resend, Supabase, Vercel, CAN-SPAM compliance, and email provider comparison. The Round 2 fact-checks were decisive: revealed Mailchimp's gutted free tier (no automations since June 2025) and surfaced Loops.so as the strongest middle-ground option (4x Mailchimp's contact limit, 8x sends, with full automation on the free tier).

### Builder
Designed a concrete build plan grounded in the existing codebase. Key contributions: identified the `seobot.ts` API route as the pattern to follow, calculated realistic email volume (~40/day at current scale), designed a 3-layer bot protection strategy (honeypot + timing validation + Vercel WAF). Conceded the hybrid approach after honest trade-off analysis, demonstrating that 80% of cost savings comes from replacing Tally + Zapier alone. The 5-session build sequence and file structure apply with minor adaptation to the Loops.so approach.

### Devil's Advocate
Stress-tested the full self-hosted stack and identified three critical risks (Vercel Cron limitations, Resend daily cap, CAN-SPAM compliance burden). All three were resolved through design changes and evidence. Corrected the Builder's Resend break-point calculation from ~60 to ~11 new subs/day sustained. Downgraded maintainability risk from HIGH to MEDIUM after recognizing the system is simpler than initially characterized and the operator has AI-assisted maintenance capability. Five operational conditions attached to the final agreement.

## Conditions

- The drip cron handler (if using the full self-hosted stack) must gracefully handle Resend HTTP 429 responses without crashing
- Maximum one drip email per subscriber per cron execution to prevent content flooding after outage recovery
- Physical mailing address (PO Box or virtual mailbox) must be secured before the first email is sent — legal prerequisite
- The Resend free tier break point (~11 new subs/day sustained) must be documented in operational notes
- Run the new system in parallel with the old stack for a minimum of 2 weeks before decommissioning Tally + Zapier
- If Loops.so is chosen, verify that its free tier API supports adding contacts with custom properties (archetype tag) and triggering automation flows programmatically

## Research Artifacts

- `operations/mastermind-marketing-pipeline-replacement/resend-reference.md` — Resend API reference, free tier limits, SPF/DKIM setup
- `operations/mastermind-marketing-pipeline-replacement/supabase-reference.md` — Supabase free tier analysis, schema design, auto-pause behavior
- `operations/mastermind-marketing-pipeline-replacement/vercel-reference.md` — Vercel Hobby plan limits, cron constraints, Astro SSR config
- `operations/mastermind-marketing-pipeline-replacement/canspam-compliance-reference.md` — Full CAN-SPAM requirements, implementation checklist
- `operations/mastermind-marketing-pipeline-replacement/email-provider-comparison.md` — Resend vs SES vs Postmark vs Loops.so comparison matrix

## Next Steps

- **Verify Loops.so API**: Research the Loops.so REST API to confirm it supports: adding contacts with custom properties (archetype), triggering automation flows via API, and tag-based segmentation. This is the one unverified dependency.
- **Extract quiz data from Tally**: Export or screenshot all 20 quiz questions, answer options, and scoring weights from the Tally form builder. This is a hard blocker for Phase 1.
- **Secure physical mailing address**: Obtain a PO Box or virtual mailbox for CAN-SPAM email footer. Required before any emails are sent.
- **Create Loops.so account**: Sign up for free tier, verify domain (SPF/DKIM), set up 6 archetype-based automation flows.
- **Build Phase 1 — Quiz Form + Classifier**: Port the Python classifier to TypeScript. Build the native multi-step quiz form in Astro with client-side classification for instant reveal.
- **Build Phase 2 — Loops.so Integration**: Create the Vercel serverless function that receives quiz submissions, re-classifies server-side, and pushes to Loops.so API with archetype tags.
- **Build Phase 3 — Drip Sequences in Loops.so**: Configure 6 archetype-specific 8-week drip automation flows. Write or migrate email content.
- **Build Phase 4 — Migration + Cutover**: Deploy native quiz, run parallel with Tally for 2 weeks, verify conversion rates, cancel Tally + Zapier subscriptions.
- **Evaluate full self-hosted stack**: When the subscriber list approaches 1,000 contacts, evaluate whether to upgrade Loops.so ($49/mo) or migrate to the full Resend + Supabase architecture designed in Round 1.
