# Harness Engineering Skills

Public skill repository for Harness Engineering workflows.

This repository is the public home for Harness skill packages.

It currently publishes a single installable skill:

- `harness-engineering-orchestrator`: an orchestration skill for running software projects through a repo-backed lifecycle from discovery to validated completion.

Harness Engineering focuses on making agent-assisted development stateful and resumable. Instead of keeping plans in chat history, key project decisions are written to versioned repository files (`AGENTS.md`, `CLAUDE.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, `.harness/state.json`, etc.) so work can continue across sessions and agents without context loss.

The repository is intentionally shaped to support multiple domain skill packages over time. `harness-engineering-orchestrator` is the first published package, and future packages can sit beside it under the same root.

## What this repository contains

- `README.md`: this entry page and high-level usage guide.
- `README.en.md`: English documentation.
- `README.zh-CN.md`: Chinese documentation.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`: repository-level open source metadata and contribution policy.
- `harness-engineering-orchestrator/`: the published skill package.
  - `SKILL.md`: the runtime contract the skill executes.
  - `agents/`: role prompts and operating guides.
  - `references/`: templates and helper docs.
  - `scripts/`: optional automation helpers.
  - `templates/`: scaffold files and example structure.

## Language

- English: [README.en.md](README.en.md)
- Chinese: [README.zh-CN.md](README.zh-CN.md)

## Install

### Prerequisites

- `git`
- `bun`
- a client that supports `skills add`

### Install the skill package

```bash
npx skills add https://github.com/Phlegonlabs/Harness-skills --skill harness-engineering-orchestrator
```

### Use it in a target repository

For a new repository:

```bash
bun <path-to-installed-skill>/scripts/harness-setup.ts
```

For an existing repository:

```bash
bun <path-to-installed-skill>/scripts/harness-setup.ts --isGreenfield=false --skipGithub=true
```

After setup or hydration, continue from inside the target repository with:

```bash
bun .harness/orchestrator.ts
bun harness:advance
```

For the full skill-level operator flow, see [harness-engineering-orchestrator/README.md](./harness-engineering-orchestrator/README.md).

## When to use this skill

Use the orchestrator when you want AI assistants to operate through a structured, file-backed project loop rather than ad-hoc prompts.

- New project launches (greenfield): idea → discovery → stack selection → PRD → architecture → scaffold → execution → validation.
- Existing projects: bring legacy or partially structured repos into a consistent Harness workflow.
- Team handoff: make task state inspectable by agents and humans from the repository alone.

Typical prompts:

- `Bootstrap a new TypeScript monorepo with Harness Engineering.`
- `Turn this existing repo into a repo-backed workflow with PRD, architecture, and progress tracking.`
- `Set up Harness validation gates and execution loop for this codebase.`

## What it can generate

- `docs/PRD.md`: requirements, scope, milestones, acceptance criteria.
- `docs/ARCHITECTURE.md`: system structure, data flow, constraints, and decisions.
- `docs/PROGRESS.md`: milestone/task progress and completion state.
- `.harness/state.json`: canonical runtime state for orchestration.
- `AGENTS.md` + `CLAUDE.md`: machine-readable and human-readable collaboration contracts.
- `docs/adr/`, `docs/gitbook/`: supporting documentation structures used during execution.
- Validation and scaffold artifacts for repeatable build/test checks.

## Workflow in brief

```text
DISCOVERY -> MARKET_RESEARCH -> TECH_STACK -> PRD_ARCH -> SCAFFOLD -> EXECUTING -> VALIDATING -> COMPLETE
```

The key principle is that planning is not "done" until repo artifacts are updated, and execution is not "done" until code, validation, and task state are aligned.

### Pacing discipline

The orchestrator enforces strict step-by-step execution:

- **One question per response** during Discovery — each question is its own turn, waiting for the user's answer before continuing.
- **One phase per response** — work from two phases is never combined in a single message.
- **Mandatory checkpoints** at every phase boundary — the orchestrator summarizes, validates, and asks for confirmation before advancing.
- **Granular scaffold verification** — every `.harness/` runtime file, config, doc, and build script is individually checked before entering EXECUTING.

This prevents the common failure mode where the LLM rushes through phases, skips validation, or enters execution with an incomplete scaffold.

## Quick verification after install

After installing the skill in a target repo, verify these files exist or are created:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/PROGRESS.md`
- `.harness/state.json`

If these are present and readable, your repo is likely on the right track for the Harness loop.

## Contributing

This repo is intentionally small and focused. If you use the orchestrator in new ways, you can contribute by adding missing reference templates, strengthening gates, or improving execution playbooks. PRs and issue-based suggestions are welcome.

## References

- [Chinese documentation](./README.zh-CN.md)
- [English documentation](./README.en.md)
- [License](./LICENSE)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Skill contract](./harness-engineering-orchestrator/SKILL.md)
