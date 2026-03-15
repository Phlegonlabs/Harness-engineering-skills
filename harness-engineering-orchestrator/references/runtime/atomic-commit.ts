import type { Milestone, ProjectState, Task } from "../types"

type GitResult = {
  ok: boolean
  output: string
}

export type AtomicCommitInspection = {
  baseLabel?: string
  branch: string
  commitCount?: number
  commitHash: string
  commitMessage: string
  ok: boolean
  reasons: string[]
}

function runGit(args: string[]): GitResult {
  try {
    const proc = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" })
    const stdout = new TextDecoder().decode(proc.stdout).trim()
    const stderr = new TextDecoder().decode(proc.stderr).trim()
    return { ok: proc.exitCode === 0, output: proc.exitCode === 0 ? stdout : stderr }
  } catch (error) {
    return { ok: false, output: String(error) }
  }
}

function getTaskLocation(
  state: ProjectState,
  taskId: string,
): { milestone: Milestone; milestoneIndex: number; task: Task; taskIndex: number } | null {
  for (const [milestoneIndex, milestone] of state.execution.milestones.entries()) {
    const taskIndex = milestone.tasks.findIndex(candidate => candidate.id === taskId)
    if (taskIndex !== -1) {
      return { milestone, milestoneIndex, task: milestone.tasks[taskIndex]!, taskIndex }
    }
  }

  return null
}

function getPreviousCommittedTask(milestone: Milestone, taskIndex: number): Task | undefined {
  return milestone.tasks
    .slice(0, taskIndex)
    .reverse()
    .find(task => task.status === "DONE" && Boolean(task.commitHash))
}

function resolveProtectedBaseBranch(): string | undefined {
  for (const branch of ["main", "master"]) {
    if (runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).ok) {
      return branch
    }
  }

  return undefined
}

export function inspectAtomicTaskCommit(
  state: ProjectState,
  taskId: string,
  commitHash: string,
): AtomicCommitInspection {
  const inspection: AtomicCommitInspection = {
    branch: "",
    commitHash: commitHash.trim(),
    commitMessage: "",
    ok: false,
    reasons: [],
  }

  const location = getTaskLocation(state, taskId)
  if (!location) {
    inspection.reasons.push(`Task ${taskId} was not found in state.`)
    return inspection
  }

  if (!inspection.commitHash) {
    inspection.reasons.push("Commit hash is required.")
    return inspection
  }

  const resolvedCommit = runGit(["rev-parse", "--verify", `${inspection.commitHash}^{commit}`])
  if (!resolvedCommit.ok) {
    inspection.reasons.push(`Commit ${inspection.commitHash} does not exist.`)
    return inspection
  }
  inspection.commitHash = resolvedCommit.output

  const branch = runGit(["branch", "--show-current"])
  if (!branch.ok || !branch.output) {
    inspection.reasons.push("Current git branch could not be determined.")
  } else {
    inspection.branch = branch.output
    if (inspection.branch === "main" || inspection.branch === "master") {
      inspection.reasons.push("Feature task commits must not be created on main/master.")
    }
  }

  const workingTree = runGit(["status", "--porcelain"])
  if (!workingTree.ok) {
    inspection.reasons.push("Working tree status could not be determined.")
  } else if (workingTree.output.trim().length > 0) {
    inspection.reasons.push("Working tree must be clean before marking a task DONE.")
  }

  const head = runGit(["rev-parse", "HEAD"])
  if (!head.ok) {
    inspection.reasons.push("HEAD commit could not be determined.")
  } else if (head.output !== inspection.commitHash) {
    inspection.reasons.push("The task commit must be the current HEAD commit.")
  }

  const commitMessage = runGit(["log", "-1", "--pretty=%B", inspection.commitHash])
  if (!commitMessage.ok) {
    inspection.reasons.push(`Commit message for ${inspection.commitHash} could not be read.`)
  } else {
    inspection.commitMessage = commitMessage.output
    if (!inspection.commitMessage.includes(location.task.id)) {
      inspection.reasons.push(`Commit message must include the current Task-ID (${location.task.id}).`)
    }
    if (!inspection.commitMessage.includes(location.task.prdRef)) {
      inspection.reasons.push(`Commit message must include the current PRD mapping (${location.task.prdRef}).`)
    }
  }

  const previousTask = getPreviousCommittedTask(location.milestone, location.taskIndex)
  if (previousTask?.commitHash) {
    inspection.baseLabel = previousTask.id
    const rangeCount = runGit(["rev-list", "--count", `${previousTask.commitHash}..${inspection.commitHash}`])
    if (!rangeCount.ok) {
      inspection.reasons.push(`Commit range from ${previousTask.id} could not be evaluated.`)
    } else {
      inspection.commitCount = Number.parseInt(rangeCount.output, 10)
      if (inspection.commitCount !== 1) {
        inspection.reasons.push(
          `Task ${location.task.id} must add exactly 1 commit after ${previousTask.id}; found ${inspection.commitCount}.`,
        )
      }
    }
  } else {
    const baseBranch = resolveProtectedBaseBranch()
    if (!baseBranch) {
      inspection.reasons.push("No main/master branch was found to compute atomic task range.")
    } else {
      inspection.baseLabel = baseBranch
      const mergeBase = runGit(["merge-base", inspection.commitHash, baseBranch])
      if (!mergeBase.ok || !mergeBase.output) {
        inspection.reasons.push(`Merge base against ${baseBranch} could not be determined.`)
      } else {
        const rangeCount = runGit(["rev-list", "--count", `${mergeBase.output}..${inspection.commitHash}`])
        if (!rangeCount.ok) {
          inspection.reasons.push(`Commit range from ${baseBranch} could not be evaluated.`)
        } else {
          inspection.commitCount = Number.parseInt(rangeCount.output, 10)
          if (inspection.commitCount !== 1) {
            inspection.reasons.push(
              `First task commit in milestone ${location.milestone.id} must be exactly 1 commit ahead of ${baseBranch}; found ${inspection.commitCount}.`,
            )
          }
        }
      }
    }
  }

  inspection.ok = inspection.reasons.length === 0
  return inspection
}

export function formatAtomicCommitFailure(taskId: string, inspection: AtomicCommitInspection): string {
  const lines = [`Task ${taskId} must be completed with one atomic commit:`]
  for (const reason of inspection.reasons) {
    lines.push(`- ${reason}`)
  }
  return lines.join("\n")
}
