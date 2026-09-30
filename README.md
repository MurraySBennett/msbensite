# murraysbennett.com

Murray S. Bennett's academic website. Plain HTML, CSS, JSON, and Markdown are the editable source; `scripts/build_site.py` creates the reviewed static artifact in `dist/`. GitHub Actions deploys that artifact to S3 and invalidates CloudFront after checks pass. No server or CMS runs in production.

## Edit and preview

Use Python 3.13 and Node 22. The pinned Markdown renderer and browser test dependency are installed with:

```sh
python3 -m pip install -r requirements-build.txt
npm ci
npx playwright install chromium
```

Build and preview the exact files that will be published:

```sh
npm run build
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. Run `npm test` after building; it starts its own local server on a free port for browser checks. The build also checks local file references, included publication IDs, and the seven-project source index. `dist/` is generated and ignored by Git.

## Update content

- Core copy and layout: edit `index.html`, `research.html`, `cv.html`, `teaching.html`, `tools.html`, and `css/style.css`.
- A project: edit its `data/projects/<id>/meta.json` and `content.md`. Add or remove an approved project in `data/projects-index.json`; only indexed projects publish. The build renders `/projects/<id>.html` and Research cards from these files.
- Publication listings: edit `data/publications.json` after checking the canonical bibliography in `../job-applications`.
- CV download: replace `assets/documents/MurrayBennettCV.pdf` with the reviewed canonical PDF from `../job-applications`.
- Shared navigation and footer: edit `components/nav.html` and `components/footer.html`.

The old `/project-detail.html?id=<id>` route redirects included projects to their static pages. Excluded project IDs show an unavailable message. The earlier experiment demos and draft project files remain in the repository for later work and are absent from `dist/`.

## Fantasy lineup experiment

The unlisted, noindex `/tools/fantasy-lineup/` route is a fixture-tested preview. `fantasy/sources.md` records the approved public inputs and their capture rules; `fantasy/model.md` describes the generative forecast; `fantasy/evidence.md` gives the current backtest counts and release decision. A weekly update uses `python3 -m fantasy.update --season YEAR --week WEEK --cutoff UTC --output PATH --cache PATH`; it requires the four checksum-backed source captures to have been retrieved before the cutoff. Build output includes outcome snapshots only when the hashed files and matching approved forecast manifest are listed in `data/fantasy-outcomes-publish.json` after review.

Run `python3 -m fantasy.backtest --seasons 2023 2024 2025 --seed 7026` for the current evidence report, then `python3 -m unittest tests.test_fantasy_backtest -v` for controlled fixture checks. There are no admissible historical issue-time cases or reviewed real outcomes yet, so this reports zero real weeks and does not support promotion. A future JSON case catalog can be passed with `--cases PATH`; each historical case needs its own `capture_dir`, cutoff, final `outcomes`, approved `outcome_source`, raw and normalized result files with hashes, and review attribution. Fixture scenario checks additionally need a hashed pregame forecast snapshot; real scenario checks await a reviewed participation source adapter. Do not assign a past retrieval time to a current download.

## Deployment

Pull requests build and test without AWS credentials. A push to `main` builds, tests, uploads the artifact, syncs only `dist/` to S3, and invalidates CloudFront. The two sync passes give HTML immediate revalidation and other assets a one-hour cache. Do not push until the final copy, CV, and citation versions have author approval.

GitHub Actions needs `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`, and `CLOUDFRONT_DISTRIBUTION_ID` as repository secrets.
