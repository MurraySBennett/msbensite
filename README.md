# murraysbennett.com

Personal academic website for Murray S. Bennett — hosted on AWS S3 + CloudFront, deployed via GitHub Actions.

## Structure

```
/                          ← HTML pages (S3 requires these at root)
  index.html
  research.html
  project-detail.html
  experiments.html
  experiment-demo-viewer.html
  teaching.html
  cv.html
  404.html

/.github/workflows/
  deploy.yml               ← Auto-deploys to S3 on push to main

/css/
  style.css                ← All styles

/js/
  components.js            ← Injects shared nav + footer into every page
  research-grid.js         ← Dynamically renders project tiles on research.html
  project-detail.js        ← Loads project meta + content on project-detail.html
  experiment-demo-loader.js
  nav-burger.js            ← (legacy, now handled by components.js)
  dpad.js
  activate-pixel-chaser.js
  activate-konami.js
  activate-snake.js
  activate-pong.js
  steal-the-doi.js

/js/demos/
  team-spirit-hh.js
  dutch-auction.js
  wheel-of-fortune.js
  mel-features.js
  dc-rs.js

/components/
  nav.html                 ← Shared navigation HTML fragment
  footer.html              ← Shared footer HTML fragment

/data/
  projects-index.json      ← Lightweight list of all projects (id + category)
  publications.json        ← All publications in structured format
  projects/
    {project-id}/
      meta.json            ← Tile metadata (title, summary, thumbnail, links, etc.)
      content.md           ← Full project narrative in Markdown

/assets/
  images/
    murray_small.png
    project-icons/         ← Tile thumbnail images
    team-spirit-hh/        ← Project-specific images
    sprites/               ← Easter egg GIFs
    button-icons/          ← Gamepad button images
  documents/
    MurrayBennettCV.pdf
  audio/
    steal.mp3
```

## Adding a new project

1. Create `/data/projects/your-project-id/`
2. Add `meta.json` (copy from an existing project and update fields)
3. Add `content.md` (write your project narrative in Markdown)
4. Add one line to `/data/projects-index.json`:
   ```json
   { "id": "your-project-id", "category": "Cognitive Modeling & Decision Science", "status": "in-progress" }
   ```
5. (Optional) Add a thumbnail image to `/assets/images/project-icons/` and update `meta.json`

The project tile on `research.html` and the detail page on `project-detail.html?id=your-project-id` will both work automatically.

## Adding a new experiment demo

1. Create `/js/demos/your-demo-id.js`
2. Add an entry to the `demoMap` in `/js/experiment-demo-loader.js`
3. Add a tile to `experiments.html`
4. Update the relevant project's `meta.json` to include the demo link

## Deployment

Push to `main` — GitHub Actions handles the rest.

**First-time setup:** Add these secrets under Settings → Secrets and variables → Actions:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (e.g. `us-east-1`)
- `S3_BUCKET_NAME`
- `CLOUDFRONT_DISTRIBUTION_ID`

## Local development

Since the site uses absolute paths (`/css/style.css`, `/data/projects/...`), you need a local server rather than opening HTML files directly. The simplest option:

```bash
# Python (built-in, works on all platforms)
python -m http.server 8000
# then open http://localhost:8000
```

Or with VS Code, install the **Live Server** extension and click "Go Live".

## meta.json schema

```json
{
  "id": "project-id",
  "title": "Full Project Title",
  "category": "One of: Human-AI Collaboration | Cognitive Modeling & Decision Science | Perception & Applied Vision",
  "status": "One of: published | under-review | in-progress",
  "thumbnail": "/assets/images/project-icons/filename.png",
  "thumbnail_alt": "Alt text for the thumbnail",
  "summary": "One or two sentence summary shown on the tile and detail page.",
  "tags": ["tag1", "tag2"],
  "links": {
    "osf": "https://osf.io/...",
    "experiment_demo": "/experiment-demo-viewer.html?demo=demo-id",
    "interactive_demo": "",
    "publication": "https://doi.org/..."
  },
  "publications": ["publication-id-from-publications.json"]
}
```
