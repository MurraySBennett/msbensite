# Current work handoff

> **UNUSED TEMPLATE — not the live state.** This has never been filled in (note
> the `YYYY-MM-DD` placeholder below). The live work state for this repo is
> `WORK.md`, and `AGENTS.md` routes there. Keep this only if you intend to adopt
> the PM/worker split; if you do, fill in the Control block first so a cold
> session can tell it is live.

<!--
THE ONE LIVE HANDOFF. Read in full before editing.

Hard rules:
- Target 120 lines. Hard cap 200. If it exceeds that, you are journaling —
  move durable decisions into docs/ and compress the history to one line.
- This file is overwritten, not versioned. Git history is the archive.
- Never create CURRENT_WORK-v2.md or a dated copy of this file.
-->

## Control

- **State:** `PM_ACTION_REQUIRED`
- **Active role:** `PROJECT_MANAGER`
- **Task ID:** `—`
- **Last updated:** `YYYY-MM-DD`

| State | Active role | Meaning |
|---|---|---|
| `PM_ACTION_REQUIRED` | `PROJECT_MANAGER` | Inspect, decide, or write the next brief. |
| `READY_FOR_WORKER` | `WORKER` | Brief is complete; implementation may begin. |
| `WORKER_ACTIVE` | `WORKER` | Implementation in progress. |
| `READY_FOR_PM_REVIEW` | `PROJECT_MANAGER` | Worker finished and recorded evidence. |
| `BLOCKED` | named owner | Named role must resolve the recorded blocker. |
| `DONE` | `PROJECT_MANAGER` | Accepted; select the next task. |

## Project snapshot

<5–10 bullets. What is true about this project *right now* that a cold session
must know: what exists, what passes, what is broken and why, what is dirty in
the working tree. This is the part that saves a new chat from re-reading the
repo. Rewrite it at every acceptance — do not append.>

## Recently accepted

<One line. Task IDs only, most recent first. Details live in git history.>

## Active worker brief

### Objective

<One concrete outcome.>

### Why this is next

<One or two sentences tying it to durable direction.>

### In scope

<Numbered, specific, bounded.>

### Out of scope

<What not to touch. Name files that carry unrelated in-progress work.>

### Acceptance criteria

<Observable. A criterion that cannot be checked is not a criterion.>

### Required verification

```bash
<exact commands>
```

## Worker result

_Pending._

<!-- Worker fills in: outcome, files changed, commands run with exit status,
     pre-existing vs new failures, side effects, residual risk. Not "tests pass." -->

## Project-manager review

_Pending._

## Backlog candidates

<Discoveries that are out of scope. Not authorization to implement.>
