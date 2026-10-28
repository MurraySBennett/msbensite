# Maximum likelihood primer — design

**Status:** Draft for review. Myung (2003) is the recommended source; the design is not approved for implementation.

## Intent and audience

Create one short, open tutorial primer for psychology readers who encounter fitted models but may not have formal statistical or mathematical training. Use maximum likelihood estimation (MLE) to connect psychological data, a probability model, and a method for estimating its parameters.

Myung’s tutorial is explicitly aimed at researchers who model cognition and are unfamiliar with estimation. The site’s existing #001 workshop is marked intro and complete. Its source sequence gives a strong foundation, but its current lab runner, calculus notes, and breadth of examples are not requirements for this novice-facing primer.

## Audience promise

In one sitting, a reader can explain what a likelihood says, how MLE chooses a parameter value for data already observed, why that estimate is not automatically “the truth,” and why a better fit alone does not settle which scientific model is better. No calculus, coding, account, course enrolment, or tracking is required.

## Goals

- Start with a concrete psychological-style count and ask which parameter value makes the observed data more compatible with a model.
- Make the probability-versus-likelihood distinction understandable without relying on notation alone.
- Let readers vary a model parameter and see where the likelihood peaks.
- Explain the estimate and its limits in plain language, with formula details available as optional depth.
- Learn from this single interaction before deciding what reusable exploratory-space infrastructure the static site needs.

## Non-goals and anti-goals

- Do not reproduce the full MLE curriculum, estimation theory, calculus derivations, asymptotic properties, or nonlinear model-fitting lab.
- Do not teach parameter estimation as a guarantee of truth, model adequacy, or predictive success.
- Do not imply MLE is used by every model or that Bayesian inference is maximum likelihood; likelihoods are used in many approaches, while Bayesian methods combine likelihood with prior information.
- Do not port the workshop runner, R/Python labs, course progress, assessment, student records, accounts, or analytics tied to readers.
- Do not publish or deploy during design review.

## Approaches considered

1. **A standalone primer page with a small browser interaction — recommended proposal.** Fits the static HTML/CSS/JS site, supports a novice-first explanation, and lets this pilot reveal what interaction support is genuinely reusable.
2. **Adapt the workshop runner.** Preserves a multi-step lesson and lab structure, but introduces execution and course-like machinery that the public primer does not need.
3. **Publish a reading page linking to the workshop.** Requires little work, but does not provide the rewrite and the hands-on explanation requested for this audience.

The proposed direction is approach 1. The #001 workshop is source material, not a runtime dependency. Content and learner experience lead; reusable infrastructure follows the pilot.

## Proposed story arc

1. **A concrete observation:** A reader sees 12 correct responses in 30 attempts. Ask which success probability, among a few candidates, makes that result most compatible with a simple model.
2. **Probability, before and after data:** Before observing the responses, the model describes possible data for a chosen probability. After the count is fixed, the likelihood compares how well different probability values account for that same observation. The algebra may look alike; the question changes.
3. **Find the maximum:** Move a slider through candidate probabilities. The likelihood is highest at 0.40, the observed proportion, for this simple binomial example. Define the MLE as the value that makes this likelihood as large as it can be.
4. **Read the result carefully:** The estimate describes the best-fitting value within the assumed model for this sample. It is not the probability that the parameter is true, and a single-sample peak does not certify that the model is scientifically right.
5. **Why it matters beyond the example:** Many psychological models estimate parameters by likelihood-based methods. This simple case is a stepping stone to more complex models; it is not a claim that every model uses MLE.
6. **Optional detail:** A compact “under the hood” section shows the binomial likelihood and explains that log-likelihood turns products into sums. Leave derivatives and the nonlinear retention comparison for deeper material.

Aim for about 8–12 minutes. If the draft grows longer, remove secondary methods detail before adding steps.

## Proposed interaction

Use a fixed illustrative dataset of 12 successes in 30 trials. A slider sets candidate success probability `p`; a curve shows the likelihood across candidate values, with a marker at the reader’s selected `p` and a clear marker at the maximum-likelihood estimate `p̂ = 12/30 = 0.40`.

Show the curve on a **relative likelihood** scale with its peak set to 100%. Label this explicitly: the vertical value compares candidate parameters for the same data; it is not a probability that a parameter is true. The interaction uses deterministic synthetic counts, no network calls, persistence, submissions, or tracking.

Use a keyboard-operable slider, visible numeric value, text labels, and a non-color-only distinction between the selected value and the peak. Ensure narrow-screen usability and respect reduced-motion preferences.

## Content boundaries and evidence

- Source: Myung, I. J. (2003). “Tutorial on maximum likelihood estimation.” *Journal of Mathematical Psychology, 47*(1), 90–100. https://doi.org/10.1016/S0022-2496(02)00028-7.
- The paper’s stated audience is cognitive-modeling researchers unfamiliar with estimation; it aims for conceptual understanding with illustrative examples. Workshop #001 turns its early arc into a binomial likelihood, an interactive likelihood curve, nonlinear retention fitting, and fit/estimation caveats. The primer prioritizes the first three and the core cautions.
- Explain the binomial assumption in simple terms: each trial is treated as an independent attempt with the same success chance. Label the counts as illustrative rather than observed participant data.
- Distinguish probability of data under a parameter from likelihood of candidate parameters for fixed data. The displayed binomial-count likelihood may omit the combinatorial factor because it is constant across candidate `p` values and does not change their relative ranking or the MLE. Never describe relative likelihood as posterior probability or confidence that a parameter is true.
- Be precise about prevalence: likelihood-based estimation is widely used in psychology and many statistical methods, but not every method maximizes likelihood.

## Relationship to the site

- **Teaching:** Link from Teaching to a standalone learning resource; keep the tutorial separate from the biography and course history.
- **GRIN:** It provides a separate example of inference for perceptual research. Describe its documented posterior outputs accurately; do not imply it is simply an MLE tool.
- **KITH / confidence networks:** It is separate research on model familiarity and uncertainty, not an MLE example used to validate this primer.
- **Site infrastructure:** Prefer a page and small local script that fit the static builder. Reuse a generic interaction component only if this pilot demonstrates a second use for it.

## Acceptance criteria

- A psychology reader without calculus or programming can explain likelihood and MLE using the fixed-count example.
- The main path explains the same expression’s different roles before and after data are observed.
- The slider changes the selected candidate and its relative likelihood; the peak is marked at the correct binomial MLE.
- The interaction says the data are illustrative and the relative likelihood is not probability that the parameter is true.
- The primer says model fit alone does not establish truth or settle model selection.
- Formula detail is optional, all main-path terms are explained in plain language, and the experience fits one sitting.
- It works in the static site with keyboard access, visible focus, text labels, sufficient contrast, and a usable narrow-screen layout; it requires no accounts, backend, tracking, or workshop-runner dependency.
- GRIN and KITH are described as separate, evidence-bounded examples.
- No deployment occurs without separate authorization.

After design approval, write and review a separate implementation plan. Plan approval alone does not launch implementation.
