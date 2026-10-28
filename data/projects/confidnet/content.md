## Looking beyond the output score

A model can make a confident mistake. Peter Kvam and I investigate whether the structure of its learned representations provides information about uncertainty beyond the output-layer scores.

## A signal from nearby examples

Our method examines neighbouring examples in a model’s representation space. Inspired by cognitive accounts of familiarity and confidence, it combines this neighbourhood information with the model’s outputs to estimate classification uncertainty.

## Current evidence

In an offline melanoma-image study, a classifier using both output scores and neighbourhood information discriminated cases better than one using output scores alone. The manuscript and public preprint describe this model comparison; the work remains under review.

The practical next question is how people interpret and act on such signals. The current study does not test clinician decisions or a human–AI intervention. Work on uncertainty estimation provides the basis for those behavioural experiments, rather than evidence of their outcome.

## What is available

KITH is a research demo built around a computer model that sorts close-up photos of skin lesions into benign (harmless) or malignant (cancerous). Give it a photo and you get two results: the model’s answer with its output probability, and a familiarity score showing how closely your photo resembles the photos it learned from. It shows early-stage (perceptual) and late-stage (decisional) familiarity, so you can compare the two.

[Open KITH](https://kith.murraysbennett.com) to try your own image or explore worked examples. Your photo stays on your computer. Nothing is uploaded. It is a research demo, not medical advice.
