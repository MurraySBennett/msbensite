# Maximum likelihood tutorial — design

**Status:** Direction approved for an interactive prototype. Myung (2003) is the source spine; the full tutorial and public release remain in development.

## Intent

Create a substantial, source-led online tutorial on maximum likelihood estimation (MLE), developed first as a careful learning resource for its author and then edited into a clear public tutorial for psychology and cognitive-science readers. The defining experience is a two-column tutorial: the left column follows the original article’s material and reasoning; the right is a connected sandbox that changes when the reader selects a concept, opening a visual walkthrough, an animation, an equation exploration, or an applied exercise. It should take the reader through the core argument and worked example of Myung’s academic tutorial, add teaching scaffolds and clearly labeled extensions where they improve understanding, and preserve a visible boundary between the source’s claims and our additions.

This is not a short explainer with a slider. It should be comparable in conceptual breadth to a journal tutorial, while remaining an original web treatment: explain, derive, visualize and extend the ideas without copying the paper’s prose, figures, or code.

## Reader and learning promise

Assume the reader has seen fitted models and basic probability, but may not remember calculus or optimization. The main path should build enough intuition and technical fluency that a reader can:

- explain the difference between a sampling distribution and a likelihood for observed data;
- write and interpret a likelihood and log-likelihood for a simple model;
- find and explain an MLE, including what an optimizer is doing in a nontrivial model;
- compare MLE and least-squares estimation and state when their answers coincide or differ;
- follow Myung’s forgetting-data example, understand why candidate retention models can fit differently, and avoid equating best fit with truth or generalization;
- recognize assumptions, uncertainty, and failure modes that should accompany an estimate.

Calculus and code are not prerequisites for the conceptual route. Derivatives, numerical optimization, and reproducible code belong in expandable “work through it” sections so mathematically ready readers can go deeper without making the main explanation opaque.

## Source and editorial contract

Primary source: Myung, I. J. (2003). “Tutorial on maximum likelihood estimation.” *Journal of Mathematical Psychology, 47*(1), 90–100. https://doi.org/10.1016/S0022-2496(02)00028-7.

The paper’s audience and shape suit this project: researchers in cognitive modeling who are unfamiliar with estimation, introduced to model specification, likelihood, maximizing it, its relationship to least squares, and a worked comparison of power and exponential forgetting functions. Its conclusion also cautions that fit does not by itself establish a model as true or generalizable.

Use three editorial labels throughout the working draft, and preserve them in notes until publication:

1. **Myung’s tutorial:** faithful summaries of the paper’s concepts, order, example, and stated conclusions, with section-level citations.
2. **Our explanation:** alternate derivations, diagrams, definitions, and practice checks that make the original argument easier to learn.
3. **Our extension:** new comparisons, computational experiments, or diagnostic guidance not claimed by Myung. Name their assumptions and cite their own sources before presenting them as methodological guidance.

The goal is to reproduce the *learning coverage and reasoning*, not the paper’s expression or artifacts. Link to the article, credit the source, paraphrase, redraw all visualizations, and independently write any code. Do not present a new extension as if it appeared in Myung (2003).

## Proposed tutorial structure

Treat this as a chaptered, long-form tutorial with a compact contents navigator and progress by section. Avoid promising an exact reading time before the content is written and user-tested. Each chapter should stand alone enough to revisit, while each transition explains why the next idea is needed.

### Core two-column experience

On wide screens, keep the source-led article in a readable left column and a contextual sandbox in the right column. The article is the primary path: it carries Myung’s order, definitions, derivations, example, and interpretation. The sandbox is a companion space for engaging with the idea currently being read, not an unrelated sidebar or a replacement for the explanation.

Make important concepts in the article clickable and keyboard-operable. Selecting a concept updates the right column with an appropriate activity: a step-by-step visual or animation, a manipulable equation/parameter view, or an exploratory/applied task. For example, selecting “likelihood” can fix the observed count and let the reader compare candidate probabilities; selecting “local maximum” can animate how different starting values reach different peaks; selecting a retention model can let readers adjust a parameter and compare predicted curves with the observations. Keep a clear active-concept label and a short written explanation beside every visual so the sandbox remains understandable and accessible.

The sandbox should preserve its state while the reader follows the article where useful, and offer a reset. It should not make the primary narrative wait for participation. On narrow screens, place each concept’s sandbox directly after its related article passage, or open it inline, so the connection remains clear without forcing a side-by-side layout. Respect keyboard navigation, screen-reader announcements, reduced motion, and text alternatives. All activities are local and private, with no accounts, network submissions, or tracking.

### 1. The question MLE answers

Open with a modeling problem: we have observations and a model with unknown parameters. We want parameter values that make the observed data plausible under that model. Start with the familiar 12 correct responses from 30 independent, equal-chance trials as a compact orientation example, explicitly marked illustrative. Ask what a candidate success probability says before data and after the count is observed. Preview that this small example will teach the vocabulary, not carry the whole tutorial.

### 2. Specify the probability model

Explain that estimation starts by stating what outcomes are possible and how the model assigns probabilities to them. Use a binomial count for the orientation example, then explain the assumptions: fixed trial count, binary outcomes, independent trials, common success probability. Show what changes if those assumptions fail. Introduce parameters as model settings, not directly observed properties.

Progressive detail: distinguish a probability mass function for discrete outcomes from a probability density for continuous outcomes; explain that a density value is not itself the probability of an exact continuous observation. Keep the probability model explicit before introducing its likelihood.

### 3. Turn observed data into a likelihood

Fix the observations and vary the parameter. Explain the same expression’s two readings: probability of possible data when the parameter is fixed, versus likelihood across parameter values when the data are fixed. Work through the binomial likelihood for 12/30, show why a factor constant in the parameter does not alter the maximizing value, and plot the relative-likelihood curve. Explain what the vertical scale does and does not mean.

Sandbox activity: let readers move the candidate probability with a slider and inspect how the displayed point and relative likelihood change against the peak. Activating “probability” instead fixes a candidate parameter and shows how probability is distributed over possible counts. The article remains readable on the left; the same sandbox region on the right swaps between these views. Include a plain text reading of the current state for keyboard and screen-reader users.

### 4. Define the maximum likelihood estimate

State the optimization problem and identify the peak in the binomial example. Derive the simple result that the estimate is the observed proportion, with algebra shown in a collapsible derivation. Distinguish a point estimate from a probability distribution over parameters. Explain that a maximum can be at a boundary, can be non-unique, and is conditional on the model and observations.

### 5. Why log-likelihood and optimization enter

Show that independent observations often produce a product of probabilities or densities. Taking logarithms turns the product into a sum without changing which parameter maximizes it. Use a small numeric example to build intuition about scale and underflow; then provide the compact formula. Explain that the derivative-zero condition identifies interior stationary points but does not alone prove a global maximum.

Describe numerical optimization in practical terms: choose a starting point, evaluate the objective, search for improvement, and check convergence and boundaries. Include a small plotted surface or one-dimensional example with a local maximum to show why different starts and inspection matter. Keep algorithm names secondary; provide an optional implementation box rather than turning this into a software manual.

### 6. MLE and least squares

Follow Myung’s comparison, not just a one-line distinction. Explain the objective each method optimizes, why least squares corresponds to MLE under a Gaussian-error model with the relevant assumptions, and why other error models yield other likelihood objectives. Use a small side-by-side example to show that agreement depends on assumptions. Avoid implying that least squares and MLE are always competing or interchangeable procedures.

### 7. Main worked application: modeling forgetting

Rebuild the paper’s central example in an original, readable sequence. Introduce the forgetting observations and the question of how retention changes over time. Define the power and exponential retention functions, name their parameters, and show each predicted curve before fitting. Explain the observation model needed to turn predictions into a likelihood. Fit both candidate functions using the paper’s reported setup and results, while making clear which values are sourced and which visualized values are recomputed for this tutorial.

Sandbox activity: show observed points and the two fitted curves; let the reader switch model and estimator, inspect residuals or likelihood contribution, and see how the fit criterion changes the comparison. Clicking a model name in the article should load its equation walkthrough and parameter controls into the sandbox. Keep the visualization tied to verified data and parameterization. If licensing or exact digitization prevents republication of raw points, redraw from the source only where permitted or generate a clearly labeled synthetic dataset and show the source results separately.

Interpret the comparison in stages: parameter estimate within each model; relative fit between these two candidates under the specified criterion; what the result does not establish about the true process, untested alternatives, or future observations. Preserve Myung’s cautions and explain them with a concrete overfitting/generalization scenario.

### 8. What an estimate leaves out

Separate the maximizer from uncertainty about the estimate. Explain, at an introductory level, sampling variability, standard errors or likelihood-based intervals, identifiability, model misspecification, and the difference between parameter uncertainty and model comparison. This chapter is a map, not a full course in asymptotic theory: define the ideas accurately, illustrate each, and link outward for deeper study. Clearly label material extending beyond Myung (2003) and source it.

### 9. Reproduce and extend

Provide a self-contained notebook/script or browser-based computational appendix that rebuilds the tutorial’s two main examples from documented inputs. Include reproducibility notes, independent implementation, and checks against the paper’s reported outputs. Then offer one carefully chosen extension that helps readers test their understanding, such as repeating the fit under changed noise or sample size and observing estimate variability. Keep this extension explicitly ours; do not add a grab bag of advanced topics.

### 10. Synthesis and next reading

Close with a compact conceptual map: model → sampling distribution → likelihood for fixed data → objective → estimate → uncertainty and model checking. Ask the reader to explain one result in their own words. Recommend follow-on reading for optimization, uncertainty, and Bayesian inference, making clear that Bayesian methods use likelihood but generally do not define their estimate by maximizing likelihood alone.

## Learning activities and interaction principles

- Use the binomial example as a low-friction vocabulary builder, then carry the reader into the source’s more realistic model-comparison example.
- Concepts in the article invite optional sandbox interactions: visual walkthroughs, animated explanations, equation explorations, or applied tasks selected to fit the concept. At least one is mapped to each major chapter; answers are private to the browser and never transmitted.
- On desktop, the article remains in the left reading column and the concept-responsive sandbox occupies the right. On mobile, each sandbox activity stays adjacent to its article passage.
- Make plots inspectable and meaningful rather than decorative: axes, parameter values, assumptions, source labels, and text equivalents are visible.
- Distinguish the paper’s reported results, our computed reproductions, and synthetic teaching data in captions and downloadable materials.
- Keep formulas in the main flow when they are central, but unpack every symbol. Use optional derivation panels for calculus and code.
- Any likelihood-scale display states whether it is raw likelihood, log-likelihood, or relative likelihood; none is described as the probability that a parameter is true.

## Scope boundaries

- This is one substantive tutorial, not a complete estimation textbook, formal asymptotics course, or survey of every likelihood-based method.
- Do not reduce the work to a short primer or leave out the forgetting-model application that gives Myung’s article its modeling payoff.
- Do not claim MLE is universal. Explain that many methods use likelihood, while Bayesian analysis combines likelihood with prior information and targets a posterior distribution.
- Do not imply a good fit proves scientific truth, uniquely identifies a process, or predicts new data well.
- Do not port the workshop runner, student accounts, grades, progress tracking, analytics, or server-backed submissions.
- Do not publish or deploy during design review.

## Relationship to existing work and site

- Workshop #001 in `projects/textbook-tools/tutorial-workshops/workshops/001-myung-2003-mle/` is marked intro/complete and provides an existing learning path: binomial likelihood, log-likelihood, nonlinear forgetting/retention fitting, MLE vs LSE, and caveats. Use it as an internal study artifact and compare it against the paper; the public tutorial should deepen and editorially improve that material, not merely transplant it.
- Put the tutorial in the Teaching area as a standalone learning resource. Keep it separate from biography and course history.
- GRIN is a separate example of inference for perceptual research. Describe its documented posterior outputs accurately; do not rebrand it as MLE.
- KITH / confidence networks are separate research on model familiarity and uncertainty, not evidence validating this tutorial.
- First deliverable after design approval is an implementation plan covering source verification, data/figure rights, computation validation, content drafting, interaction, accessibility, and review. Build reusable infrastructure only where this tutorial demonstrates a real second use.

## Acceptance criteria for the tutorial

- Its scope follows the conceptual arc of Myung (2003): specification, likelihood, maximization, log-likelihood/optimization, least-squares relationship, and the forgetting-model application with interpretation cautions.
- It is a substantial chaptered learning experience with derivations, worked examples, visual explanations, and a reproducibility appendix; it is not capped at one sitting or an arbitrary short reading time.
- Its central interface is a connected two-column experience: source-led article on the left, concept-responsive exploratory/applied sandbox on the right. Selecting a concept updates the sandbox with a relevant walkthrough, visualization, equation exploration, or task.
- The distinction between probability and likelihood is explained with fixed and varying quantities made explicit.
- The forgetting comparison accurately identifies model equations, observation assumptions, estimation criteria, reported/recomputed values, and limitations.
- MLE, least squares, uncertainty, model fit, and generalization are distinguished without overclaiming.
- Source-derived material, our teaching explanations, and extensions remain identifiable during drafting; all borrowed claims are cited and original expression/figures/code are used.
- The reader can complete the conceptual route without calculus, coding, account creation, or tracking; technical depth remains available.
- Interactions support keyboard operation, visible focus, non-color cues, readable text equivalents, narrow screens, and reduced motion; each visual sandbox has a written explanation and is placed alongside its concept on mobile.
- GRIN and KITH are described as separate, evidence-bounded examples.
- No publishing occurs without separate authorization.

The user has authorized building a local prototype now to give immediate, explicit feedback. Keep the first implementation small enough to shape live: establish the two-column experience, make concept selection update the sandbox, and include a meaningful MLE learning path with the forgetting example visibly represented. A complete tutorial draft and public release remain later work; do not publish or deploy.
