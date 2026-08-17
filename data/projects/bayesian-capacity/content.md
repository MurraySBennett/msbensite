# Background

Systems Factorial Technology asks how a cognitive system handles increased load: does adding a second source of information leave performance unchanged, improve it, or degrade it? The workload capacity coefficient answers that by comparing observed performance against the UCIP benchmark — an unlimited-capacity, independent, parallel system, which is the null case of channels that neither help nor hinder each other.

The coefficient is usually reported as a curve over time with no uncertainty attached. That makes two ordinary questions surprisingly hard to answer. Is this participant's capacity genuinely above the benchmark, or is the curve wandering? And how many trials would be enough to know?

# The Estimand

This project treats capacity as something to be inferred rather than computed. The estimate carries a posterior, so "above UCIP" becomes a statement with a credible interval rather than a visual impression of a line sitting above one.

That also makes the trials question answerable. Rather than adopting a convention, the required number of trials falls out of how quickly the posterior concentrates — and it differs by participant, because some are decisively above or below the benchmark early while others genuinely sit near it.

# Two-Stage Design

The practical output is a design that collects in two stages. Stage one runs online with a conjugate updater cheap enough to evaluate after every trial, stopping once the posterior has separated from the benchmark. Stage two fits the fuller hierarchical model offline, where the compute budget is not a constraint.

The pipeline runs end to end in base R in about fifteen seconds, with correctness checks that halt the run before producing results if any fail. The Stan-backed second stage is optional and separable, so the fast path stays fast.

# Related

The same capacity machinery is applied to implicit attitudes in [implicit-attitudes](/research.html#implicit-attitudes), and to cooperative human–human and human–bot performance in the team-spirit studies.
