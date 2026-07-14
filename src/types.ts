export interface GitHubCoordinates {
	owner: string;
	repo: string;
	number: number;
}

export interface ChangedFile {
	path: string;
	status: string;
	additions: number;
	deletions: number;
	changes: number;
	patch: string;
}

export interface PullRequestEvidence {
	sourceUrl: string;
	title: string;
	author: string;
	baseRef: string;
	headRef: string;
	additions: number;
	deletions: number;
	changedFiles: number;
	files: ChangedFile[];
	truncated: boolean;
}

export type Severity = 'blocker' | 'high' | 'medium' | 'low';
export type Verdict = 'hold' | 'ship-with-guards' | 'ready';

export interface MergeProofAnalysis {
	overall: {
		verdict: Verdict;
		riskScore: number;
		confidence: 'high' | 'medium' | 'low';
		summary: string;
	};
	impact: Array<{
		surface: string;
		why: string;
		evidencePaths: string[];
	}>;
	findings: Array<{
		severity: Severity;
		title: string;
		evidence: string;
		paths: string[];
		action: string;
	}>;
	testPlan: Array<{
		priority: 'P0' | 'P1' | 'P2';
		check: string;
		reason: string;
		target: string;
	}>;
	releaseSteps: Array<{
		phase: 'pre-merge' | 'pre-deploy' | 'post-deploy' | 'rollback';
		step: string;
		evidenceRequired: string;
	}>;
	unknowns: string[];
}

export interface AnalysisResponse {
	requestId: string;
	model: string;
	modelResponseId: string;
	evidence: PullRequestEvidence;
	analysis: MergeProofAnalysis;
}
