# Held back — do not add to projects-index.json

This entry is written but deliberately **not** listed in `data/projects-index.json`,
so the site does not render it.

**Reason:** the radiology collaboration is at an early stage and carries privacy
constraints that are not yet settled. Publishing a description of the study
design, the collaborating institution, and the named constructs ahead of that is
premature.

**Before this goes live, check:**

- IRB/ethics status of the OSU Medical Center collaboration
- Whether the collaborators are content to be identified, and in what terms
- Whether the study design should be public before pre-registration
- Whether "radiology report generation" is the framing they would use

**To publish:** add this block to `data/projects-index.json`:

```json
{
  "id": "adaptive-reliance",
  "category": "Human-AI Collaboration",
  "status": "in-progress"
}
```

Then delete this file.

Drafted 2026-08-17 from `adaptive-reliance/docs/research_program.md`.
