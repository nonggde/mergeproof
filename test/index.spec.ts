import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectPullRequestEvidence, parseGitHubPullUrl } from '../src/github';
import worker from '../src/index';

const env = {
	ASSETS: {
		fetch: async () => new Response('<!doctype html><title>MergeProof</title>'),
	},
	OPENAI_MODEL: 'gpt-5.6-sol',
	OPENAI_API_BASE: 'https://api.openai.com/v1',
	GITHUB_API_BASE: 'https://api.github.com',
	OPENAI_API_KEY: 'local-placeholder',
	GITHUB_TOKEN: '',
} as unknown as Env;

function dispatch(path: string, init?: RequestInit): Promise<Response> {
	const request = new Request(`https://example.com${path}`, init) as unknown as Parameters<typeof worker.fetch>[0];
	return worker.fetch(request, env);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GitHub pull request URL parsing', () => {
	it('accepts a canonical public pull request URL', () => {
		expect(parseGitHubPullUrl('https://github.com/openai/openai-node/pull/123')).toEqual({
			owner: 'openai',
			repo: 'openai-node',
			number: 123,
		});
	});

	it('rejects non-GitHub and ambiguous URLs', () => {
		expect(() => parseGitHubPullUrl('https://example.com/openai/openai-node/pull/123')).toThrow(
			/Only public github.com/,
		);
		expect(() => parseGitHubPullUrl('https://github.com/openai/openai-node/issues/123')).toThrow(
			/Use the format/,
		);
	});
});

describe('GitHub evidence collection', () => {
	it('marks evidence as truncated when an individual patch exceeds its cap', async () => {
		vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.endsWith('/files?per_page=40')) {
				return Response.json([{
					filename: 'src/large.ts',
					status: 'modified',
					additions: 4_001,
					deletions: 0,
					changes: 4_001,
					patch: 'x'.repeat(4_001),
				}]);
			}
			return Response.json({
				html_url: 'https://github.com/openai/openai-node/pull/123',
				title: 'Large patch',
				user: { login: 'builder' },
				base: { ref: 'main' },
				head: { ref: 'feature' },
				additions: 4_001,
				deletions: 0,
				changed_files: 1,
			});
		}));

		const evidence = await collectPullRequestEvidence(
			{ owner: 'openai', repo: 'openai-node', number: 123 },
			'https://api.github.test',
		);

		expect(evidence.files[0].patch).toHaveLength(4_000);
		expect(evidence.truncated).toBe(true);
	});
});

describe('Worker routes', () => {
	it('reports the configured GPT-5.6 model', async () => {
		const response = await dispatch('/api/health');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok', model: env.OPENAI_MODEL });
	});

	it('requires a configured OpenAI key before analysis', async () => {
		const response = await dispatch('/api/analyze', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prUrl: 'https://github.com/openai/openai-node/pull/123' }),
		});
		expect(response.status).toBe(503);
		const payload = (await response.json()) as { error: string };
		expect(payload.error).toMatch(/OpenAI is not configured/);
	});

	it('serves the analysis workspace at the root', async () => {
		const response = await dispatch('/');
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('MergeProof');
	});

	it('rejects oversized request bodies before external calls', async () => {
		const response = await dispatch('/api/analyze', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prUrl: `https://github.com/a/b/pull/1?${'x'.repeat(8_200)}` }),
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Request body is too large.' });
	});

	it('rejects malformed JSON as a client error', async () => {
		const response = await dispatch('/api/analyze', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"prUrl":',
		});
		expect(response.status).toBe(400);
	});
});
