const SAMPLE_PR = 'https://github.com/openai/openai-node/pull/1990';

const elements = {
	form: document.querySelector('#analysis-form'),
	input: document.querySelector('#pr-url'),
	analyzeButton: document.querySelector('#analyze-button'),
	sampleButton: document.querySelector('#sample-button'),
	error: document.querySelector('#error-message'),
	empty: document.querySelector('#empty-analysis'),
	loading: document.querySelector('#loading-analysis'),
	report: document.querySelector('#report'),
	analysisTitle: document.querySelector('#analysis-title'),
	evidenceCount: document.querySelector('#evidence-count'),
	scopeGrid: document.querySelector('#scope-grid'),
	fileLedger: document.querySelector('#file-ledger'),
	riskScore: document.querySelector('#risk-score'),
	verdictLabel: document.querySelector('#verdict-label'),
	verdictSummary: document.querySelector('#verdict-summary'),
	confidence: document.querySelector('#confidence-value'),
	model: document.querySelector('#model-value'),
	impactList: document.querySelector('#impact-list'),
	findingList: document.querySelector('#finding-list'),
	testList: document.querySelector('#test-list'),
	releaseList: document.querySelector('#release-list'),
	unknowns: document.querySelector('#unknowns'),
	findingTotal: document.querySelector('#finding-total'),
	testTotal: document.querySelector('#test-total'),
	releaseTotal: document.querySelector('#release-total'),
	copyButton: document.querySelector('#copy-button'),
	downloadButton: document.querySelector('#download-button'),
	requestId: document.querySelector('#request-id'),
};

let currentReport = null;

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function pathTags(paths = []) {
	return `<div class="path-list">${paths.map((path) => `<code title="${escapeHtml(path)}">${escapeHtml(path)}</code>`).join('')}</div>`;
}

function setView(view) {
	elements.empty.hidden = view !== 'empty';
	elements.loading.hidden = view !== 'loading';
	elements.report.hidden = view !== 'report';
}

function showError(message) {
	elements.error.textContent = message;
	elements.error.hidden = false;
}

function clearError() {
	elements.error.hidden = true;
	elements.error.textContent = '';
}

function renderEvidence(evidence) {
	elements.evidenceCount.textContent = `${evidence.files.length}${evidence.truncated ? '+' : ''} files`;
	elements.scopeGrid.innerHTML = `
		<div><span>Base</span><strong title="${escapeHtml(evidence.baseRef)}">${escapeHtml(evidence.baseRef)}</strong></div>
		<div><span>Head</span><strong title="${escapeHtml(evidence.headRef)}">${escapeHtml(evidence.headRef)}</strong></div>
		<div><span>Add</span><strong class="plus">+${evidence.additions}</strong></div>
		<div><span>Delete</span><strong class="minus">-${evidence.deletions}</strong></div>`;
	elements.fileLedger.innerHTML = evidence.files.map((file) => `
		<div class="file-row">
			<code title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</code>
			<div class="file-meta"><span>${escapeHtml(file.status)}</span><span class="plus">+${file.additions}</span><span class="minus">-${file.deletions}</span></div>
		</div>`).join('');
}

function renderReport(payload) {
	currentReport = payload;
	const { analysis, evidence } = payload;
	elements.analysisTitle.textContent = evidence.title;
	elements.riskScore.textContent = analysis.overall.riskScore;
	elements.verdictLabel.textContent = analysis.overall.verdict.replaceAll('-', ' ');
	elements.verdictSummary.textContent = analysis.overall.summary;
	elements.confidence.textContent = analysis.overall.confidence;
	elements.model.textContent = `${payload.model} / ${payload.modelResponseId}`;
	elements.requestId.textContent = `Request ${payload.requestId.slice(0, 8)}`;

	elements.impactList.innerHTML = analysis.impact.map((item) => `
		<div class="impact-item">
			<strong>${escapeHtml(item.surface)}</strong>
			<p>${escapeHtml(item.why)}</p>
			${pathTags(item.evidencePaths)}
		</div>`).join('') || '<div class="empty-rail-state">No affected surface was established.</div>';

	elements.findingList.innerHTML = analysis.findings.map((finding) => `
		<div class="finding-row">
			<div><span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span></div>
			<div><strong>${escapeHtml(finding.title)}</strong>${pathTags(finding.paths)}</div>
			<div><p>${escapeHtml(finding.evidence)}</p></div>
			<div><p class="action-copy">${escapeHtml(finding.action)}</p></div>
		</div>`).join('') || '<div class="empty-rail-state">No release findings were produced.</div>';

	elements.testList.innerHTML = analysis.testPlan.map((test) => `
		<div class="test-row">
			<div><span class="priority">${escapeHtml(test.priority)}</span></div>
			<div><strong>${escapeHtml(test.check)}</strong></div>
			<div><p>${escapeHtml(test.reason)}</p></div>
			<div><p class="action-copy">${escapeHtml(test.target)}</p></div>
		</div>`).join('') || '<div class="empty-rail-state">No targeted checks were produced.</div>';

	elements.releaseList.innerHTML = analysis.releaseSteps.map((step) => `
		<div class="release-item">
			<span class="release-phase">${escapeHtml(step.phase)}</span>
			<strong>${escapeHtml(step.step)}</strong>
			<p>Evidence: ${escapeHtml(step.evidenceRequired)}</p>
		</div>`).join('');

	elements.unknowns.innerHTML = analysis.unknowns.length ? `
		<strong>Unknowns to resolve</strong>
		<ul>${analysis.unknowns.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
	elements.unknowns.hidden = analysis.unknowns.length === 0;
	elements.findingTotal.textContent = analysis.findings.length;
	elements.testTotal.textContent = analysis.testPlan.length;
	elements.releaseTotal.textContent = analysis.releaseSteps.length;
	elements.copyButton.disabled = false;
	elements.downloadButton.disabled = false;
	renderEvidence(evidence);
	setView('report');
}

async function analyze(prUrl) {
	clearError();
	elements.analyzeButton.disabled = true;
	elements.analyzeButton.textContent = 'Analyzing...';
	elements.analysisTitle.textContent = 'Building release evidence';
	setView('loading');

	try {
		const response = await fetch('/api/analyze', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prUrl }),
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error || 'Analysis failed.');
		renderReport(payload);
	} catch (error) {
		showError(error instanceof Error ? error.message : 'Analysis failed.');
		elements.analysisTitle.textContent = 'Analysis unavailable';
		setView('empty');
	} finally {
		elements.analyzeButton.disabled = false;
		elements.analyzeButton.innerHTML = 'Analyze PR <span aria-hidden="true">?</span>';
	}
}

elements.form.addEventListener('submit', (event) => {
	event.preventDefault();
	analyze(elements.input.value.trim());
});

elements.sampleButton.addEventListener('click', () => {
	elements.input.value = SAMPLE_PR;
	elements.input.focus();
});

document.querySelectorAll('.report-tab').forEach((button) => {
	button.addEventListener('click', () => {
		document.querySelectorAll('.report-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
		document.querySelectorAll('.report-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
	});
});

elements.copyButton.addEventListener('click', async () => {
	if (!currentReport) return;
	await navigator.clipboard.writeText(JSON.stringify(currentReport, null, 2));
	elements.copyButton.textContent = 'OK';
	setTimeout(() => { elements.copyButton.textContent = '?'; }, 1200);
});

elements.downloadButton.addEventListener('click', () => {
	if (!currentReport) return;
	const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `mergeproof-${currentReport.requestId.slice(0, 8)}.json`;
	link.click();
	URL.revokeObjectURL(link.href);
});
