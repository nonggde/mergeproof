# OpenAI Build Week submission notes

## Track

Developer Tools

## One-line description

MergeProof turns a public GitHub pull request into an evidence-cited release decision, targeted test plan, and rollback checklist using Codex and GPT-5.6.

## Required public artifacts

- Live Cloudflare Worker URL
- Public GitHub repository
- Public demo video under three minutes with audio
- Codex `/feedback` Session ID
- Devpost project page

## Demo sequence

1. Paste a public pull-request URL.
2. Show the bounded evidence ledger and changed-file counts.
3. Run analysis and identify the GPT-5.6 response ID.
4. Walk through the verdict, cited findings, test plan, release steps, rollback, and unknowns.
5. Export the JSON report.
6. Briefly show the architecture and explain how Codex was used to build and validate the project.

## Claims that require live verification

- The deployed Worker can complete a real GPT-5.6 analysis.
- The public repository and live URL are reachable without authentication.
- The final video URL is public and includes narration.

Do not mark these complete until each public artifact has been opened in a signed-out browser session.
