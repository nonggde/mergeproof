import { collectPullRequestEvidence, parseGitHubPullUrl } from './github';
import { analyzeWithOpenAI } from './openai';
import type { AnalysisResponse } from './types';

const MAX_REQUEST_BYTES = 8_192;
type RuntimeEnv = Env & { OPENAI_GATEWAY_BASE?: string };

async function readRequestJson(request: Request): Promise<unknown> {
	const declaredLength = Number(request.headers.get('content-length') || 0);
	if (declaredLength > MAX_REQUEST_BYTES) throw new Error('Request body is too large.');

	if (!request.body) throw new Error('A JSON request body is required.');
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_REQUEST_BYTES) {
			await reader.cancel();
			throw new Error('Request body is too large.');
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes));
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}

function securityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set(
		'Content-Security-Policy',
		"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
	);
	headers.set('Referrer-Policy', 'no-referrer');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('X-Frame-Options', 'DENY');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		try {
			if (url.pathname === '/api/health' && request.method === 'GET') {
				return json({ status: 'ok', model: env.OPENAI_MODEL });
			}

			if (url.pathname === '/api/analyze' && request.method === 'POST') {
				const input = (await readRequestJson(request)) as { prUrl?: unknown };
				if (typeof input.prUrl !== 'string' || input.prUrl.length > 500) {
					return json({ error: 'A GitHub pull request URL is required.' }, 400);
				}

				if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'local-placeholder') {
					return json({ error: 'OpenAI is not configured for this deployment.' }, 503);
				}

				const coordinates = parseGitHubPullUrl(input.prUrl);
				const evidence = await collectPullRequestEvidence(
					coordinates,
					env.GITHUB_API_BASE,
					env.GITHUB_TOKEN || undefined,
				);
				const result = await analyzeWithOpenAI(
					evidence,
					env.OPENAI_API_KEY,
					env.OPENAI_MODEL,
					env.OPENAI_GATEWAY_BASE || env.OPENAI_API_BASE,
				);
				const payload: AnalysisResponse = {
					requestId: crypto.randomUUID(),
					model: env.OPENAI_MODEL,
					modelResponseId: result.responseId,
					evidence,
					analysis: result.analysis,
				};

				console.log(JSON.stringify({
					message: 'analysis_complete',
					requestId: payload.requestId,
					model: payload.model,
					files: evidence.files.length,
					verdict: payload.analysis.overall.verdict,
				}));
				return json(payload);
			}

			if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
			return securityHeaders(await env.ASSETS.fetch(request));
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unexpected error.';
			console.error(JSON.stringify({ message: 'request_failed', path: url.pathname, error: message }));
			const status = error instanceof SyntaxError || /valid|format|supported|required|not found|too large/i.test(message)
				? 400
				: 502;
			return json({ error: message }, status);
		}
	},
} satisfies ExportedHandler<RuntimeEnv>;
