# Background

Preference elicitation methods underlie most of applied psychology, behavioural economics, and decision science. Two are ubiquitous: **discrete choice** (pick the option you prefer) and **rating scales** (assign a value on a numbered scale). Researchers routinely treat these as interchangeable — a rating of 6/7 and a choice for option A are taken to reflect the same underlying preference state. But this assumption has almost never been directly tested.

Testing it requires a task where there is an objectively correct answer, so that performance can be compared across methods without ambiguity about what participants *should* be doing. A perceptual discrimination paradigm — judging which of three pixelated squares is the darkest — provides exactly this. The stimuli have ground-truth saturation values; the task is the same in both formats; the question is whether the formats recruit the same internal representation or different ones.

This project develops a cognitive model to answer that question formally, and uses Bayesian model comparison to evaluate the evidence for or against a shared representation at the individual level.

# Analyses & Methodology

## Experimental Design

80 undergraduate participants completed both a choice task (CT) and a rating scale task (RS) in counterbalanced order:

- **Choice task**: three pixelated squares presented simultaneously; select the darkest
- **Rating scale task**: one square highlighted; rate on a 7-point scale how confident you are that the highlighted square is the darkest

Task difficulty was manipulated by varying the saturation differences between the squares. This created a range from clearly discriminable to highly ambiguous, spanning the full range of the rating scale and producing a spread of accuracy in the choice task.

## Cognitive Model

The model represents each stimulus as drawing from a latent Gaussian distribution on an internal "darkness" dimension. Choice and rating scale responses are both generated from comparisons among these latent values, with decision rules appropriate to each task format.

Two variants were compared:

- **Shared representation model**: a single set of latent Gaussian parameters governs both CT and RS responses — the same internal scale, expressed through different response formats
- **Separate representation model**: distinct latent parameters for CT and RS — the two tasks engage genuinely different internal states

Parameters were estimated using Bayesian methods, and **Bayes factors** were used to quantify the evidence for each model at the individual participant level. Bayes factors allow direct comparison of the null (shared) and alternative (separate) hypotheses, rather than simply failing to reject one.

## Behavioural Results

Accuracy was similar across task formats, but choice responses were significantly faster than rating responses. Task bias effects were observed depending on which square was highlighted in the RS condition. Accuracy increased as saturation differences grew, as expected.

# Outcomes & Conclusions

## Most Participants Share a Common Representation

Bayes factor model comparison favoured the shared representation model for **71% of participants**. For these individuals, the choice and rating scale tasks draw on the same latent perceptual scale — they are measuring the same thing, just expressed differently at the output stage. This validates a core assumption of decision science methodology.

## But Choice Tasks Are More Sensitive

Even when participants share a common representation, the **latent distributions are more separated** in the choice task than in the rating scale task. In other words, the choice format extracts more information from the same internal state. If you want to detect subtle perceptual differences — for instance, in a threshold detection study or a preference study where effects are expected to be small — the discrete choice paradigm may be the more sensitive instrument.

## Individual Differences Are Real

For **29% of participants**, the Bayes factor favoured separate representations. This is not measurement error — it is a genuine individual difference in how people engage with the two task formats. Some people appear to use different cognitive strategies when making choices versus providing ratings. This finding cautions against treating the two methods as universally interchangeable, especially in within-participant designs.

## Implications for Method Selection

The results provide the first direct empirical test of a long-standing methodological assumption in preference research. The practical upshot: for most people, in tasks like this one, choice and rating tasks measure the same thing. But if sensitivity matters, choice tasks have an advantage. And any study that mixes formats or assumes interchangeability should account for the minority of participants for whom that assumption fails.
