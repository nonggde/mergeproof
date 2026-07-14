# Architecture

## Request flow

```text
Browser
  |  POST /api/analyze { prUrl }
  v
Cloudflare Worker
  |  validate canonical github.com PR URL
  |  apply request and response byte limits
  +----> GitHub REST API
  |        PR metadata + first 40 changed files
  |
  +----> OpenAI Responses API
  |        GPT-5.6 + strict JSON Schema
  v
Structured release report
  verdict | impact | findings | tests | release | rollback | unknowns
```

Static HTML, CSS, and JavaScript are served through the Worker's assets binding. There is no database and no user account system.

## Evidence contract

The model receives only:

- PR title, author, base/head refs, line counts, and changed-file count;
- up to 40 file paths and GitHub-provided patches;
- a truncation flag when the available evidence exceeds the configured budget.

The developer instruction requires path citations for findings and directs the model to put unsupported assumptions in `unknowns`. A strict JSON Schema fixes the response shape and enum values.

## Trust boundaries

GitHub content is untrusted input. It is serialized as user content, never inserted into the developer instruction, and never executed. Rendered report text is HTML-escaped in the browser.

API credentials are Worker secrets. The browser never receives them. Logs contain request IDs and aggregate counts, not API keys or raw patches.

## Limits

| Boundary | Limit |
| --- | ---: |
| Incoming request body | 8 KiB |
| GitHub response | 2 MB per request |
| Changed files | 40 |
| Patch per file | 4,000 characters |
| Total patch evidence | 48,000 characters |
| OpenAI response | 1 MB |
| OpenAI request timeout | 120 seconds |

MergeProof is decision support, not a substitute for executing tests, reviewing the full repository, or performing a security audit.
