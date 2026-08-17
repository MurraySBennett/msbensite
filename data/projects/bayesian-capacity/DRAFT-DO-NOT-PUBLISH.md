# Held back — do not add to projects-index.json

Written but deliberately **not** listed in `data/projects-index.json`, so the
site does not render it.

**Reason:** the method is not yet validated. Whether the estimand is implemented
correctly is still an open question, and there is no tool behind it — the draft
describes a two-stage design and a trials calculation that exist as intent
rather than as something anyone can run.

Putting it up would advertise a capability that isn't there yet, which is worse
than saying nothing.

**Before this goes live:**

- Confirm the capacity estimand is implemented correctly — recovery on
  simulated data with known ground truth
- Check the sequential stopping rule behaves (no early-stopping bias)
- Decide whether there is a tool, or whether it stays a methods paper
- If the two-stage design changes, the draft's framing changes with it

**To publish:** add this block to `data/projects-index.json`:

```json
{
  "id": "bayesian-capacity",
  "category": "Cognitive Modeling & Decision Science",
  "status": "in-progress"
}
```

Then delete this file.

Drafted 2026-08-17 from `bayesianCapacity/README.md`.
