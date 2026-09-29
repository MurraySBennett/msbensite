# Job-search website release plan

**Goal:** Publish a review-approved, reliable academic hiring website from a reproducible static artifact.

**Architecture:** Keep the current static site and data files. A Python build renders seven project pages and the Research cards from the existing JSON and Markdown into a narrow `dist/` allowlist. GitHub Actions tests `dist/`, then syncs only that directory to S3. No backend or CMS is added.

## Milestones

1. Build `dist/` with core HTML, shared components, required JS/CSS/assets, CV, and seven project pages at `/projects/{id}.html`; retain the old query URL as a compatibility redirect. Exclude draft data and demos. Fail on missing metadata, content, publication references, assets, or unsafe local links.
2. Improve first-screen CV/contact access, semantic headings/landmarks, skip link, mobile menu target, and current-page announcement. Preserve the visual identity and optional hidden games without promoting them.
3. Add descriptive metadata, canonical URLs, and social preview tags to core and project pages. Generate project narratives and Research cards as HTML, escaping metadata and using a pinned Markdown renderer.
4. Run build and browser checks locally and in CI before deploy. Document the build/preview/check workflow. Review the final site and CV with Murray, settle the two citation-version questions, then publish and verify the public routes.

## Acceptance

- All core and seven project routes work in the built artifact at desktop/mobile widths, with keyboard access, visible focus, working CV/contact links, and sensible old/excluded project URLs.
- The artifact has no draft, deferred-demo, source, or private files; internal references resolve. A missing project file fails the build.
- CI runs the same build and checks before S3 sync. No push to `main` before author review; the push is the deployment trigger.

## Constraints and decisions

- Primary audience: academic hiring; industry relevance remains legible.
- Targeted visual polish; hidden games remain but are de-emphasized.
- Core scope stays at seven projects, Home, Research, CV, Teaching, Tools, and contact.
- Canonical CV and publication evidence remain in `../job-applications`; no unsupported claim is invented to settle citation discrepancies.
- Existing site source stays editable as plain HTML/JSON/Markdown. `dist/` is generated and ignored.
