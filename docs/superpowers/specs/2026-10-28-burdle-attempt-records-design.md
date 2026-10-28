# Burdle personal attempt records design

## Intent

Let the site owner download anonymous Burdle play records for personal exploratory analysis of how feedback availability and answer randomness relate to guessing. The site is currently static, so cross-visitor records need a small first-party service.

## Goals and boundaries

- Capture each opted-in game session from round start, every accepted guess, and terminal result. Include explicitly abandoned rounds and leave sessions with no terminal event marked incomplete/unknown.
- Return raw, ordered round records to the owner as a local CSV/JSON export authenticated through AWS credentials.
- Do not request or store names, accounts, email addresses, persistent visitor IDs, unsubmitted text, or invalid guesses.
- Keep the game fully playable without sharing. Explain the collection before a visitor opts in; opting out has no gameplay penalty.
- Treat records as exploratory and client-reported, not verified or representative. Do not deploy or publish as part of this plan.

## Data model

Store immutable events with a random per-round UUID and monotonic event sequence: `round_started` (answer and answer-pool version), `guess_submitted` (word, score vector, attempt number, and double-letter-display state), optional `hint_toggled`, and `round_finished` (`won` or `lost`) or `round_abandoned` (explicit close/replay/pagehide). Each event includes a schema version and timestamp. Invalid guesses and unsubmitted draft text are excluded. Duplicate retries use the same event identity and are idempotent.

If the browser exits, loses connectivity, or crashes before an end event reaches the service, keep the start and accepted guesses and report the outcome as `incomplete/unknown`; do not claim every incomplete record is a deliberate abandonment. Browser exit reporting is best effort.

## Privacy and access

Use an explicit per-game choice to share or play privately; the choice applies to replays in that opened game session. No public read or export endpoint and no browser-held write secret. The public endpoint validates a small fixed schema, restricts browser CORS to the site and local preview origins, and uses low request throttles. CORS is not authentication, and fabricated client submissions remain possible. Do not log request bodies or configure application logs with IP address, user-agent, or headers. A notice must explain that the hosting provider may process normal connection metadata.

## Approaches

- Browser-only local storage/export: simple and private, but cannot collect other visitors' rounds or return their records to the owner.
- Third-party hosted database: quick setup, but adds another vendor, account, data path, and export/credential policy.
- **AWS API Gateway HTTP API → Lambda → private DynamoDB table, with a local AWS-authenticated export script (chosen):** matches the site's existing S3/CloudFront hosting, keeps owner reads out of the public website, and avoids a third-party analytics platform. AWS deployment is separate and requires IAM permissions not evidenced by the current static-site workflow.

## Acceptance

- A visitor can choose to share a game session or play without recording; all replay rounds in a shared session are captured.
- Each accepted guess is persisted independently so an interrupted session still exports its partial history.
- Owner export is private and produces one interpretable record per round, preserving guess order, feedback, hint state, answer/pool version, and complete/won/lost/abandoned/incomplete status.
- Invalid requests are rejected; duplicate event retries do not create duplicate records; the website contains no AWS credentials or public read route.
- Local build, JavaScript syntax, generated-artifact inspection, and static security review pass. Do not add or run a test suite.
- No backend or website is deployed/published without a separate explicit deployment approval.
