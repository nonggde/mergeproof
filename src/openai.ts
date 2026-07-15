import type { MergeProofAnalysis, PullRequestEvidence } from './types';

const MAX_OPENAI_RESPONSE_BYTES = 1_000_000;
const OPENAI_TIMEOUT_MS = 120_000;

const analysisSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['overall', 'impact', 'findings', 'testPlan', 'releaseSteps', 'unknowns'],
	properties: {
		overall: {
			type: 'object',
			additionalProperties: false,
			required: ['verdict', 'riskScore', 'confidence', 'summary'],
			properties: {
				verdict: { type: 'string', enum: ['hold', 'ship-with-guards', 'ready'] },
				riskScore: { type: 'integer', minimum: 0, maximum: 100 },
				confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
				summary: { type: 'string' },
			},
		},
		impact: {
			type: 'array',
			maxItems: 6,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['surface', 'why', 'evidencePaths'],
				properties: {
					surface: { type: 'string' },
					why: { type: 'string' },
					evidencePaths: { type: 'array', items: { type: 'string' }, maxItems: 5 },
				},
			},
		},
		findings: {
			type: 'array',
			maxItems: 8,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['severity', 'title', 'evidence', 'paths', 'action'],
				properties: {
					severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
					title: { type: 'string' },
					evidence: { type: 'string' },
					paths: { type: 'array', items: { type: 'string' }, maxItems: 5 },
					action: { type: 'string' },
				},
			},
		},
		testPlan: {
			type: 'array',
			maxItems: 8,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['priority', 'check', 'reason', 'target'],
				properties: {
					priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
					check: { type: 'string' },
					reason: { type: 'string' },
					target: { type: 'string' },
				},
			},
		},
		releaseSteps: {
			type: 'array',
			maxItems: 8,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['phase', 'step', 'evidenceRequired'],
				properties: {
					phase: { type: 'string', enum: ['pre-merge', 'pre-deploy', 'post-deploy', 'rollback'] },
					step: { type: 'string' },
					evidenceRequired: { type: 'string' },
				},
			},
		},
		unknowns: { type: 'array', items: { type: 'string' }, maxItems: 5 },
	},
} as const;

interface OpenAIResponsePayload {
	id?: string;
	output?: Array<{
		type?: string;
		content?: Array<{ type?: string; text?: string }>;
	}>;
	error?: { message?: string };
}

function extractOutputText(payload: OpenAIResponsePayload): string {
	for (const item of payload.output || []) {
		for (const content of item.content || []) {
			if (content.type === 'output_text' && content.text) return content.text;
		}
	}
	throw new Error('GPT-5.6 returned no structured analysis.');
}

async function readBoundedResponse(response: Response): Promise<OpenAIResponsePayload> {
	const declaredLength = Number(response.headers.get('content-length') || 0);
	if (declaredLength > MAX_OPENAI_RESPONSE_BYTES) {
		throw new Error('OpenAI returned an unexpectedly large response.');
	}
	if (!response.body) throw new Error('OpenAI returned an empty response.');

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_OPENAI_RESPONSE_BYTES) {
			await reader.cancel();
			throw new Error('OpenAI returned an unexpectedly large response.');
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes)) as OpenAIResponsePayload;
}

export async function analyzeWithOpenAI(
	evidence: PullRequestEvidence,
	apiKey: string,
	model: string,
	apiBase: string,
): Promise<{ responseId: string; analysis: MergeProofAnalysis }> {
	const responsesUrl = `${apiBase.replace(/\/$/, '')}/responses`;
	const response = await fetch(responsesUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
		body: JSON.stringify({
			model,
			reasoning: { effort: 'medium' },
			input: [
				{
					role: 'developer',
					content: [{
						type: 'input_text',
						text: [
							'You are a release-risk analyst reviewing a GitHub pull request.',
							'Use only the supplied PR metadata and patches as evidence.',
							'Do not invent runtime behavior, tests, dependencies, or files.',
							'Every finding must cite one or more supplied file paths.',
							'Unknown context belongs in unknowns, not in asserted findings.',
							'Prioritize checks that a developer can execute before release.',
						].join(' '),
					}],
				},
				{
					role: 'user',
					content: [{ type: 'input_text', text: JSON.stringify(evidence) }],
				},
			],
			text: {
				verbosity: 'medium',
				format: {
					type: 'json_schema',
					name: 'mergeproof_analysis',
					strict: true,
					schema: analysisSchema,
				},
			},
		}),
	});

	const payload = await readBoundedResponse(response);
	if (!response.ok) {
		if (response.status === 401 || response.status === 403) {
			throw new Error('OpenAI authentication failed for this deployment.');
		}
		if (response.status === 429) throw new Error('OpenAI rate limit reached. Try again shortly.');
		throw new Error(`OpenAI analysis failed with status ${response.status}.`);
	}

	const analysis = JSON.parse(extractOutputText(payload)) as MergeProofAnalysis;
	return { responseId: payload.id || 'unknown', analysis };
}
