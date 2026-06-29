# Background

Deep neural networks are increasingly deployed in high-stakes settings — detecting cybersecurity threats, classifying medical images, flagging financial fraud. In most of these settings, the network's output is a prediction plus a softmax probability that is commonly interpreted as the network's confidence. The problem is that these softmax probabilities are systematically, reliably poorly calibrated. Networks routinely produce high-confidence outputs for inputs they should be uncertain about, including for inputs that look nothing like their training data. The network doesn't know what it doesn't know.

This matters enormously for human-AI collaboration. If a radiologist or a dermatologist is going to use an AI prediction to inform a clinical decision, they need to know not just what the network thinks, but how much to trust that judgement in this particular case. An overconfident AI that cannot signal its own uncertainty is not a safe collaborator — it's a liability.

This project asks: can we give neural networks something like **metacognition** — a second-order signal that reflects not just a prediction, but an evaluation of how well-supported that prediction is?

# Approach

The key insight comes from the human cognitive science literature on metacognition. Humans estimate their own confidence partly through **familiarity** — if a stimulus feels familiar, similar to past experience, we're more confident in our judgement of it. If it feels unfamiliar or atypical, we're more uncertain. This familiarity signal is distinct from the primary decision process: it re-evaluates the decision using secondary information.

We operationalise this idea for neural networks using **latent-space density**. An EfficientNet-B0 convolutional network was trained on 10,000 dermoscopic images for binary melanoma classification. Rather than treating the softmax output as the confidence signal, we extracted the network's **penultimate layer activations** — the 1,280-dimensional feature vector that represents the network's highest-level description of an input before the final classification decision.

For each test image, we ask: where does this image sit in the learned representation space, relative to everything the network was trained on? An image that lands in a dense cluster of well-represented training examples gets a high familiarity score. An image in a sparse region — one the network has little prior experience with — gets a low score, flagging it as a candidate for heightened uncertainty.

# Analyses & Methodology

## Neighbourhood Consistency

We computed five k-nearest-neighbour metrics from the latent space (k = 16, selected empirically):

- **Within-class similarity (W)**: proximity to training examples predicted as the same class — captures support for the current prediction
- **Between-class similarity (B)**: proximity to training examples of the alternative class — captures competitive pressure from the other category
- **Error-based similarity (E)**: proximity to training examples the network got wrong — directly measures local error risk
- **Global similarity (G)**: overall density relative to the full training set

These were combined into a composite **neighbourhood consistency score** (C = W / (W + B + E)), which normalises support for the prediction against all sources of local uncertainty. High consistency means the input is in a well-populated, unambiguous region. Low consistency flags potential extrapolation.

## Classifier Comparisons

Four logistic regression meta-classifiers were evaluated via ROC-AUC on held-out test data:

1. Softmax outputs alone (the standard baseline)
2. Raw 1,280-dimensional activations alone
3. Activations plus density metrics
4. Softmax plus density metrics (the full approach)

# Outcomes & Conclusions

## Density Signals Substantially Improve Performance

Adding latent-space density metrics to softmax outputs improved ROC-AUC from 0.94 to 0.97 — a meaningful gain in a domain where marginal improvements have clinical significance. More importantly, sensitivity increased from 0.696 to 0.955. The network's ability to correctly flag malignant lesions improved dramatically, at a modest cost to specificity (0.95 to 0.931). In cancer screening, where missed malignancies carry greater clinical cost than false alarms, this trade-off is desirable.

## High-Confidence Errors Are the Key Target

Many prediction errors occur in low-probability softmax zones — cases the network already indicates uncertainty about. But a meaningful fraction of errors occur at high softmax confidence, which are the most dangerous cases. Neighbourhood consistency identifies many of these: images with high softmax confidence but low neighbourhood consistency are flagged as candidates for human review, catching errors that the raw prediction would have passed through undetected.

## A Practical Tool for Human-AI Workload Sharing

Neighbourhood consistency provides a continuous measure of how much to trust any individual prediction, which can be used to set review thresholds. A threshold capturing 95% of errors requires a human operator to review approximately 60% of predictions. Relaxing to 80% error capture reduces the review burden to around 30%. This allows principled, context-appropriate workload sharing: the human's attention is directed to the cases where it matters most.

## Connection to Human Metacognition

The neighbourhood consistency score implements something analogous to a **fluency heuristic** — the same principle by which humans use subjective ease of processing as a cue to confidence. By anchoring the machine metacognition signal in a framework from human cognitive science, the uncertainty estimates are not just statistically motivated but cognitively interpretable. This matters for human-AI collaboration: AI uncertainty signals that are grounded in recognisable cognitive principles may be easier for human collaborators to understand, calibrate to, and appropriately use.

## Conclusion

Latent-space density provides a principled, computationally efficient route to uncertainty estimation in neural networks — going beyond output-layer calibration to exploit the richer information contained in internal representations. The approach improves diagnostic performance, substantially increases sensitivity, and produces practically useful confidence signals for human-AI collaboration in medical decision-making. The method is architecture-agnostic and applies in principle to any neural network with accessible intermediate activations.
