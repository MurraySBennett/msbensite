# MLE Tutorial Live Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first public-site prototype of the MLE tutorial with a source-led article on the left and a concept-responsive exploratory sandbox on the right, then serve it on port 6476 for immediate user feedback.

**Architecture:** Add a standalone static route under `tutorials/mle/` with dedicated CSS and JavaScript. The article presents the Myung (2003) conceptual arc; article controls select the active right-column sandbox, which draws local SVG explanations and applies user-controlled values without network calls. Integrate its files into the site’s explicit build allowlist, Teaching page, and sitemap.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, existing Python site builder.

**Spec:** `docs/superpowers/specs/2026-10-28-mle-primer-design.md`

## Global Constraints

- Keep the prototype local and static; do not publish, deploy, collect analytics, or send user input.
- The left article remains the primary reading path, follows Myung’s reasoning, and distinguishes source summary from our explanation and extension.
- The right sandbox responds to selected concepts with a visual walkthrough, equation exploration, or applied activity.
- Label workshop-derived synthetic retention data and conceptual curves as synthetic/illustrative; do not present them as Myung’s observations or fitted results.
- Preserve keyboard access, visible focus, text explanations of visual output, usable mobile layout, and reduced-motion preferences.
- Do not add dependencies or course machinery.
- Do not add or run tests in this pass; build the requested page and verify the local route is reachable.

## Review Focus

- Selecting a concept must update both the active label and the activity, including its written explanation.
- The likelihood slider must update the candidate marker and relative-likelihood readout, with the maximum correctly at 12/30 = 0.40.
- Synthetic forgetting observations and curves must be visibly distinguished from results reported by Myung.
- The built artifact must include the nested HTML route and its CSS/JavaScript assets.
- At narrow widths, users must still find the activity associated with the article concept that activated it.

## Files and responsibilities

- Create `tutorials/mle/index.html`: source-led tutorial content and concept controls.
- Create `styles/tutorial-mle.css`: two-column article/sandbox presentation and responsive/accessibility styles.
- Create `js/tutorial-mle.js`: local state and concept-specific activities.
- Modify `scripts/build_site.py`: allowlist the route and its dedicated assets for the built artifact.
- Modify `teaching.html`: make the prototype discoverable from Teaching.
- Modify the sitemap source/list in `scripts/build_site.py` only if it is generated there; include `/tutorials/mle/` in the output. Keep public indexing decisions consistent with the site’s current static route conventions.

## Task 1: Build the article and contextual sandbox

**Files:** Create the three tutorial files above.

The article sections should establish the flow: why estimate; specify a model; probability distribution versus likelihood; maximum likelihood and log-likelihood; numerical optimization/local maxima; least squares; power and exponential forgetting models; interpretation limits; a short synthesis. Give every concept control a stable `data-concept` key shared with the sandbox.

Sandbox concepts for this first feedback pass:

- `probability`: a binomial outcome distribution for fixed candidate `p` and `n=30`, with a control to change `p`.
- `likelihood`: the fixed `k=12, n=30` likelihood curve, candidate-`p` slider, selected-value marker, maximum marker at `p=0.40`, and relative-likelihood readout.
- `optimization`: a schematic objective with two local peaks and a control to select different starting points; explain the result in text.
- `least-squares`: a visual error/objective comparison that states the Gaussian-error condition for equivalence.
- `forgetting`: power and exponential predictions with adjustable parameters over clearly labeled synthetic points; do not claim these are Myung’s data or parameter estimates.

The sandbox remains in the right column on wide screens and is sticky only when there is enough viewport height. On narrow screens, controls should activate or reveal an inline activity adjacent to their article passage. Write the fallback article so that the conceptual path remains usable without JavaScript.

## Task 2: Integrate the route and launch the local preview

**Files:** Modify `scripts/build_site.py` and `teaching.html`; generated sitemap output as required by the builder.

Add the route and its dedicated assets to the existing explicit build lists. Reuse the site’s current header/footer components where they are supported; do not refactor shared navigation. Add one Teaching link describing this as an interactive MLE tutorial in progress.

Build with:

```sh
.venv/bin/python -m scripts.build_site
```

Expected: build completes and `dist/tutorials/mle/index.html`, `dist/styles/tutorial-mle.css`, and `dist/js/tutorial-mle.js` exist.

Serve with:

```sh
python3 -m http.server 6476 --directory dist
```

Expected: `http://localhost:6476/tutorials/mle/` loads. Keep the server running and give the user this exact URL. No publishing or deployment.

## Execution

Implement the two tasks in order. If the project builder or route conventions differ from this plan, follow the existing site and record the smallest correction in `WORK.md`. Do not wait for additional launch approval: the user explicitly requested building and spinning up the local preview.
