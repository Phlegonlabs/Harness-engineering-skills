import { existsSync } from "fs"
import type { Milestone, ProjectState, ProjectType, Task } from "../types"
import { initState, readState, writeState } from "./state-core"
import { isUiProject, PRD_DIR, PRD_PATH, readDocument, STATE_PATH } from "./shared"
import { createEmptyTaskChecklist } from "./task-checklist"

type ParsedTaskSpec = {
  affectedFiles: string[]
  dod: string[]
  isUI: boolean
  milestoneId: string
  name: string
  prdRef: string
}

type ParsedMilestoneSpec = {
  branch: string
  id: string
  name: string
  tasks: ParsedTaskSpec[]
  worktreePath: string
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

function inferTaskFiles(isUI: boolean): string[] {
  return isUI
    ? ["src/app", "src/services", "src/types", "docs/design/DESIGN_SYSTEM.md", "tests"]
    : ["src/types", "src/config", "src/lib", "src/services", "tests"]
}

function inferUiTask(text: string, projectTypes: ProjectType[]): boolean {
  if (!isUiProject(projectTypes)) return false
  return /(ui|page|screen|layout|component|design|dashboard|form|login|settings|profile|navbar|modal|table)/i.test(
    text,
  )
}

function parsePrdBacklogSpecs(state: ProjectState): ParsedMilestoneSpec[] {
  const content = readDocument(PRD_PATH, PRD_DIR)
  if (!content) {
    throw new Error("docs/prd/ or docs/PRD.md not found. Generate PRD before running --from-prd.")
  }

  const lines = content.split(/\r?\n/)
  const milestones: ParsedMilestoneSpec[] = []
  let currentMilestone: ParsedMilestoneSpec | null = null
  let currentFeature:
    | {
        featureId: string
        name: string
        body: string[]
        dod: string[]
      }
    | null = null
  const flushFeature = () => {
    if (!currentMilestone || !currentFeature) return

    const taskText = [currentMilestone.name, currentFeature.name, ...currentFeature.body, ...currentFeature.dod].join(" ")
    const taskIsUi = inferUiTask(taskText, state.projectInfo.types)

    currentMilestone.tasks.push({
      name: currentFeature.name,
      prdRef: `PRD#F${currentFeature.featureId}`,
      milestoneId: currentMilestone.id,
      dod: currentFeature.dod.length > 0 ? currentFeature.dod : ["Meet PRD acceptance criteria"],
      isUI: taskIsUi,
      affectedFiles: inferTaskFiles(taskIsUi),
    })

    currentFeature = null
  }

  const flushMilestone = () => {
    flushFeature()
    if (!currentMilestone) return
    milestones.push(currentMilestone)
    currentMilestone = null
  }

  for (const line of lines) {
    const milestoneMatch = line.match(/^###\s+Milestone\s+(\d+)[：:]\s*(.+)$/)
    if (milestoneMatch) {
      flushMilestone()
      const milestoneNumber = milestoneMatch[1]
      const milestoneName = milestoneMatch[2].trim()
      currentMilestone = {
        id: `M${milestoneNumber}`,
        name: milestoneName,
        branch: `milestone/m${milestoneNumber}-${slugify(milestoneName || "milestone")}`,
        worktreePath: `../${state.projectInfo.name || "project"}-m${milestoneNumber}`,
        tasks: [],
      }
      continue
    }

    const featureMatch = line.match(/^####\s+F(\d{3})[：:]\s*(.+)$/)
    if (featureMatch && currentMilestone) {
      flushFeature()
      currentFeature = {
        featureId: featureMatch[1],
        name: featureMatch[2].trim(),
        body: [],
        dod: [],
      }
      continue
    }

    if (!currentFeature) continue

    const dodMatch = line.match(/^\s*-\s*\[\s*\]\s*(.+)$/)
    if (dodMatch) {
      currentFeature.dod.push(dodMatch[1].trim())
      continue
    }

    const trimmed = line.trim()
    if (trimmed.length > 0) {
      currentFeature.body.push(trimmed)
    }
  }

  flushMilestone()

  if (milestones.length === 0) {
      milestones.push({
        id: "M1",
        name: "Foundation",
        branch: "milestone/m1-foundation",
        worktreePath: `../${state.projectInfo.name || "project"}-m1`,
        tasks: [
          {
            name: "Foundation setup",
            prdRef: "PRD#F001",
            milestoneId: "M1",
            dod: ["Complete foundational project initialization"],
            isUI: isUiProject(state.projectInfo.types),
            affectedFiles: inferTaskFiles(isUiProject(state.projectInfo.types)),
          },
        ],
      })
  }

  return milestones
}

function taskNumber(taskId: string): number {
  const match = taskId.match(/^T(\d+)$/)
  return match ? Number.parseInt(match[1], 10) : 0
}

function nextTaskId(nextNumber: number): string {
  return `T${String(nextNumber).padStart(3, "0")}`
}

function createTaskFromSpec(spec: ParsedTaskSpec, taskId: string): Task {
  return {
    id: taskId,
    name: spec.name,
    type: "TASK",
    status: "PENDING",
    prdRef: spec.prdRef,
    milestoneId: spec.milestoneId,
    dod: [...spec.dod],
    isUI: spec.isUI,
    affectedFiles: [...spec.affectedFiles],
    retryCount: 0,
    checklist: createEmptyTaskChecklist(),
  }
}

function buildMilestonesFromSpecs(specs: ParsedMilestoneSpec[]): Milestone[] {
  let taskCounter = 1

  return specs.map(spec => ({
    id: spec.id,
    name: spec.name,
    branch: spec.branch,
    worktreePath: spec.worktreePath,
    status: "PENDING",
    tasks: spec.tasks.map(task => createTaskFromSpec(task, nextTaskId(taskCounter++))),
  }))
}

function activateNextAvailableTask(milestones: Milestone[]): {
  currentMilestone: string
  currentTask: string
  currentWorktree: string
} {
  const activeTask = milestones
    .flatMap(milestone => milestone.tasks.map(task => ({ milestone, task })))
    .find(entry => entry.task.status === "IN_PROGRESS")

  if (activeTask) {
    activeTask.task.startedAt = activeTask.task.startedAt ?? new Date().toISOString()
    if (activeTask.milestone.status === "PENDING") {
      activeTask.milestone.status = "IN_PROGRESS"
    }
    return {
      currentMilestone: activeTask.milestone.id,
      currentTask: activeTask.task.id,
      currentWorktree: activeTask.milestone.worktreePath,
    }
  }

  for (const milestone of milestones) {
    const nextTask = milestone.tasks.find(task => task.status === "PENDING")
    if (!nextTask) continue

    nextTask.status = "IN_PROGRESS"
    nextTask.startedAt = nextTask.startedAt ?? new Date().toISOString()
    if (milestone.status === "PENDING") {
      milestone.status = "IN_PROGRESS"
    }
    return {
      currentMilestone: milestone.id,
      currentTask: nextTask.id,
      currentWorktree: milestone.worktreePath,
    }
  }

  return { currentMilestone: "", currentTask: "", currentWorktree: "" }
}

function hasOpenMilestones(milestones: Milestone[]): boolean {
  return milestones.some(milestone => !["MERGED", "COMPLETE"].includes(milestone.status))
}

export function deriveExecutionFromPrd(baseState: ProjectState): ProjectState {
  const milestones = buildMilestonesFromSpecs(parsePrdBacklogSpecs(baseState))
  const pointers = activateNextAvailableTask(milestones)

  return {
    ...baseState,
    phase:
      baseState.phase === "VALIDATING" || baseState.phase === "COMPLETE"
        ? baseState.phase
        : "EXECUTING",
    execution: {
      currentMilestone: pointers.currentMilestone,
      currentTask: pointers.currentTask,
      currentWorktree: pointers.currentWorktree,
      milestones,
      allMilestonesComplete: false,
    },
    docs: {
      ...baseState.docs,
      prd: {
        ...baseState.docs.prd,
        exists: true,
        milestoneCount: milestones.length,
      },
      progress: {
        ...baseState.docs.progress,
        exists: true,
        lastUpdated: new Date().toISOString(),
      },
    },
  }
}

export function syncExecutionFromPrd(baseState: ProjectState): {
  addedMilestones: number
  addedTasks: number
  state: ProjectState
} {
  const parsedMilestones = parsePrdBacklogSpecs(baseState)
  const existingMilestones = baseState.execution.milestones
  const existingMilestoneMap = new Map(existingMilestones.map(milestone => [milestone.id, milestone]))
  const highestTaskNumber = existingMilestones
    .flatMap(milestone => milestone.tasks)
    .reduce((highest, task) => Math.max(highest, taskNumber(task.id)), 0)

  let nextTaskNumberValue = highestTaskNumber
  let addedMilestones = 0
  let addedTasks = 0

  const mergedMilestones = parsedMilestones.map(spec => {
    const existingMilestone = existingMilestoneMap.get(spec.id)
    const existingTaskMap = new Map(existingMilestone?.tasks.map(task => [task.prdRef, task]) ?? [])
    const parsedPrdRefs = new Set(spec.tasks.map(task => task.prdRef))

    if (existingMilestone && ["MERGED", "COMPLETE"].includes(existingMilestone.status)) {
      const appendedScope = spec.tasks.filter(task => !existingTaskMap.has(task.prdRef))
      if (appendedScope.length > 0) {
        throw new Error(
          `Milestone ${spec.id} is already ${existingMilestone.status}. Add new scope as a new milestone instead of modifying a merged milestone.`,
        )
      }
    }

    const tasks = spec.tasks.map(taskSpec => {
      const existingTask = existingTaskMap.get(taskSpec.prdRef)
      if (existingTask) {
        return {
          ...existingTask,
          name: taskSpec.name,
          prdRef: taskSpec.prdRef,
          milestoneId: spec.id,
          dod: [...taskSpec.dod],
          isUI: taskSpec.isUI,
          affectedFiles: [...taskSpec.affectedFiles],
        }
      }

      addedTasks++
      nextTaskNumberValue += 1
      return createTaskFromSpec(taskSpec, nextTaskId(nextTaskNumberValue))
    })

    const orphanTasks = existingMilestone?.tasks.filter(task => !parsedPrdRefs.has(task.prdRef)) ?? []
    const milestone: Milestone = existingMilestone
      ? {
          ...existingMilestone,
          name: spec.name,
          branch: existingMilestone.branch || spec.branch,
          worktreePath: existingMilestone.worktreePath || spec.worktreePath,
          tasks: [...tasks, ...orphanTasks],
        }
      : {
          id: spec.id,
          name: spec.name,
          branch: spec.branch,
          worktreePath: spec.worktreePath,
          status: "PENDING",
          tasks,
        }

    if (!existingMilestone) {
      addedMilestones++
    }

    return milestone
  })

  const parsedIds = new Set(parsedMilestones.map(milestone => milestone.id))
  const orphanMilestones = existingMilestones.filter(milestone => !parsedIds.has(milestone.id))
  const milestones = [...mergedMilestones, ...orphanMilestones]
  const pointers = activateNextAvailableTask(milestones)
  const shouldReopenExecution = hasOpenMilestones(milestones)

  const nextState: ProjectState = {
    ...baseState,
    phase:
      shouldReopenExecution && ["VALIDATING", "COMPLETE"].includes(baseState.phase)
        ? "EXECUTING"
        : baseState.phase,
    execution: {
      currentMilestone: pointers.currentMilestone,
      currentTask: pointers.currentTask,
      currentWorktree: pointers.currentWorktree,
      milestones,
      allMilestonesComplete: !shouldReopenExecution && milestones.length > 0,
    },
    docs: {
      ...baseState.docs,
      prd: {
        ...baseState.docs.prd,
        exists: true,
        milestoneCount: Math.max(baseState.docs.prd.milestoneCount, parsedMilestones.length),
      },
      progress: {
        ...baseState.docs.progress,
        exists: true,
        lastUpdated: new Date().toISOString(),
      },
    },
  }

  return {
    addedMilestones,
    addedTasks,
    state: nextState,
  }
}

export function bootstrapExecutionFromPrd(): ProjectState {
  const baseState = existsSync(STATE_PATH) ? readState() : initState({})
  return writeState(deriveExecutionFromPrd(baseState))
}

export function syncExecutionBacklogFromPrd(): {
  addedMilestones: number
  addedTasks: number
  state: ProjectState
} {
  const baseState = existsSync(STATE_PATH) ? readState() : initState({})
  const result = syncExecutionFromPrd(baseState)
  return {
    ...result,
    state: writeState(result.state),
  }
}
