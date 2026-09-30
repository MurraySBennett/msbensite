import json
import hashlib
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.build_site import build, validate
from fantasy.evaluate_decisions import write_outcome_snapshot
from fantasy.decision import StatLine


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
                         'decision.mjs', 'scenarios.mjs', 'state.mjs', 'evaluation.mjs'):
                self.assertTrue((pilot / name).is_file(), name)
            self.assertIn('<nav', (pilot / 'index.html').read_text())
            self.assertIn('name="robots" content="noindex,nofollow"',
                          (pilot / 'index.html').read_text())
            self.assertNotIn('/tools/fantasy-lineup/', (out / 'tools.html').read_text())
            self.assertNotIn('/tools/fantasy-lineup/', (out / 'sitemap.xml').read_text())
            self.assertFalse((pilot / 'outcomes').exists())

    def test_reviewed_outcome_snapshot_is_in_built_artifact_only_when_allowlisted(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'source'
            shutil.copytree(ROOT, source, ignore=shutil.ignore_patterns(
                '.git', '.venv', 'node_modules', 'dist', '__pycache__'))
            folder = source / 'tools/fantasy-lineup/outcomes'
            manifest = {'schema_version': 1, 'season': 2099, 'week': 4,
                        'games': {'a': {'kickoff_utc': '2099-09-28T17:00:00Z'}}}
            forecast_bytes = (json.dumps(manifest, sort_keys=True,
                                         separators=(',', ':')) + '\n').encode()
            forecast_hash = hashlib.sha256(forecast_bytes).hexdigest()
            forecast_file = source / f'tools/fantasy-lineup/versions/{forecast_hash[:20]}/manifest.json'
            forecast_file.parent.mkdir(parents=True)
            forecast_file.write_bytes(forecast_bytes)
            row = StatLine('a', '2099-09-29T12:00:00Z',
                           {'receptions': 8, 'receiving_yards': 80})
            write_outcome_snapshot(manifest, {'a': row}, folder,
                                   {'name': 'fixture', 'url': 'https://example.invalid/final',
                                    'retrieved_at': '2099-09-29T13:00:00Z',
                                    'licence': 'fixture only', 'raw_sha256': 'a' * 64,
                                    'status': 'final'})
            (folder / 'unreviewed.json').write_text('{}')
            files = [{'path': str(path.relative_to(source)),
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                     for path in sorted(folder.rglob('*.json')) if path.name != 'unreviewed.json']
            allowlist = source / 'data/fantasy-outcomes-publish.json'
            allowlist.write_text(json.dumps({'schema_version': 1, 'reviewed_at': '2099-09-29T13:00:00Z',
                                             'reviewer': 'fixture', 'files': files,
                                             'forecast_manifests': [{'path': str(forecast_file.relative_to(source)),
                                                                     'sha256': forecast_hash}]}))
            out = Path(temp) / 'site'
            build(source, out)
            self.assertTrue((out / 'tools/fantasy-lineup/outcomes/current.json').is_file())
            self.assertFalse((out / 'tools/fantasy-lineup/outcomes/unreviewed.json').exists())
            selection = json.loads(allowlist.read_text())
            selection['forecast_manifests'] = []
            allowlist.write_text(json.dumps(selection))
            with self.assertRaisesRegex(ValueError, 'approved forecast'):
                build(source, Path(temp) / 'other-site')

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
