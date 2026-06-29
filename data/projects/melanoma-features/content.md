# Background

Clinicians diagnosing melanoma rely on the **ABCD rule** — asymmetry, border irregularity, colour variance, and diameter — to flag suspicious lesions. The rule works as a heuristic, but it treats what are genuinely continuous perceptual dimensions as if they were binary: irregular or not, asymmetric or not. That loss of information matters, both for training human diagnosticians and for building AI classifiers that need to learn from human-like judgements.

Computer vision algorithms can quantify these features automatically, but they don't capture what clinicians actually perceive. Human perceptual judgements, on the other hand, are sensitive to complex visual cues that algorithms miss — but they're noisy and subjective. This project bridges the gap: using a large-scale pairwise comparison paradigm to derive continuous, **ratio-scale perceptual measures** of melanoma features from human observers, and testing whether those measures add diagnostic value when combined with algorithmic outputs.

# Analyses & Methodology

## Pairwise Comparisons and the BTL Model

326 participants completed over 40,000 pairwise comparison trials drawn from 10,000 skin lesion images from the ISIC archive (the same dataset used in the machine metacognition work). On each trial, participants saw two lesions side by side and indicated which displayed more of a target feature — asymmetry, border irregularity, or colour variance — without any explicit rating scale.

These binary comparisons were submitted to the **Bradley-Terry-Luce (BTL) model**, a signal detection-style framework that converts relative preference data into ratio-scale estimates. The BTL model recovers a strength parameter for each image on each feature — not just a rank ordering, but a continuous scale with meaningful interval properties. The result is a set of perceptual feature scores for 10,000 lesions, derived entirely from human judgement, with no explicit measurement scale imposed.

## Computer Vision Feature Estimation

Parallel algorithmic estimates were derived for the same three features:

- **Asymmetry**: shape asymmetry from lesion masks and compactness measures
- **Border irregularity**: boundary regularity from segmentation contours  
- **Colour variance**: pixel-level variance in the RGB channels within the lesion boundary

These provide a deterministic, consistent baseline — the kind of feature that feeds standard CNN classifiers.

## Classifier Comparisons

Support Vector Machine classifiers were trained on three input configurations and compared via cross-validated ROC-AUC:

1. Human BTL perceptual scores only
2. Computer vision scores only
3. Both combined

# Outcomes & Conclusions

## Human and Algorithmic Features Are Complementary

Computer vision features alone outperformed human perceptual scores alone (AUC 0.83 vs 0.78). But combining both sources produced the best performance (AUC 0.86) — a statistically meaningful gain that holds up across cross-validation folds. The two measurement approaches capture partially non-overlapping information about the lesions.

The correlations between human and algorithmic estimates illuminate why. Asymmetry and border irregularity show moderate alignment (r ≈ 0.43 and 0.41 respectively) — humans and algorithms are measuring something similar but not identical. Colour variance shows weak alignment (r ≈ 0.05) — suggesting that human perception of colour in lesions operates quite differently from pixel-level variance metrics. That divergence is the diagnostic value.

## High-Confidence Errors Are the Real Target

In cancer screening, the dangerous errors are not the uncertain cases — clinicians and AI systems both flag those for review. The dangerous errors are the high-confidence wrong answers: a lesion classified as benign with high probability that is actually malignant. The perceptual features, and especially their combination with algorithmic scores, improve sensitivity in exactly this region. This motivated the subsequent machine metacognition work, which addresses the same problem from the network's internal representations.

## A Public Resource

The full dataset — 10,000 lesions with both human BTL perceptual scores and computer vision feature estimates, plus histopathology labels — is openly available at [osf.io/ctg9s](https://osf.io/ctg9s). It serves as a benchmark resource for researchers developing and comparing melanoma diagnostic tools.

## Conclusion

Continuous perceptual measurement, derived from human judgements via psychophysical modelling, provides diagnostic information about melanoma features that algorithmic measures do not fully capture. The complementarity of these two signal sources — and the practical improvement in classifier performance from combining them — demonstrates that human perceptual science has a concrete role to play in the development of medical AI tools. The features humans use, measured properly, make AI classifiers better.
