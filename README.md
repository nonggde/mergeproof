# MergeProof

MergeProof turns a public GitHub pull request into an evidence-backed release brief. It collects bounded PR metadata and patch evidence, then asks GPT-5.6 (`gpt-5.6-sol`) for a structured verdict, affected surfaces, cited findings, targeted tests, release steps, rollback checks, and explicit unknowns.

**Live app:** [mergeproof.a13553776411.workers.dev](https://mergeproof.a13553776411.workers.dev)

The product is deliberately narrower than a general code reviewer: every claim must point back to a supplied changed-file path, and missing context is reported as an unknown instead of being invented.

## What it does

- Accepts canonical public `github.com/{owner}/{repo}/pull/{number}` URLs.
- Reads PR metadata and up to 40 changed-file patches through the GitHub API.
- Limits each patch to 4,000 characters and total patch evidence to 48,000 characters.
- Uses an OpenAI-compatible Responses API with GPT-5.6 medium reasoning and strict JSON Schema output.
- Presents a release verdict, risk score, impact map, findings, test plan, deployment steps, rollback steps, and unknowns.
- Exports the complete evidence and analysis as JSON.

## Architecture

MergeProof is a single Cloudflare Worker with static assets. The browser sends only a PR URL. The Worker validates it, fetches bounded public evidence from GitHub, calls the OpenAI Responses API, validates the structured result, and returns one report payload.

See [docs/architecture.md](docs/architecture.md) for the request flow and trust boundaries.

## Built with Codex and GPT-5.6

Codex was used throughout the project to turn the initial release-risk concept into a narrow, testable product: defining the evidence contract, implementing bounded GitHub ingestion, pressure-testing trust boundaries, generating the strict response schema, building the responsive evidence workspace, and running the final test and deployment checks.

GPT-5.6 is the runtime decision engine. MergeProof calls the Responses API with medium reasoning and strict JSON Schema output. The model receives untrusted PR content only as user input, must cite supplied file paths for every finding, and must move unsupported assumptions into an explicit `unknowns` list.

The live flow has been verified against a public `openai/openai-node` pull request. It returned a real OpenAI response ID and a complete evidence-cited release report on desktop and mobile.

## Local development

Requirements: Node.js 20 or newer and an OpenAI API key with access to `gpt-5.6`.

```bash
npm install
cp .dev.vars.example .dev.vars
# Add OPENAI_API_KEY to .dev.vars
npm run cf-typegen
npm test
npm run check
npm run dev
```

Then open `http://localhost:8787`.

An optional `GITHUB_TOKEN` raises GitHub API rate limits. Never commit `.dev.vars`; it is ignored by Git.

For an OpenAI-compatible gateway, set `OPENAI_GATEWAY_BASE` in `.dev.vars` to its `/v1` base URL. The committed deployment configuration defaults to the official OpenAI API.

## Deploy

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GITHUB_TOKEN  # optional
npm run deploy
```

## Evidence and security boundaries

- Only HTTPS URLs on `github.com` matching the canonical pull-request path are accepted.
- Repository names are encoded before GitHub API calls; callers cannot choose an arbitrary upstream host.
- Incoming bodies and upstream JSON responses have explicit byte limits.
- API responses are not cached, and static responses receive a restrictive Content Security Policy.
- The OpenAI key remains a server-side Worker secret.
- MergeProof does not clone repositories, execute code, or claim access to CI logs and runtime behavior.
- Large PRs can be truncated. The report exposes that fact and should not be treated as a security guarantee.

## Validation

```bash
npm test       # URL validation and Worker route tests
npm run check # TypeScript, browser JavaScript syntax, and Wrangler dry-run build
```

The production Worker is also checked with a real GPT-5.6 request before release. See [docs/submission.md](docs/submission.md) for the verified submission artifacts and demo plan.

## License

Apache-2.0. See [LICENSE](LICENSE).
