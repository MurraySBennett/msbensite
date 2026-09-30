# Pilot forecast model (pilot-0.1)

This is a prespecified generative simulation, not a calibrated probability model.
Draw indices are shared across each team's players. The source gate supplies only
licensed captures retrieved by the cutoff, earlier weekly stats, the latest
pre-cutoff roster and injury records. A run fails if an included game's kickoff
is at or before the cutoff, or an injury modification time is after the cutoff.
The fixture's post-cutoff `Out` update is therefore excluded by the source gate.

For each of the requested `D` draws, in stable team/player order with Python's
seeded `random.Random`:

1. **Availability.** Draw `A[p] ~ Bernoulli(q[status])` independently within
   the team. Fixed pilot priors: out 0, doubtful .25, questionable .75,
   probable .90, and unknown/unrecognized .90. Missing injury records remain
   explicitly `Unknown` with no issue time in the shard. These are assumptions,
   not empirical injury probabilities. An inactive player's every stat is zero.
2. **Partial pooling and volume.** For each player and component, take at most
   the three most recent prior weeks. A weekly usage estimate is
   `(sum(observed weekly opportunities) + 2 * position prior) / (N + 2)`.
   Target priors per game are QB 0, RB 2, WR 6, TE 4, K 0; carry priors are
   QB 2, RB 10, WR .4, TE .1, K 0. An active QB's passing-attempt prior is 30.
   Team pass attempts, targets and carries are linked counts:
   `max(0, round(Normal(max(sum(active-player estimates), team_prior/2),
   max(2, .2 * mean))))`. Team priors are 28 targets, 25 carries and 30
   pass attempts. Targets are capped by team pass attempts, leaving room for
   incompletions and untargeted throws. A missing active receiving/rushing
   group has zero modeled targets/carries; a team with receivers but no listed
   active QB still has team pass volume attributed to `other_attempts`.
3. **Shared allocation.** For each active candidate, draw a Gamma shape equal
   to `max(player usage estimate, .1)`, scale 1. Draw every team opportunity
   categorically using these Gamma weights. Thus every target, carry and pass
   attempt is assigned to exactly one modeled active player on that team when
   that position group exists. Passes by a QB absent from the captured active
   roster are counted explicitly as `other_attempts`; modeled QB attempts plus
   that remainder equal team attempts. The same draw index carries shared
   totals and allocations for all teammates.
4. **Efficiency.** For catches per target, yards per catch, yards per carry,
   completions per attempt, yards per completion and touchdowns per relevant
   opportunity, the pooled center is `(historical numerator + 10 * prior) /
   (historical denominator + 10)`. Draw a nonnegative Normal with standard
   deviation `max(.1, .2 * center)`. Probability parameters are capped at .95
   catches, .9 completions, .3 receiving TD, .2 rushing TD and .2 passing TD.
   Priors are .65 catches/target, 10 receiving yards/catch, .06 receiving
   TD/catch, 4.2 rushing yards/carry, .035 rushing TD/carry, .65
   completions/attempt, 11 passing yards/completion and .05 passing
   TD/attempt. Yards are rounded to tenths and nonnegative. Passing
   interceptions use .025 per attempt.
5. **Rare scoring events.** Independent per-opportunity Binomial draws use
   .002 passing two-point conversions/attempt, .004 rushing two-point
   conversions/carry, .008 receiving two-point conversions/reception and .004
   lost fumbles per carry, reception or passing attempt. These simple priors
   are uncalibrated and may be particularly poor for unusual scoring rules.
6. **Kickers.** Kicking is a separate component: team field-goal attempts and
   point-after attempts have fixed prior means 2.5 and 3, respectively, with
   the same team-count dispersion and allocation to active kickers. Field
   goals are made with probability .85 and point-after attempts with .95.
   Made field goals are placed into 0–19, 20–29, 30–39, 40–49, 50–59 and
   60+ yard bins in weight ratio 1:3:4:3:2:.2; misses are complements.

The opponent and game lock are preserved as indexed context; no opponent
effect is estimated in this version because the frozen source interface lacks
defensible prior opponent features. Weather, current-game state, season phase,
injury type, named defender and third-party projections are absent. Task 8
must compare this model with the rolling baseline and assess calibration
before any probability or decision band is described as calibrated.

## Snapshot contract

`python3 -m fantasy.update --season YEAR --week WEEK --cutoff UTC --output PATH`
uses `fantasy/cache` by default; `--cache`, `--seed` and `--draws` support
reproducible fixture runs. No third-party Python modeling package is required.
`current.json` points to a versioned schema-v1 manifest. The manifest records
generation/cutoff times, roster week, model version, seed, draw count, source
URLs/licences/capture hashes/times, game locks, supported stat fields and
per-team shard SHA-256 values. Shards contain indexed team opportunity and
player draws, including reported injury status and issue time. Validation
precedes publication; a complete version is installed before `current.json`
is atomically replaced. Reusing a version requires exact manifest and shard
verification. Readers should verify the pointer's manifest hash and each shard
hash, and display the dated prior snapshot with a stale warning if a refresh
fails.
