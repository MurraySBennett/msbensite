# Kernel methods primer — design

**Status:** Draft for review. The standalone-page format is a proposal, not an approved implementation choice.

## Intent

Create one short, openly accessible tutorial primer for psychology readers with no assumed mathematics background. It uses the core idea of workshop #004, based on Jäkel, Schölkopf, and Wichmann (2007), and rewrites it around an intuitive psychological question: how can similarity to remembered examples support categorization, and what does a kernel add to that account?

The pilot should make the psychological motivation, computational operation, and mathematical constraint legible as connected parts of one story. Its exploratory interaction should let a reader inspect how a similarity rule changes with its lengthscale. This pilot also gives evidence about what reusable exploratory-space support the static site needs.

## Audience promise

In one sitting, a reader can explain in ordinary language how similarity-weighted examples can support a category judgment, what an RBF kernel computes, how its lengthscale changes which examples matter, and why a plausible-looking similarity table is not automatically a valid kernel. No coding, account, course enrolment, or prior linear algebra is required.

## Goals

- Start from a familiar categorization problem and make the exemplar connection explicit.
- Introduce a kernel as a rule that turns two inputs into a similarity value, then connect those values to the feature-space view without requiring readers to construct that space.
- Use an RBF lengthscale explorer to connect the formula to local versus broad neighborhoods.
- Explain the limits of the picture: a valid positive-definite kernel has a global mathematical condition, and this interaction illustrates behavior rather than testing human data or proving that condition.
- Keep the primer standalone, open on the public web, and usable without tracking or accounts.
- Learn from this pilot before deciding what reusable interaction infrastructure to retain.

## Non-goals and anti-goals

- Do not port the workshop text or reproduce its R/Python lab runner.
- Do not teach linear algebra, reproduce every learning goal from the full workshop, or make regularization and the representer theorem prerequisites.
- Do not imply that a mathematical kernel is a psychological theory, that the RBF is a fit to observed judgments, or that exemplar models and kernel methods are identical.
- Do not add student records, logins, assessment, course progression, or analytics tied to individual readers.
- Do not publish or deploy as part of this design phase.

## Approaches considered

1. **Standalone primer page with a small browser interaction — recommended proposal.** Fits the current static HTML/CSS/JS build, supports a novice-first narrative, and lets the pilot reveal the interaction needs before abstractions are built. It requires a bespoke interaction for this first example.
2. **Adapt the tutorial-workshops runner.** Reuses step, activity, and lab conventions, but carries a multi-step workshop structure and R/Python execution model into a short public primer before their value is established for this audience.
3. **Reading page linking to the current workshop.** Has the lowest implementation cost, but does not deliver the novice rewrite or the requested exploratory space and leaves the main learning gap unresolved.

The proposed direction is approach 1. The existing workshop remains source material, not a runtime dependency. The content and learner experience lead; reusable interaction infrastructure follows only where this pilot demonstrates a need.

## Proposed story arc

1. **A psychological problem:** A person has seen a few members of two categories and must classify a new, similar stimulus. Invite a prediction before introducing notation.
2. **Similarity and remembered examples:** Explain exemplar-style categorization as nearby examples contributing more to a new judgment than distant ones. Keep this as an intuitive account, not a claim that every person or task follows this exact rule.
3. **A computational rule:** Introduce the RBF as one way to turn distance into a number between zero and one. Explain each part of the formula in words; put notation beside the explanation rather than making it a gate.
4. **Explore neighborhoods:** Let the reader change the lengthscale and see how the same points become narrowly or broadly similar. Connect the change to category evidence only if the interaction can show that relation without hiding its assumptions.
5. **What “kernel” adds:** Explain that positive definiteness is a constraint on the similarity values across a set, not a property a reader can infer from a smooth curve or attractive heatmap. Keep the quadratic-form argument and a small counterexample in an optional “why the condition matters” section.
6. **A model can memorize:** In a short closing note, connect an extremely narrow neighborhood to memorizing the examples and explain that regularization is one way a fitted model can be constrained. Do not derive the representer theorem; offer it only as optional deeper material if useful.
7. **Take-away and limits:** Summarize the bridge and identify what the toy interaction does not establish about human judgments, fitted models, or empirical performance. Link to the source paper and optional deeper material.

The exact length is a design call: aim for a short single sitting, approximately 8–12 minutes, and remove detail rather than adding steps if the draft exceeds that promise.

## Proposed interaction

A browser-based, self-contained RBF explorer on a fixed set of clearly labeled example stimuli. A lengthscale control updates a visible similarity view (for example, the probe’s neighborhood and a small similarity matrix) so readers can compare a narrow and broad setting. Every view uses the same points and formula; a short caption explains what changed and what did not.

The interaction should have a keyboard-operable control, visible numeric value, readable labels, and a non-color-only way to distinguish values. It should work at narrow widths and respect reduced-motion preferences. It uses deterministic illustrative points and no network calls, persistence, submission, or tracking.

**Open design detail:** Decide during implementation planning whether showing an exemplar-weighted category response adds clarity or distracts from the core lengthscale idea. If included, label the categories, points, distance measure, and response rule as chosen for the illustration; do not present the output as a participant result or fitted model.

## Content boundaries and evidence

- Source: Jäkel, F., Schölkopf, B., & Wichmann, F. A. (2007). “A tutorial on kernel methods for categorization.” *Journal of Mathematical Psychology, 51*(6), 343–358. https://doi.org/10.1016/j.jmp.2007.06.002.
- Workshop #004 is the complete source selected for its shortness and its psychological-to-computational kernel bridge; “complete” describes the source workshop, not a requirement to reproduce every workshop learning goal. The primer prioritizes similarity, the RBF lengthscale, and the exemplar connection. Regularization gets a brief intuitive limit; the representer theorem remains optional deeper material. The workshop is marked intermediate and assumes comfort with inner products, matrices, and short scripts. Its wording is not learner-ready for this primer.
- Attribute established mathematical claims to the paper or standard kernel definition. Label any toy stimulus set, example labels, or outcomes as illustrative choices. Do not describe the visualization as empirical evidence.
- Keep the main path free of matrix prerequisites. Optional mathematical detail may show the positive-definite condition and why it guarantees an inner-product feature-space interpretation.

## Relationship to the site

- **Teaching:** Add a clear route from the Teaching page to this standalone learning resource; keep the teaching biography and course history distinct from the tutorial itself.
- **GRIN:** Link as a separate example of a research tool with its own documented model, data requirements, and validation limits. The primer does not explain or validate GRIN.
- **KITH / confidence networks:** Link as a separate research example that uses neighborhoods in learned representations to study model familiarity and uncertainty. Do not conflate those learned neighborhoods with the RBF exemplar illustration or imply the primer supports KITH’s empirical claims.
- **Site infrastructure:** The current site builds a static artifact from HTML, CSS, JS, JSON, and Markdown. Prefer a page and small local script that fit this system. Any reusable interaction component is a candidate only after the pilot clarifies repeated needs.

## Acceptance criteria

- A psychology reader without linear algebra or programming can follow the main narrative and state the psychological, computational, and mathematical connection in their own words.
- The primer is short enough for one sitting and makes optional mathematical detail visibly optional.
- The interaction changes when its control changes, has a plain-language description of the effect, and does not imply that its synthetic points are collected human data.
- The primer distinguishes similarity from a valid kernel and says that the heatmap alone cannot establish positive definiteness.
- All formulas and terms needed for the main story are explained in plain language at first use.
- It runs as part of the existing static site without an account, backend, tracking, or workshop-runner dependency.
- It has keyboard access, visible focus, text labels for controls, sufficient contrast, and a usable narrow-screen layout.
- Site navigation places it alongside teaching materials while preserving accurate, bounded links to GRIN and KITH.
- No deployment occurs without separate authorization.

## Implementation questions for the next phase

- Does the pilot warrant a dedicated tutorial route linked from Teaching, or should the first version live as a section/page linked from the current Teaching page? The content should remain standalone either way.
- Should the explorer include only similarities, or also show a simple exemplar-weighted category response?
- Which optional mathematical explanation best serves the audience without turning the primer into a prerequisite-heavy chapter?

Resolve these during design review or planning. Do not build until this design is approved; after approval, write and review a separate implementation plan. Plan approval alone does not launch implementation.
