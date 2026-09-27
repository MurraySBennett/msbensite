## Looking beyond the output score

A neural network can make a confident mistake. Peter Kvam and I investigate whether the structure of its learned representations provides information about uncertainty beyond the output-layer scores.

## A signal from nearby examples

Our method examines neighbouring examples in a network’s representation space. Inspired by cognitive accounts of familiarity and confidence, it combines this neighbourhood information with the network’s outputs to estimate classification uncertainty.

## Current evidence

In an offline melanoma-image study, a classifier using both output scores and neighbourhood information discriminated cases better than one using output scores alone. The manuscript and public preprint describe this model comparison; the work remains under review.

The practical next question is how people interpret and act on such signals. The current study does not test clinician decisions or a human–AI intervention. Work on uncertainty estimation provides the basis for those behavioural experiments, rather than evidence of their outcome.
