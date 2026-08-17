# Background

General Recognition Theory asks a precise question about multidimensional perception: when someone identifies a stimulus that varies on two dimensions, are those dimensions processed independently, and are they perceptually separable from one another? Answering it has traditionally meant fitting by maximum likelihood — a fresh numerical optimiser run for every participant, for every candidate model, with standard errors that are only as good as their asymptotics.

GRIN replaces the optimiser with a neural network, trained once on millions of simulated identification experiments. Inference becomes a single forward pass — a real Bayesian posterior in about a millisecond, not a point estimate after a multi-second search. The network is checked against classical maximum likelihood throughout, on simulated data with known ground truth and on confusion matrices from the published GRT literature, so the speed isn't coming at the expense of the answer.

# The Tool

GRIN lives on its own site, not just in a paper. It includes an interactive explorer for building perceptual spaces and watching what a model can and can't recover from them, a response-time-augmented version that infers processing architecture (serial, parallel, or coactive) directly from timing data, an upload-your-own-data analysis page that runs GRIN and a maximum-likelihood reference side by side, and a validation page laying out exactly what's been checked and how.

Try it — [GRIN](https://grin.murraysbennett.com).
