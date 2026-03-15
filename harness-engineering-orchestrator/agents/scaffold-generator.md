# Scaffold Generator Agent

## Role

Complete the repo bootstrap and Harness Engineering and Orchestrator scaffold closeout required to enter `EXECUTING`, based on the confirmed PRD and Architecture documents.

## Inputs

- `.harness/state.json`
- `docs/PRD.md` + `docs/prd/`
- `docs/ARCHITECTURE.md` + `docs/architecture/`
- `README.md`
- `AGENTS.md` / `CLAUDE.md`

## Tasks

Complete each group in order. Verify each item exists before moving on.

### Group 1: Harness Runtime
- [ ] `.harness/state.json`
- [ ] `.harness/orchestrator.ts`
- [ ] `.harness/advance.ts`
- [ ] `.harness/compact.ts`
- [ ] `.harness/init.ts`
- [ ] `.harness/validate.ts`

### Group 2: Agent Specs and Config
- [ ] `AGENTS.md` exists and matches `CLAUDE.md` exactly (G8)
- [ ] `CLAUDE.md` exists
- [ ] `.env.example` exists
- [ ] `biome.json` exists
- [ ] `tsconfig.json` exists

### Group 3: Documentation Baseline
- [ ] `docs/PRD.md` or `docs/prd/` exists
- [ ] `docs/ARCHITECTURE.md` or `docs/architecture/` exists
- [ ] `docs/PROGRESS.md` or `docs/progress/` exists
- [ ] `docs/gitbook/SUMMARY.md` exists
- [ ] `docs/adr/` exists

### Group 4: Build Infrastructure
- [ ] `package.json` has `harness:advance`, `harness:validate`, `harness:compact` scripts
- [ ] `package.json` has `typecheck`, `format:check`, `build` scripts
- [ ] CI/CD pipeline files exist (`.github/workflows/`)
- [ ] PR template exists (`.github/pull_request_template.md`)
- [ ] Workspace structure matches Architecture doc

### Group 5: Verification
- [ ] `bun install` succeeds
- [ ] `bun run typecheck` passes
- [ ] `bun run build` passes
- [ ] `bun harness:validate --phase EXECUTING` passes

Do NOT bootstrap product frameworks (Next.js, Tauri, Expo) during scaffold. Only prepare the Harness program, orchestration runtime, monorepo shape, and milestone/task flow.

## Phase Completion

After all groups are verified:

1. Present the **Scaffold Verification Checklist** with pass/fail for each item
2. Show the `bun harness:validate --phase EXECUTING` result
3. Ask: "Scaffold is complete. Ready to enter EXECUTING?"
4. STOP. Wait for user confirmation before running `bun harness:advance`.

## Outputs

- a complete Harness Engineering and Orchestrator scaffold
- a parseable milestone / task backlog
- the minimum repo structure required for `EXECUTING`

## Done When

- `bun harness:advance` succeeds
- `bun harness:validate --phase EXECUTING` passes
- rerunning `bun .harness/orchestrator.ts` dispatches the next runtime agent
