import json
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.build_site import build, validate


ROOT = Path(__file__).resolve().parents[1]
IDS = [entry['id'] for entry in json.loads((ROOT / 'data/projects-index.json').read_text())]


class BuildSiteTests(unittest.TestCase):
    def test_build_rejects_output_containing_source(self):
        with self.assertRaisesRegex(ValueError, 'unsafe build output'):
            build(ROOT, ROOT.parent)

    def test_build_rejects_existing_nonstandard_output(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, 'existing nonstandard'):
                build(ROOT, Path(temp))

    def test_publish_artifact_has_only_selected_projects_and_static_content(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'site'
            build(ROOT, out)
            self.assertEqual(sorted(p.stem for p in (out / 'projects').glob('*.html')), sorted(IDS))
            research = (out / 'research.html').read_text()
            for project_id in IDS:
                self.assertIn(f'/projects/{project_id}.html', research)
                self.assertIn('<h1', (out / 'projects' / f'{project_id}.html').read_text())
            self.assertIn('Fitting a theory of perception', (out / 'projects/grin.html').read_text())
            self.assertIn('status-badge status-review', (out / 'projects/confidnet.html').read_text())
            kith = (out / 'projects/confidnet.html').read_text()
            self.assertIn('<a href="https://kith.murraysbennett.com" class="button" target="_blank" rel="noopener noreferrer">Open KITH</a>', kith)
            self.assertIn('<a href="https://kith.murraysbennett.com">Open KITH</a>', kith)
            self.assertIn('href="https://kith.murraysbennett.com"', (out / 'tools.html').read_text())
            self.assertTrue((out / 'assets/images/project-icons/kith-familiarity-map.webp').exists())
            self.assertTrue((out / 'assets/images/project-icons/grin-space-plot.webp').exists())
            self.assertIn('kith-familiarity-map.webp" alt="KITH final step: training images mapped, with two new images placed and scored" width="1150" height="420"', research)
            self.assertIn('status-badge status-review', research)
            self.assertNotIn('Loading projects', research)
            self.assertFalse((out / 'data/projects').exists())
            self.assertFalse((out / 'assets/images/_aseprite-sources').exists())
            self.assertTrue((out / 'assets/documents/MurrayBennettCV.pdf').exists())

    def test_only_reviewed_experiment_demos_are_published(self):
        """Publishing a demo is a deliberate act, not a side effect.

        Each of these four has a fidelity diff in docs/demos/ and a suite in
        tests/*-demo.cjs. dutch-auction has neither, so it must stay out of the
        artifact until it does. The loader still knows about it, which is why
        this is checked here rather than trusted to the allowlist alone.
        """
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'site'
            build(ROOT, out)

            for name in ('team-spirit-hh', 'dc-rs', 'mel-features', 'wheel-of-fortune'):
                self.assertTrue((out / 'js/demos' / f'{name}.js').is_file(), name)
            self.assertFalse((out / 'js/demos/dutch-auction.js').exists(),
                             'dutch-auction has no fidelity diff and must not ship')

            listing = (out / 'experiments.html').read_text()
            self.assertNotIn('?demo=dutch-auction', listing)
            for name in ('team-spirit-hh', 'dc-rs', 'mel-features', 'wheel-of-fortune'):
                self.assertIn(f'?demo={name}', listing)

            self.assertTrue((out / 'js/experiment-demo-loader.js').is_file())
            self.assertTrue((out / 'experiment-demo-viewer.html').is_file())

            # Each reviewed demo is reachable from its project page.
            for project in ('team-spirit-hh', 'discrete-choice-rating',
                            'melanoma-features', 'wheel-of-fortune'):
                page = (out / 'projects' / f'{project}.html').read_text()
                self.assertIn('experiment-demo-viewer.html?demo=', page, project)

    def test_published_lesion_images_are_licence_clean(self):
        """Only CC-0 and CC-BY may ship. 7,107 of the study's 10,000 images are
        CC-BY-NC and serving one would be a licence breach, so the manifest is
        checked against what actually lands in the artifact."""
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'site'
            build(ROOT, out)
            folder = out / 'assets/images/demos/mel-features'
            manifest = json.loads((folder / 'manifest.json').read_text())
            allowed = {record['isic_id']: record['licence'] for record in manifest['images']}
            shipped = sorted(p.stem for p in folder.glob('*.jpg'))
            self.assertTrue(shipped, 'no lesion images were published')
            for isic_id in shipped:
                self.assertIn(isic_id, allowed, f'{isic_id} is not in the manifest')
                self.assertIn(allowed[isic_id], ('CC-0', 'CC-BY'),
                              f'{isic_id} is {allowed[isic_id]}')

    def test_favicon_is_published_and_linked_on_every_page(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'site'
            build(ROOT, out)
            for name in ('favicon.ico', 'favicon.svg', 'apple-touch-icon.png'):
                self.assertTrue((out / name).is_file(), name)
            pages = list(out.rglob('*.html'))
            self.assertGreater(len(pages), 10)
            for page in pages:
                text = page.read_text()
                self.assertIn('<link rel="icon" href="/favicon.ico" sizes="any" />', text, page.name)
                self.assertIn('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />', text, page.name)

    def test_missing_project_content_fails_build(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'source'
            source.mkdir()
            shutil.copytree(ROOT / 'data', source / 'data')
            (source / 'data/projects/grin/content.md').unlink()
            with self.assertRaisesRegex(Exception, 'missing'):
                build(source, Path(temp) / 'site')

    def test_relative_asset_reference_is_checked(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'site'
            build(ROOT, out)
            (out / 'assets/images/sprites/web-design-worker.gif').unlink()
            with self.assertRaisesRegex(FileNotFoundError, 'web-design-worker'):
                validate(out)


if __name__ == '__main__':
    unittest.main()
