import { describe, expect, it } from 'vitest';
import { parseGitHubPullUrl } from '../src/github';
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
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: 'Request body is too large.' });
	});
});
