import type { ChangedFile, GitHubCoordinates, PullRequestEvidence } from './types';

const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_FILES = 40;
const MAX_PATCH_CHARS = 4_000;
const MAX_TOTAL_PATCH_CHARS = 48_000;

interface GitHubPullResponse {
	html_url: string;
	title: string;
	user: { login: string };
	base: { ref: string };
	head: { ref: string };
	additions: number;
	deletions: number;
	changed_files: number;
}

interface GitHubFileResponse {
	filename: string;
	status: string;
	additions: number;
	deletions: number;
	changes: number;
	patch?: string;
}

export function parseGitHubPullUrl(value: string): GitHubCoordinates {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		throw new Error('Enter a valid GitHub pull request URL.');
	}

	if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') {
		throw new Error('Only public github.com pull request URLs are supported.');
	}

	const parts = url.pathname.split('/').filter(Boolean);
	if (parts.length !== 4 || parts[2] !== 'pull' || !/^\d+$/.test(parts[3])) {
		throw new Error('Use the format https://github.com/owner/repo/pull/123.');
	}

	const number = Number(parts[3]);
	if (!Number.isSafeInteger(number) || number < 1) {
		throw new Error('The pull request number is invalid.');
	}

	return { owner: parts[0], repo: parts[1], number };
}

async function readBoundedJson<T>(response: Response): Promise<T> {
	const declaredLength = Number(response.headers.get('content-length') || 0);
	if (declaredLength > MAX_RESPONSE_BYTES) {
		throw new Error('GitHub returned more data than MergeProof can safely inspect.');
	}

	if (!response.body) throw new Error('GitHub returned an empty response.');

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_RESPONSE_BYTES) {
			await reader.cancel();
			throw new Error('GitHub returned more data than MergeProof can safely inspect.');
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function githubFetch<T>(url: string, token?: string): Promise<T> {
	const headers = new Headers({
		Accept: 'application/vnd.github+json',
		'User-Agent': 'MergeProof/0.1',
		'X-GitHub-Api-Version': '2022-11-28',
	});
	if (token) headers.set('Authorization', `Bearer ${token}`);

	const response = await fetch(url, { headers });
	if (!response.ok) {
		if (response.status === 404) throw new Error('That public pull request was not found.');
		if (response.status === 403 || response.status === 429) {
			throw new Error('GitHub rate limit reached. Try again shortly.');
		}
		throw new Error(`GitHub request failed with status ${response.status}.`);
	}

	return readBoundedJson<T>(response);
}

export async function collectPullRequestEvidence(
	coordinates: GitHubCoordinates,
	apiBase: string,
	token?: string,
): Promise<PullRequestEvidence> {
	const root = apiBase.replace(/\/$/, '');
	const owner = encodeURIComponent(coordinates.owner);
	const repo = encodeURIComponent(coordinates.repo);
	const pullPath = `${root}/repos/${owner}/${repo}/pulls/${coordinates.number}`;

	const [pull, rawFiles] = await Promise.all([
		githubFetch<GitHubPullResponse>(pullPath, token),
		githubFetch<GitHubFileResponse[]>(`${pullPath}/files?per_page=${MAX_FILES}`, token),
	]);

	let patchBudget = MAX_TOTAL_PATCH_CHARS;
	const files: ChangedFile[] = rawFiles.slice(0, MAX_FILES).map((file) => {
		const rawPatch = file.patch || '(binary file or patch unavailable)';
		const patch = rawPatch.slice(0, Math.min(MAX_PATCH_CHARS, patchBudget));
		patchBudget = Math.max(0, patchBudget - patch.length);
		return {
			path: file.filename,
			status: file.status,
			additions: file.additions,
			deletions: file.deletions,
			changes: file.changes,
			patch: patch || '(patch omitted after evidence budget was reached)',
		};
	});

	return {
		sourceUrl: pull.html_url,
		title: pull.title,
		author: pull.user.login,
		baseRef: pull.base.ref,
		headRef: pull.head.ref,
		additions: pull.additions,
		deletions: pull.deletions,
		changedFiles: pull.changed_files,
		files,
		truncated: pull.changed_files > files.length || patchBudget === 0,
	};
}
