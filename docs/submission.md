# OpenAI Build Week submission notes

## Track

Developer Tools

## One-line description

MergeProof turns a public GitHub pull request into an evidence-cited release decision, targeted test plan, and rollback checklist using Codex and GPT-5.6.

## Public links

- Live app: https://mergeproof.a13553776411.workers.dev
- Repository: https://github.com/nonggde/mergeproof
- Demo video: https://youtu.be/P9kjeAgAaWU
- Devpost project: https://devpost.com/software/mergeproof

## Devpost copy

### Tagline

Turn a pull request into an evidence-cited release decision.

### Inspiration

Pull-request review and release approval are related but different jobs. A review can say the code looks reasonable while release owners still need to know what changed, which tests matter, what evidence is missing, and how to roll back. Existing AI review tools often produce confident prose without showing exactly which supplied evidence supports each claim. MergeProof was built to make that boundary visible.

### What it does

MergeProof accepts a public GitHub pull-request URL and collects a bounded ledger of PR metadata and changed-file patches. GPT-5.6 converts that evidence into a strict, structured release brief: a verdict and risk score, affected surfaces, cited findings, a prioritized test plan, release and rollback steps, and explicit unknowns. Every finding must cite one or more supplied file paths. The complete report can be copied or exported as JSON.

### How it was built

The product is a single Cloudflare Worker with static assets. The Worker validates canonical GitHub PR URLs, reads metadata and up to 40 changed-file patches, enforces per-file and total evidence budgets, and sends the bounded payload to the OpenAI Responses API. GPT-5.6 (`gpt-5.6-sol`) runs with medium reasoning and strict JSON Schema output. The browser renders the structured response without executing repository content. Codex helped define the product boundary, implement the Worker and responsive interface, review security and evidence limits, add tests, and verify the production deployment.

### Challenges

The hardest problem was preventing a useful release brief from becoming an ungrounded code-review summary. MergeProof therefore treats GitHub content as untrusted input, separates it from developer instructions, requires path citations, reports truncation, and reserves an explicit section for unknowns. Another challenge was fitting dense engineering evidence into a mobile layout without hiding the decision context.

### Accomplishments

- Real GPT-5.6 Responses API integration with strict structured output.
- File-path citations on every release finding.
- Bounded streaming reads for incoming requests, GitHub responses, and OpenAI responses.
- Explicit evidence truncation and unknown-context reporting.
- Production deployment with server-side secrets, CSP, logs, and traces.
- Responsive release workspace verified with live reports on desktop and mobile.

### What was learned

Structured output solves response-shape consistency, but it does not solve grounding by itself. The evidence contract, prompt boundary, truncation signals, and UI treatment all need to reinforce the same rule: a claim without supplied evidence is an unknown. GPT-5.6 was especially effective at converting a narrow patch ledger into targeted checks and rollout actions when those boundaries were explicit.

### What's next

The next step is optional GitHub App access for private repositories and CI evidence, followed by saved team policies for required checks and rollout gates. A future version could compare the generated plan with actual CI results while preserving the same cited-evidence contract.

### Technologies

OpenAI Responses API, GPT-5.6, Codex, Cloudflare Workers, TypeScript, GitHub REST API, JSON Schema, HTML, CSS, JavaScript, Vitest, Wrangler.

## Verified production run

- Date: July 15, 2026
- Sample: https://github.com/openai/openai-node/pull/1990
- Model: `gpt-5.6-sol`
- Result: structured report returned successfully with a real `resp_...` OpenAI response ID
- Responsive checks: desktop report, 390 x 844 empty state, report overview, impact map, and findings table
- Automated checks: 8 tests, TypeScript, browser JavaScript syntax, and Wrangler deployment dry run

## Required public artifacts

- Live Cloudflare Worker URL
- Public GitHub repository
- Public demo video under three minutes with audio
- Codex `/feedback` Session ID
- Devpost project page

Codex `/feedback` Session ID: `019f54a5-a7bf-7a82-a4f5-7c25cb5883f2`

## Demo sequence

1. Paste a public pull-request URL.
2. Show the bounded evidence ledger and changed-file counts.
3. Run analysis and identify the GPT-5.6 response ID.
4. Walk through the verdict, cited findings, test plan, release steps, rollback, and unknowns.
5. Export the JSON report.
6. Briefly show the architecture and explain how Codex was used to build and validate the project.

The timed narration is in [demo-script.md](demo-script.md).

## Claims that require live verification

- [x] The deployed Worker can complete a real GPT-5.6 analysis.
- [x] The public repository and live URL are reachable without authentication.
- [x] The final video URL is public and includes narration.

Do not mark these complete until each public artifact has been opened in a signed-out browser session.
