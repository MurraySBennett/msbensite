# Background

A Dutch auction begins at a high price and counts down until someone bids. The first bidder wins — with certainty, at the current price. Wait longer and the price drops further, but so does your probability of winning as competitors might bid first. This tension between *certainty* and *price* makes the Dutch auction an ideal laboratory for studying competitive group decision-making: unlike most auction formats, the tradeoff is explicit, continuous, and time-pressured.

Despite their commercial importance — the Dutch flower markets alone turn over hundreds of millions of dollars annually — Dutch auctions had received relatively little quantitative study from a cognitive science perspective. This project had three goals: build a computerised platform for controlled Dutch auction research; establish empirical benchmarks for how groups actually bid under different conditions; and develop the first quantitative cognitive model of multi-player Dutch auction behaviour.

You can try a version of the task here — [Dutch Auction demo](/experiment-demo-viewer.html?demo=dutch-auction).

# Analyses & Methodology

## Platform Development

The computerised platform was designed to allow systematic manipulation of three fundamental parameters identified by Cox et al. (1982): starting price, rate of price change, and size of price decrements. Groups of three participants competed with hypothetical funds to fill virtual warehouses across 60 auction trials per session. The platform supports both human-vs-human and human-vs-computer competition, and records winning bid price and timing on every trial.

Two experimental manipulations were tested:

- **Price change pattern**: discrete (10 large steps over 5 seconds) vs continuous (100 small steps over 5 seconds) — same overall duration, different perceptual experience
- **Stock volatility**: fixed quantity available per auction (Experiment 1) vs variable quantity (Experiment 2)

Bayesian analysis was used throughout, allowing direct quantification of evidence for null effects — important when the theoretical question is whether a manipulation *doesn't* matter.

## Behavioural Results

Both the discrete and continuous price change conditions produced virtually identical winning bid prices and timing. Bayes factor analysis provided strong evidence for these null effects, suggesting that it is the overall auction duration — not the pattern of price change — that drives bidding behaviour. Volatility similarly had no reliable effect. Across both experiments, neither condition nor learning across blocks changed average bid prices.

The one robust effect was **starting price**: higher starting prices led reliably to higher winning bids, in both fixed and variable quantity auctions, and this effect was replicated across different bin sizes and analysis approaches. This anchoring-like pattern is theoretically predicted and practically significant: auctioneers who set higher starting prices extract higher revenues.

## A Dynamic Prospect Theory Model

Prospect theory (Kahneman & Tversky) is the standard account of decision-making under uncertainty, but it had never been applied to Dutch auctions quantitatively. We extended it to the time domain by treating each moment of the auction as a binary choice: bid now (certain win at the current price) or wait a moment (potentially lower price, but risk of a competitor bidding).

The model defines:
- The **utility** of bidding now: known gain minus known cost, transformed through the prospect theory utility function
- The **weighted utility** of waiting: discounted by the subjective probability that a competitor bids in the next moment, modelled as a hazard function from the estimated bid time distribution of other players

Three-player group bidding is derived by taking the minimum of three independent player hazard functions. Despite using standard prospect theory parameter values from Tversky and Kahneman (1992), the model reproduced the major qualitative patterns in the data — including the starting price effect — demonstrating sufficient validity and providing a theoretical foundation for future quantitative work.

# Outcomes & Conclusions

**Pattern of price change is not what matters.** Holding auction duration constant, discrete vs continuous price change has no detectable effect on bidding behaviour. The effect reported in earlier work appears to have been driven by differences in auction duration, not price change pattern.

**Starting price is the dominant driver.** This finding is both theoretically interpretable (anchoring, framing effects, or the endowment effect in reverse) and practically important for auction design.

**Competitive context shapes strategy less than expected.** Little evidence of strategic learning across blocks suggests either that participants arrived with good estimates of item value from the task structure, or that group competitive environments stabilise bidding prices rapidly.

**The platform supports a programme of future work.** The computerised auction task — with its support for computer competitors, performance feedback, and systematic parameter manipulation — provides infrastructure for extending this work to human-AI competition, studying how people bid against algorithmic opponents and how AI bidding strategies might be designed to match human behaviour.
