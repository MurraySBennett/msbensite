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
            self.assertIn('status-badge status-review', research)
            self.assertNotIn('Loading projects', research)
            self.assertFalse((out / 'data/projects').exists())
            self.assertFalse((out / 'js/demos').exists())
            self.assertFalse((out / 'assets/images/_aseprite-sources').exists())
            self.assertTrue((out / 'assets/documents/MurrayBennettCV.pdf').exists())
            pilot = out / 'tools/fantasy-lineup'
            for name in ('index.html', 'methods.html', 'app.mjs', 'style.css',
                         'decision.mjs', 'scenarios.mjs', 'state.mjs'):
                self.assertTrue((pilot / name).is_file(), name)
            self.assertIn('<nav', (pilot / 'index.html').read_text())
            self.assertIn('name="robots" content="noindex,nofollow"',
                          (pilot / 'index.html').read_text())
            self.assertNotIn('/tools/fantasy-lineup/', (out / 'tools.html').read_text())
            self.assertNotIn('/tools/fantasy-lineup/', (out / 'sitemap.xml').read_text())

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
