# MergeProof demo script

Target duration: 2 minutes 20 seconds.

## 0:00-0:18 - The release gap

"A pull-request review can tell you whether code looks reasonable. It does not automatically tell a release owner what changed, which tests matter, what is still unknown, or how to roll back. MergeProof turns the patch itself into an evidence-backed release decision."

Show the empty workspace and the public GitHub PR input.

## 0:18-0:38 - Bounded evidence

"I will load a real public pull request from the OpenAI Node SDK. MergeProof accepts only canonical GitHub PR URLs. The Worker collects metadata and bounded patches, never clones or executes repository code, and reports when evidence has been truncated."

Load the sample and start analysis. Point to the three processing stages.

## 0:38-1:12 - GPT-5.6 decision

"The evidence is sent to GPT-5.6 through the Responses API with medium reasoning and strict JSON Schema output. The result is not a free-form review. It is a release contract: verdict, risk score, confidence, affected surfaces, findings, tests, rollout steps, rollback steps, and unknowns. This response ID confirms the live model call."

Show the verdict band, model response ID, and impact map.

## 1:12-1:48 - Cited findings and tests

"Every finding must cite a file path from the supplied evidence. Unsupported assumptions are not allowed to become findings; they move into unknowns. Here the model identifies missing regression coverage, then turns that exact evidence into prioritized checks a developer can run before release."

Open Findings, Test plan, and Release. Show path chips and the unknowns section.

## 1:48-2:05 - Export and architecture

"The complete report can be copied or exported as JSON for a release ticket or deployment workflow. API keys stay in the Worker, GitHub content is treated as untrusted input, and all upstream reads have explicit byte limits."

Download the report, then briefly show the architecture diagram in the repository.

## 2:05-2:20 - Codex and close

"Codex helped turn the initial idea into this tested product: defining the evidence contract, implementing the Worker, pressure-testing security boundaries, building the responsive interface, and validating the production deployment. MergeProof makes the release decision inspectable, not just intelligent."

End on the live report and repository link.
