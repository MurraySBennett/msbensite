# Burdle attempt records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture opted-in Burdle rounds, including partial/abandoned play, and give the site owner a private local export.

**Architecture:** A browser consent choice enables immutable round events posted to an API Gateway HTTP API and stored in a private DynamoDB table by a small Lambda. No read endpoint or AWS credential is shipped to the browser; a local AWS-authenticated script exports round records.

**Tech Stack:** Existing static HTML/CSS/JavaScript, AWS SAM/CloudFormation, API Gateway HTTP API, Node.js Lambda, DynamoDB, Python standard library plus AWS CLI for export.

**Spec:** `docs/superpowers/specs/2026-10-28-burdle-attempt-records-design.md`

## Global Constraints

- Do not ask for names, accounts, emails, or persistent visitor identifiers.
- Do not collect invalid guesses or unsubmitted draft text.
- Let visitors play without sharing; explain what an opted-in round sends.
- Keep owner reads out of the public website and never expose AWS credentials in browser code.
- Preserve partial records; only report explicit abandonments as abandoned and otherwise use incomplete/unknown.
- Do not deploy or publish without separate explicit authorization.
- Do not add or run a test suite; use build, syntax, artifact, and static review checks.

## Review Focus

- Opt-out must prevent every collection request; inspect all event call sites and replay/session transitions.
- Replayed or retried events must not duplicate a round event; inspect sequence identity and DynamoDB conditional writes.
- Browser close, tab exit, network failure, and crash must not be misreported as confirmed abandonment; inspect terminal-state logic and export classification.
- Public writes must validate schema and size; inspect Lambda boundaries and ensure there is no public read route.
- Export must include partial histories and preserve guess order, score vector, hint state, answer, and version fields; inspect transformation and pagination.

---

### Task 1: Add opt-in event capture to Burdle

**Files:**
- Create: `js/burdle-capture-config.js`
- Modify: `index.html`
- Modify: `js/activate-burdle.js`
- Modify: `scripts/build_site.py`
- Modify: `docs/superpowers/specs/2026-10-28-burdle-attempt-records-design.md`

**Interfaces:**
- Consumes: game answer, submitted guesses/scores, hint-toggle state, and round lifecycle in `activate-burdle.js`.
- Produces: versioned `round_started`, `guess_submitted`, `hint_toggled`, `round_finished`, and `round_abandoned` POST events; no event is sent unless the visitor opts in.

- [ ] Add a consent choice before the first round in a game session: share anonymous rounds or play privately. State plainly that replays in a shared session are included.
- [ ] Capture a random round ID, answer and pool version, ordered accepted guesses and score vectors, hint state, timestamps, and win/loss/explicit abandonment. Keep interrupted sessions without a terminal event as incomplete/unknown.
- [ ] Exclude invalid submissions and unsubmitted input. Use idempotent event IDs/sequences and best-effort retry/beacon handling without logging visitor identifiers.
- [ ] Keep capture disabled when the endpoint is unset, and ensure the game continues normally.
- [ ] Inspect the final lifecycle paths and run `node --check js/activate-burdle.js`.

### Task 2: Add the private AWS capture service

**Files:**
- Create: `infra/burdle-capture/template.yaml`
- Create: `infra/burdle-capture/src/handler.mjs`
- Create: `infra/burdle-capture/README.md`

**Interfaces:**
- Consumes: the event contract from Task 1.
- Produces: one `POST /events` route; Lambda validates fixed event schemas/size and conditionally writes immutable events to a private DynamoDB table. No read route. CORS allows the canonical site and local preview.

- [ ] Define a SAM stack with HTTP API throttling, a Node.js Lambda, a private on-demand DynamoDB table, encryption, short-retention logs, and least-privilege `PutItem` access.
- [ ] Validate event names, IDs, sequence bounds, words, feedback values, and request size; reject malformed bodies and ignore headers/IP/user-agent in stored records and logs.
- [ ] Make writes idempotent for the same `(round_id, event_id)`; reject duplicates safely.
- [ ] Document manual packaging/deployment and explicitly state the IAM capabilities required. Do not deploy.
- [ ] Inspect the template and handler for public-read routes, credential exposure, and excessive permissions; run `node --check infra/burdle-capture/src/handler.mjs`.

### Task 3: Add private owner export

**Files:**
- Create: `scripts/export_burdle_records.py`
- Modify: `infra/burdle-capture/README.md`

**Interfaces:**
- Consumes: private DynamoDB table and the documented AWS CLI/IAM profile.
- Produces: local CSV plus JSONL export grouped by round, retaining partial/unknown rounds and ordered event content.

- [ ] Implement paginated authenticated scanning using the AWS CLI, with arguments for table, region, and output directory.
- [ ] Group events by round and sequence; label explicit `won`, `lost`, `abandoned`, or `incomplete` outcomes without inferring abandonment from silence.
- [ ] Write CSV and JSONL locally; never upload exports or expose them over HTTP.
- [ ] Run `python -m py_compile scripts/export_burdle_records.py`; inspect transformation against representative typed DynamoDB output without adding a test suite.

### Task 4: Build and prepare the local preview

**Files:**
- Modify: `scripts/build_site.py`
- Modify: `WORK.md`

- [ ] Add the capture config script to the static build allowlist and rebuild `dist/`.
- [ ] Run the site build, JavaScript/Python syntax checks, and `git diff --check`.
- [ ] Inspect generated artifacts, endpoint-disabled behavior, public endpoint paths, and confirm the Snake fix remains unstaged.
- [ ] Keep the service undeployed; request deployment approval only after the local code and export artifacts are reviewable.
