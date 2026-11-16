// Checks the CloudFront viewer-request function in infra/cloudfront/. The file
// is loaded as source and evaluated, so what is tested is byte-identical to
// what is uploaded to CloudFront — the function has no module exports because
// the CloudFront Functions runtime has no module system.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const source = readFileSync(
  path.join(__dirname, '..', 'infra', 'cloudfront', 'directory-index.js'), 'utf8');
const handler = new Function(`${source}\nreturn handler;`)();

const rewritten = uri => handler({ request: { uri } }).uri;

test('a trailing slash resolves to that directory index', () => {
  assert.equal(rewritten('/demos/workshops/'), '/demos/workshops/index.html');
  assert.equal(rewritten('/'), '/index.html');
});

test('an extensionless path resolves to its directory index', () => {
  assert.equal(rewritten('/demos/workshops'), '/demos/workshops/index.html');
});

test('anything with a file extension passes through untouched', () => {
  for (const uri of [
    '/tools.html',
    '/404.html',
    '/projects/confidnet.html',
    '/assets/images/project-icons/grin-space-plot.webp',
    '/data/projects.json',
    '/sitemap.xml',
    '/robots.txt',
  ]) {
    assert.equal(rewritten(uri), uri);
  }
});

test('a dot in a directory name does not defeat the rewrite', () => {
  assert.equal(rewritten('/demos/v1.2/overview'), '/demos/v1.2/overview/index.html');
  assert.equal(rewritten('/demos/v1.2/'), '/demos/v1.2/index.html');
});

test('a missing page is not rewritten into an existing one', () => {
  // It must become a key that is still absent, so the 404/403 survives.
  assert.equal(rewritten('/definitely-not-a-page'), '/definitely-not-a-page/index.html');
});
