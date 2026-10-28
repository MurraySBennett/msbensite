import json
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.build_site import build, esc, render_tool_tile, validate


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
            self.assertFalse((out / 'js/demos').exists())
            self.assertFalse((out / 'assets/images/_aseprite-sources').exists())
            self.assertTrue((out / 'assets/documents/MurrayBennettCV.pdf').exists())

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


class ToolsPageTests(unittest.TestCase):
    """`tools.html` is the front door, and its promises are structural.

    Each check below corresponds to a rule the page is built on, and each one
    fails silently if left to review: a tile with no citation still looks like
    a tile, a methods headline still renders, an untagged tile just quietly
    never matches a filter.
    """

    @classmethod
    def setUpClass(cls):
        cls.config = json.loads((ROOT / 'data/tools.json').read_text())
        cls.temp = tempfile.TemporaryDirectory()
        out = Path(cls.temp.name) / 'site'
        build(ROOT, out)
        cls.page = (out / 'tools.html').read_text()
        # The page's own content, without the site-wide nav and footer that
        # every page carries. The "no CV cross-link" rule is about tile copy;
        # the nav legitimately links the CV from everywhere.
        cls.main = cls.page.split('<main', 1)[1].split('</main>', 1)[0]

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_every_tool_declared_reaches_the_page(self):
        self.assertEqual(self.page.count('class="research-tile tool-tile"'),
                         len(self.config['tools']))

    def test_every_tile_carries_an_evidence_link(self):
        # The rule that makes the hub read as a programme rather than a toy
        # box. One tile without it and the page is a list of gadgets.
        self.assertEqual(self.page.count('class="tile-evidence"'), len(self.config['tools']))
        for tool in self.config['tools']:
            self.assertIn(esc(tool['evidence']['url']), self.page, tool['id'])

    def test_a_tool_without_evidence_fails_the_build(self):
        tool = dict(self.config['tools'][0])
        tool.pop('evidence')
        with self.assertRaisesRegex(ValueError, "missing 'evidence'"):
            render_tool_tile(tool, self.config['sectors'])

    def test_a_tool_with_an_invented_sector_fails_the_build(self):
        tool = dict(self.config['tools'][0], sectors=['astrology'])
        with self.assertRaisesRegex(ValueError, 'unknown sector'):
            render_tool_tile(tool, self.config['sectors'])

    def test_every_tile_declares_at_least_one_sector_chip(self):
        for tool in self.config['tools']:
            self.assertTrue(tool['sectors'], f'{tool["id"]} has no sector')
            self.assertIn(f'data-sectors="{esc(" ".join(tool["sectors"]))}"', self.page)

    def test_the_filter_chips_cover_every_sector_in_use(self):
        used = {s for tool in self.config['tools'] for s in tool['sectors']}
        for sector in used:
            self.assertIn(f'data-sector="{esc(sector)}"', self.page)
        self.assertIn('data-sector="all"', self.page)

    def test_headlines_are_not_methods_sentences(self):
        # The current grin tile's old copy -- "Estimate perceptual parameters
        # from identification counts using simulation-based inference" -- is
        # the exact failure mode. A headline addresses the reader.
        jargon = ('simulation-based inference', 'parameter estimation', 'posterior',
                  'Bayesian', 'hierarchical', 'General Recognition Theory')
        for tool in self.config['tools']:
            for word in jargon:
                self.assertNotIn(word.lower(), tool['headline'].lower(),
                                 f'{tool["id"]} headline reads as methods: {tool["headline"]}')

    def test_no_hire_me_register_anywhere_on_the_page(self):
        # Murray, 2026-10-28: "this stuff doesn't necessarily need to be
        # pushing 'hire me hire me hire me' type stuff."
        for phrase in ('my research', 'hire', 'curriculum vitae', 'cv.html',
                       'job market', 'I am looking for', 'my work', 'my publications'):
            self.assertNotIn(phrase.lower(), self.main.lower(),
                             f"tools.html's own content contains {phrase!r}")

    def test_all_three_taxonomy_sections_are_present_even_when_empty(self):
        # The grouping is what carries the organising idea. An empty section
        # keeps its heading and says why it is empty.
        for section in self.config['sections']:
            self.assertIn(f'data-tools-section="{section["id"]}"', self.page)

    def test_the_thesis_appears_once_and_is_not_repeated_per_tile(self):
        # "Do not repeat it per tile; repetition reads as a slogan."
        self.assertEqual(self.main.count('depends on the pairing'), 1)


class DemosPrefixReservationTests(unittest.TestCase):
    """The `demos/` bucket prefix belongs to the interactive research tools.

    Each tool lives in its own repository with its own deploy workflow and
    syncs into `demos/<slug>/`. This site's deploy runs `aws s3 sync --delete`,
    which removes every bucket key the local `dist/` does not contain -- so a
    missing `--exclude 'demos/*'` means the next CV update silently deletes
    every published tool. There is no error anywhere when that happens; the
    tool pages simply 404. Hence a test rather than a comment.
    """

    WORKFLOW = ROOT / '.github/workflows/deploy.yml'

    def _delete_sync_steps(self):
        lines = self.WORKFLOW.read_text().splitlines()
        steps, current = [], None
        for line in lines:
            if 'aws s3 sync' in line:
                current = [line]
            elif current is not None:
                current.append(line)
                if not line.rstrip().endswith('\\'):
                    steps.append(' '.join(part.rstrip(' \\') for part in current))
                    current = None
        return [step for step in steps if '--delete' in step]

    def test_every_deleting_sync_excludes_the_demos_prefix(self):
        steps = self._delete_sync_steps()
        self.assertEqual(len(steps), 2, f'expected 2 deleting syncs, found {len(steps)}: {steps}')
        for step in steps:
            _, found, tail = step.partition("--exclude 'demos/*'")
            self.assertTrue(found, step)
            # s3 filters are evaluated left to right and the last match wins,
            # so a later `--include '*.html'` would re-admit demo HTML.
            self.assertNotIn('--include', tail, step)

    def test_build_output_never_writes_into_the_reserved_prefix(self):
        # The repo has a source `demos/` directory, but it is documentation
        # only (`demos/README.md`) and unrelated to the bucket prefix. If a
        # build ever starts emitting `dist/demos/`, the excludes above would
        # strand it un-uploaded -- a silent no-op deploy.
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'site'
            build(ROOT, out)
            self.assertFalse((out / 'demos').exists(), 'build emitted dist/demos/')


if __name__ == '__main__':
    unittest.main()
