# CloudFront directory-index function

`directory-index.js` is the live source of the CloudFront Function attached to the
site's distribution. Edit it here and push it with the commands below; an edge
function that exists only in the AWS console is undiscoverable.

| | |
|---|---|
| Function name | `msbensite-directory-index` |
| Function ARN | `arn:aws:cloudfront::783972422391:function/msbensite-directory-index` |
| Runtime | `cloudfront-js-2.0` |
| Distribution | `EEM313Y5S27PB` (`murraysbennett.com`, `www.murraysbennett.com`) |
| Association | default cache behaviour, `viewer-request` |
| Attached | 2026-11-16 |

CloudFront is global, so every call omits `--region`. Export `AWS_PROFILE=murray`
first: the home-manager session variable does not reach a tool shell.

## Why it exists

The distribution reads the S3 **REST** endpoint (`msbensitebucket.s3.us-east-2.amazonaws.com`)
through Origin Access Control. A REST origin returns the object at the literal
key, and `DefaultRootObject: index.html` applies only to the distribution root —
CloudFront does not extend it to subdirectories. So `/demos/workshops/` asked S3
for the key `demos/workshops/`, and because OAC grants no `s3:ListBucket` the
answer was **403 AccessDenied**, not 404.

The origin's *ID* still reads `msbensitebucket.s3-website…` because the
distribution once pointed at the S3 **website** endpoint, which resolves
directory indexes natively. Moving to REST + OAC was the right security change
and silently dropped that behaviour. The ID is a label; nothing reads it.

A viewer-request function was chosen over Lambda@Edge (higher latency and cost
for the same outcome), over reverting to the website endpoint (incompatible with
OAC, so the bucket would have to be public), and over mapping 403 → `/index.html`
with a 200 (the single-page-app pattern, which would serve the homepage for every
missing path and mask real 404s).

## Updates to the source

```bash
export AWS_PROFILE=murray

# 1. Unit-test the source locally first.
npm run test:infra

# 2. Upload to the DEVELOPMENT stage. --if-match takes the current ETag.
ETAG=$(aws cloudfront describe-function --name msbensite-directory-index \
  --query ETag --output text)
aws cloudfront update-function --name msbensite-directory-index --if-match "$ETAG" \
  --function-config 'Comment=Resolve directory URLs to index.html for murraysbennett.com (S3 REST origin + OAC),Runtime=cloudfront-js-2.0' \
  --function-code fileb://infra/cloudfront/directory-index.js

# 3. Exercise it in the real runtime before publishing.
aws cloudfront test-function --name msbensite-directory-index \
  --if-match "$(aws cloudfront describe-function --name msbensite-directory-index --query ETag --output text)" \
  --stage DEVELOPMENT --event-object fileb://event.json

# 4. Publish to LIVE. Already-associated distributions pick up the new version.
aws cloudfront publish-function --name msbensite-directory-index \
  --if-match "$(aws cloudfront describe-function --name msbensite-directory-index --query ETag --output text)"

# 5. Cached answers carry a 10-second TTL, but invalidate to be certain.
aws cloudfront create-invalidation --distribution-id EEM313Y5S27PB --paths '/*'
```

`event.json` for step 3 is a viewer-request event object:

```json
{"version":"1.0","context":{"eventType":"viewer-request"},
 "viewer":{"ip":"1.2.3.4"},
 "request":{"method":"GET","uri":"/demos/workshops/",
            "headers":{"host":{"value":"murraysbennett.com"}},
            "querystring":{},"cookies":{}}}
```

## Association and rollback

The association lives in the distribution config, not in the function, so it
takes a full `update-distribution` with the complete config and its ETag. Read
the current config to a file, edit `DefaultCacheBehavior.FunctionAssociations`,
and send it back rather than hand-writing a config:

```bash
aws cloudfront get-distribution-config --id EEM313Y5S27PB > dc.json   # holds .ETag and .DistributionConfig
# edit .DistributionConfig, keeping everything else byte-identical, then:
aws cloudfront update-distribution --id EEM313Y5S27PB \
  --if-match "$(jq -r .ETag dc.json)" --distribution-config file://new-config.json
```

To detach, set `FunctionAssociations` back to `{"Quantity": 0}`. That is the
rollback: directory URLs return to 403, and nothing else changes.

## What must keep working

`tests/directory-index-function.cjs` asserts these; `npm run test:infra` runs it.

- Any URI whose last path segment contains a dot passes through untouched, so
  `/tools.html` and every asset URL are unaffected.
- A dot in a *directory* name does not defeat the rewrite — the check is on the
  last segment, not the whole URI.
- A genuinely missing path is rewritten to another missing key, so it still
  fails rather than resolving to the homepage.

Live verification:

```bash
for p in / /tools.html /assets/images/project-icons/grin-space-plot.webp /definitely-not-a-page; do
  printf '%-55s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://murraysbennett.com$p")"
done
```

Expect 200, 200, 200, 403. `/projects/` also fails, and that is correct:
`build_site.py` emits per-project pages and no `projects/index.html`, so there is
no index for the function to find. To prove the rewrite end to end, upload a
throwaway `index.html` under a test prefix and request the prefix with a trailing
slash.

## Known rough edge

Missing paths answer **403**, not 404, because S3 denies rather than 404s under
OAC and the distribution's custom error response preserves the status. Link
checkers and crawlers treat the two differently. Changing the 403 custom error
response to answer 404 would read correctly to a crawler but would also disguise
genuine permission failures as missing pages. Left as is, deliberately.
