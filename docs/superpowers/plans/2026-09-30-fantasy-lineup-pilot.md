# Fantasy Lineup Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable, accessible weekly NFL fantasy lineup pilot that gives calibrated, inspectable advice, records pre-advice and final decisions, and tests whether the human contribution helps.

**Architecture:** A reproducible offline Python job reads licensed public NFL data, freezes a dated all-player prediction snapshot, and publishes only reviewed static JSON. A plain-JavaScript app reads that snapshot and keeps roster, scoring and decision records in the browser. The model, optimizer, scenario explorer and evaluation are separate units so a failed model cannot be disguised by a polished interface.

**Tech Stack:** Python 3.13; pinned offline modeling dependencies in `requirements-model.txt`; Node 22 and the repo's Playwright browser tests; existing static HTML/CSS/JavaScript build. No production server or account system.

**Spec:** `docs/superpowers/specs/2026-09-30-fantasy-lineup-human-model-design.md` (approved 2026-09-30).

## Global Constraints

- Supported modeled positions: QB, RB, WR, TE and K; FLEX and SUPERFLEX obey configured eligibility. Unsupported slots such as D/ST are user-fixed and excluded from modeled totals.
- User-defined PPR and other supported scoring coefficients apply to the same simulated stat components for every lineup. Unsupported scoring rules fail visibly rather than being silently ignored.
- No Sleeper access, third-party forecast ingestion, roster upload, analytics, or live-game update. Save personal data in browser storage; make export contents clear.
- Advice is frozen with model version, source cutoffs, generation time, and game lock times. Post-lock changes never rewrite pre-lock advice.
- A What if? result is a conditional model sensitivity, not a causal effect or an automatically substituted official forecast. Do not show uncalibrated scenario probabilities.
- Only licensed data with source attribution enters the published snapshot. Do not use retrospective injury or realized game-state data as pre-game features.
- Keep the pilot route unlisted on `/tools.html` until the evaluation and public-release gate passes. No push to `main` or deployment is in this plan.

## Review Focus

1. Duplicate or ambiguous player names: roster selection uses stable player IDs; duplicate selections are rejected (Task 5).
2. Bye weeks and already-started games: neither can enter a new eligible lineup; a late revision is preserved but excluded from prospective analysis (Tasks 4, 6).
3. Missing or stale injury/status input: display the issue time and an explicit unknown state; never infer healthy or active (Tasks 1, 3, 6).
4. Nonstandard or unsupported scoring: show exactly which component is unsupported and do not generate a misleading recommendation (Tasks 2, 5).
5. Interrupted refresh or malformed snapshot: retain the last good dated snapshot, show a stale warning, and do not overwrite the saved decision (Tasks 3, 6).

## Milestone 1 — Trustworthy data and forecast

### Task 1: Source gate and pre-game fixtures

**Files:** Create `fantasy/source.py`, `fantasy/sources.md`, `tests/test_fantasy_source.py`, `tests/fixtures/fantasy/`; create `requirements-model.txt` only for dependencies actually used here.

**Interfaces:** `load_week(season: int, week: int, cutoff_utc: str, cache_dir: Path) -> WeekInput` returns normalized players (stable ID/name/team/position), games (opponent/kickoff/bye), prior weekly stat components, and injury records with their own issue times. `WeekInput` is a typed dataclass in this module; later tasks import it. Store raw downloads with URL, retrieval time, checksum and licence evidence. No current-week realized outcome is in `WeekInput`.

- [ ] Write fixture tests for player-ID join, duplicate names, a bye, missing injury record, and injury update after `cutoff_utc` being excluded; test that unsupported or unlicensed sources fail closed.
- [ ] Run `python3 -m unittest tests.test_fantasy_source -v`; expect new-module failure.
- [ ] Inspect the actual nflverse release schemas/licences and freeze the source URLs and attribution in `fantasy/sources.md`; implement `load_week` with deterministic fixture mode and checksum-backed cache. A source without a pre-lock historical archive can be used prospectively, but cannot be retroactively imputed for a backtest.
- [ ] Run the source tests; expect pass. Record one real-source schema smoke result and the exact retrieval cutoff in the task commit.
- [ ] Commit source adapter, fixtures, licence record and tests.

### Task 2: Scoring, legal lineups and a transparent benchmark

**Files:** Create `fantasy/decision.py`, `tests/test_fantasy_decision.py`.

**Interfaces:** `score(stats: StatLine, rules: ScoringRules) -> float`; `legal_lineups(players: list[Player], slots: list[Slot], locked: dict[str, str]) -> list[Lineup]`; `best_lineup(players, slots, mean_points, locked) -> Lineup`; `rolling_baseline(history: list[StatLine], cutoff_utc: str) -> dict[str, float]`. Dataclasses `StatLine`, `ScoringRules`, `Player`, `Slot` and `Lineup` live here. The scorer names supported passing, rushing, receiving, fumble and kicking components; unsupported coefficients raise `UnsupportedRule`.

- [ ] Write tests with a hand-calculated PPR score, a kicker, SUPERFLEX QB choice, FLEX eligibility, duplicate player prevention, user-fixed unsupported slot, bye/locked player and an unsupported rule. Test baseline uses only rows before cutoff.
- [ ] Run `python3 -m unittest tests.test_fantasy_decision -v`; expect failure.
- [ ] Implement the public interfaces, including a deterministic tie rule by player ID and an informative no-legal-lineup error.
- [ ] Rerun the focused tests; expect pass.
- [ ] Commit decision logic and tests.

### Task 3: Generative forecast and frozen snapshot

**Files:** Create `fantasy/model.py`, `fantasy/snapshot.py`, `fantasy/update.py`, `tests/test_fantasy_model.py`, `tests/test_fantasy_snapshot.py`; update `requirements-model.txt` as needed.

**Interfaces:** `fit_predict(week: WeekInput, seed: int, draws: int) -> Forecast` yields joint indexed draws of availability, team opportunity, player share and efficiency/stat components, with partial pooling by position/player and a separate kicker component. `write_snapshot(forecast: Forecast, output: Path) -> None` validates then atomically replaces a versioned manifest plus player/team shards. Manifest schema v1 contains season/week, generated and source-cutoff timestamps, model version, source attribution, game locks, supported stat fields, seed/draw count and per-shard hashes. `python3 -m fantasy.update --season YEAR --week WEEK --cutoff UTC --output PATH` is the operator command.

- [ ] Write fixed-seed synthetic tests for zero when out, nonnegative/count-bounded components, conserved team opportunities, positive uncertainty for sparse players, shared team draws, reproducibility, correct cutoff, and malformed/partial snapshot retaining the previous version. Include a questionable player's unknown availability and a kicker.
- [ ] Run both focused test modules; expect failure.
- [ ] Implement a prespecified hierarchical generative model and snapshot validator/writer. Keep feature groups beyond prior usage, position, team and opponent out until Task 8 tests them. Record the actual model equations and priors in `fantasy/model.md`; do not label raw draws calibrated until checked.
- [ ] Rerun focused tests and a fixture-generated update; expect pass and a valid manifest with all eligible fixture players.
- [ ] Commit model, schema, operator command and tests.

## Milestone 2 — Real weekly decision flow

### Task 4: Browser scoring, optimization and What if? engine

**Files:** Create `tools/fantasy-lineup/decision.mjs`, `tools/fantasy-lineup/scenarios.mjs`, `tests/fantasy-decision.cjs`; use the snapshot schema from Task 3.

**Interfaces:** `scoreDraws(playerDraws, rules) -> number[]`; `optimize(roster, slots, means, locks) -> lineup`; `compare(drawsA, drawsB) -> {meanDifference, interval80, probabilityA}`; `explore(snapshot, roster, slots, rules, comparison, assumption) -> ScenarioResult`. `assumption` is one of out, active-normal, active-limited, or an explicit RB/WR/TE target/carry-share value inside the model-supported range. The same draw indices are used on both sides; scenario output includes a flip threshold where estimable and never changes the baseline snapshot.

- [ ] Write cross-language golden tests against Task 2's PPR/kicker scores and lineups. Add tests for correlated draws, share reallocation conserving team totals, ineligible scenario rejection, a flip threshold, and official forecast immutability.
- [ ] Run `node --test tests/fantasy-decision.cjs`; expect failure.
- [ ] Implement the browser engine, keeping the scenario-specific rescaling of catches/yards/scores tied to modeled opportunities and labeling it as an assumption. Do not expose teammate-out, weather or game-script scenarios.
- [ ] Rerun the focused tests; expect pass.
- [ ] Commit browser decision engine and tests.

### Task 5: Local records and safe weekly state

**Files:** Create `tools/fantasy-lineup/state.mjs`, `tests/fantasy-state.cjs`.

**Interfaces:** `validateConfig(config, manifest) -> ValidationResult`; `saveConfig(config, storage) -> void`; `beginWeek(config, manifest, storage) -> WeekRecord`; `freezeAdvice(record, forecast, nowUtc) -> WeekRecord`; `saveFinal(record, finalChoice, nowUtc) -> WeekRecord`; `exportRecords(storage) -> Blob`; `importRecords(fileText, storage) -> ImportResult`. Records carry schema version, IDs, rules, data/model cutoffs, initial and final probabilities, lineup and override reasons, external-forecast disclosure, and per-player lock/exclusion flags. Import validates into a temporary object before writing storage.

- [ ] Write tests for duplicate player, ambiguous name but distinct ID, unsupported scoring, invalid slot, local-storage quota error, malformed import, schema-version mismatch, exported private fields disclosure, and late revision exclusion. Verify a failed save or import leaves the old record intact.
- [ ] Run `node --test tests/fantasy-state.cjs`; expect failure.
- [ ] Implement validation and versioned browser persistence. Configuration export/import must be portable; an import must not execute HTML or scripts from a name field.
- [ ] Rerun focused tests; expect pass.
- [ ] Commit state layer and tests.

### Task 6: Friendly accessible interface and preview route

**Files:** Create `tools/fantasy-lineup/index.html`, `tools/fantasy-lineup/app.mjs`, `tools/fantasy-lineup/style.css`, `tools/fantasy-lineup/methods.html`; modify `scripts/build_site.py`, `tests/test_build_site.py`, `tests/core-pages.cjs`, `scripts/check_site.py` if a second browser suite is needed. Do not add a Tools-page promotion yet.

**Interfaces:** The app consumes Task 3's manifest and Tasks 4–5's browser modules. Route `/tools/fantasy-lineup/` has Set up → Make your pick → Compare and save, an optional skip of unaided measurement, and a separate Results view. The comparison card shows expected points, 80% interval, P(A>B), injury/source time, lock time, decision band and What if? control. Methods/Evidence is reachable from the card.

- [ ] Add browser tests for a full fixture-roster flow, unaided and skip paths, questionable/out/stale inputs, mobile 390px layout, keyboard-only completion, visible labels/focus, text equivalents of probability/range, validation preserving typed work, and snapshot fetch failure retaining saved records. Check no horizontal overflow and no JavaScript page errors.
- [ ] Run `npm run build && npm test`; expect route/build or browser failures first.
- [ ] Implement the interface using existing site navigation, typography and focus conventions. Make its state explanation plain: advice is conditional on the dated data, and an explored scenario does not alter the saved official pick. Add the route and only its files to the build allowlist; include the route in `validate()` and the sitemap only when intentionally published as a pilot.
- [ ] Run build/tests and manually inspect desktop and mobile screenshots plus keyboard flow; expect pass and readable cards.
- [ ] Commit preview route, build integration and tests.

## Milestone 3 — Evidence and release gate

### Task 7: Results and prospective human–model comparison

**Files:** Create `fantasy/evaluate_decisions.py`, `tests/test_fantasy_evaluate_decisions.py`; extend `tools/fantasy-lineup/app.mjs`, `tools/fantasy-lineup/methods.html`, `tests/core-pages.cjs`.

**Interfaces:** `evaluate_week(record: WeekRecord, outcomes: dict[str, StatLine]) -> WeekResult` scores the frozen unaided, model and final legal lineups using the same roster/rules, computes modeled-slot oracle regret and override direction, and excludes late/non-unaided decisions where appropriate. The browser Results view consumes a versioned outcome snapshot; do not fabricate missing results. Aggregate personal-pilot reports include paired differences, confidence intervals and calibration bins only when enough observations exist.

- [ ] Write fixture tests for three picks with known scores, an override that hurts, external-advice disclosure, unsupported fixed slot, late revision, missing outcome and score correction. Add browser test that completed and pending weeks remain distinct.
- [ ] Run focused Python and browser tests; expect failure.
- [ ] Implement outcome ingestion and results UI, with distinct labels for realized points, forecast quality and research inference. Preserve frozen pre-lock records when a corrected result arrives.
- [ ] Rerun focused and site tests; expect pass.
- [ ] Commit results and prospective comparison.

### Task 8: Rolling backtest, calibration and publication decision

**Files:** Create `fantasy/backtest.py`, `tests/test_fantasy_backtest.py`, `fantasy/evidence.md`; modify `tools/fantasy-lineup/methods.html`, `README.md`, `WORK.md`, and `tools.html` only if release criteria pass.

**Interfaces:** `run_backtest(seasons: list[int], cutoff_policy: CutoffPolicy, seed: int) -> BacktestReport` performs rolling-origin forecasts with only issue-time inputs and compares the generative model with Task 2's rolling baseline on point error, interval coverage, calibration and lineup regret, by position and sparse-history status. Regret uses a prespecified, seeded set of legal synthetic rosters sampled from each historical week's eligible pool, held identical for both methods; report that construction and do not imply they were real league rosters. Feature ablations for recent usage, opponent-position, past score/clock, injury, weather and season phase run individually only when pre-kickoff historical input exists; otherwise mark “prospective only.” Scenario coverage is checked on prospectively frozen availability and usage observations.

- [ ] Write tests that deliberately leak current-week stats, post-cutoff injury status and observed weather, and require rejection. Test baseline/model paired scoring, zero-denominator calibration handling and too-few-disagreements reporting.
- [ ] Run `python3 -m unittest tests.test_fantasy_backtest -v`; expect failure.
- [ ] Implement reproducible report generation and publish exact sample sizes, cutoffs, baseline comparisons, failures and limitations in `fantasy/evidence.md` and the Methods/Evidence view. Prepare a short scenario-wording comprehension prompt; an author-run check with one other reader is a gate for public promotion, not for completing local code and evidence work. Record only aggregate findings.
- [ ] Run backtest, `npm run build`, `npm test`, and a fresh fixture-based weekly update; expect pass. Inspect output for attribution, stale handling and a usable real-roster recommendation. If calibration or baseline gate fails, keep the route an explicitly labeled experiment and do not claim superiority or list it as a working tool.
- [ ] If end-to-end checks pass, add the Tools-page link and sitemap entry in a separate reviewed commit. If they do not, commit the evidence and limitations with the route unlisted. Update `WORK.md` and `~/projects/PROJECT_GUIDE.md` for the new capability.

## Execution boundaries and recovery

Allowed writes are this repository and the affected entry in `~/projects/PROJECT_GUIDE.md`; read public NFL sources and repository documentation. Commits on the feature branch are authorized. Do not merge, push to `main`, deploy, publish new claims, ingest a restricted third-party forecast, or contact external parties without separate authorization. A routine failed check leads to diagnosis and repair; an unavailable/licence-incompatible data source, irrecoverable pre-lock provenance, or a model that cannot beat the baseline changes the release claim and is reported with evidence rather than worked around by guesswork. `WORK.md` is the sole live progress record.

**Acceptance:** A real PPR/superflex/kicker roster can be entered without league import; the tool gives a dated legal recommendation and inspectable risk scenarios; an unaided pick, final pick and later result can be saved and revisited; build, Python, browser and rolling-origin checks pass; the methods view states what was tested and what remains uncertain. Public promotion is conditional on Task 8's evidence gate.

**Launch instruction:** Make executing `docs/superpowers/plans/2026-09-30-fantasy-lineup-pilot.md` a goal. Continue through its milestones until the acceptance checks pass within the execution boundaries above, keeping `WORK.md` current and stopping for material scope or permission changes.
