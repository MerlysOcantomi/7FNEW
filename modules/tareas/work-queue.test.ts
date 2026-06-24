import { test } from "node:test"
import assert from "node:assert/strict"

import {
  classifyTask,
  groupWorkQueue,
  isDone,
  isOverdue,
  pickCurrentFocus,
  summaryCounts,
  type QueueTask,
} from "./work-queue"

const NOW = new Date("2026-06-24T12:00:00.000Z").getTime()
const YESTERDAY = "2026-06-23T12:00:00.000Z"
const TOMORROW = "2026-06-25T12:00:00.000Z"

function task(partial: Partial<QueueTask> & { id: string }): QueueTask {
  return { estado: "pendiente", prioridad: "media", fechaLimite: null, ...partial }
}

test("isDone covers completada and cancelada (case-insensitive)", () => {
  assert.equal(isDone({ estado: "completada" }), true)
  assert.equal(isDone({ estado: "cancelada" }), true)
  assert.equal(isDone({ estado: "Completada" }), true)
  assert.equal(isDone({ estado: "pendiente" }), false)
  assert.equal(isDone({ estado: null }), false)
})

test("isOverdue is true only for active tasks with a past due date", () => {
  assert.equal(isOverdue({ estado: "pendiente", fechaLimite: YESTERDAY }, NOW), true)
  assert.equal(isOverdue({ estado: "pendiente", fechaLimite: TOMORROW }, NOW), false)
  // Done tasks are never overdue, even with a past due date.
  assert.equal(isOverdue({ estado: "completada", fechaLimite: YESTERDAY }, NOW), false)
  // No / invalid date is never overdue.
  assert.equal(isOverdue({ estado: "pendiente", fechaLimite: null }, NOW), false)
  assert.equal(isOverdue({ estado: "pendiente", fechaLimite: "not-a-date" }, NOW), false)
})

test("classifyTask partitions each active task into exactly one bucket", () => {
  // Overdue → attention (even at normal priority).
  assert.equal(classifyTask(task({ id: "a", prioridad: "media", fechaLimite: YESTERDAY }), NOW), "attention")
  // High priority → attention.
  assert.equal(classifyTask(task({ id: "b", prioridad: "urgente", fechaLimite: TOMORROW }), NOW), "attention")
  assert.equal(classifyTask(task({ id: "c", prioridad: "alta", fechaLimite: null }), NOW), "attention")
  // In review → risks.
  assert.equal(classifyTask(task({ id: "d", estado: "revision", prioridad: "media" }), NOW), "risks")
  // Otherwise active → ready.
  assert.equal(classifyTask(task({ id: "e", estado: "pendiente", prioridad: "baja", fechaLimite: TOMORROW }), NOW), "ready")
  // Done → null (belongs to Recently completed).
  assert.equal(classifyTask(task({ id: "f", estado: "completada" }), NOW), null)
})

test("groupWorkQueue separates completed from active sections", () => {
  const tasks = [
    task({ id: "overdue", prioridad: "media", fechaLimite: YESTERDAY }),
    task({ id: "urgent", prioridad: "urgente", fechaLimite: TOMORROW }),
    task({ id: "review", estado: "revision" }),
    task({ id: "ready", prioridad: "baja", fechaLimite: TOMORROW }),
    task({ id: "done", estado: "completada" }),
    task({ id: "cancelled", estado: "cancelada" }),
  ]
  const groups = groupWorkQueue(tasks, NOW)
  assert.deepEqual(groups.attention.map((t) => t.id), ["overdue", "urgent"])
  assert.deepEqual(groups.risks.map((t) => t.id), ["review"])
  assert.deepEqual(groups.ready.map((t) => t.id), ["ready"])
  assert.deepEqual(groups.completed.map((t) => t.id), ["done", "cancelled"])
})

test("summaryCounts reports real counts and 0 for empty-state sections", () => {
  const tasks = [
    task({ id: "1", prioridad: "urgente" }),
    task({ id: "2", estado: "revision" }),
    task({ id: "3", prioridad: "media", fechaLimite: TOMORROW }),
    task({ id: "4", estado: "completada" }),
  ]
  const counts = summaryCounts(tasks, NOW)
  assert.equal(counts.attention, 1)
  assert.equal(counts.risks, 1)
  assert.equal(counts.ready, 1)
  assert.equal(counts.completed, 1)
  // No legacy backing yet — must never fabricate a number.
  assert.equal(counts.proposed, 0)
  assert.equal(counts.suggested, 0)
})

test("pickCurrentFocus prefers overdue, then high priority, then open", () => {
  // Overdue wins over a higher-priority but not-overdue task.
  const withOverdue = [
    task({ id: "high", prioridad: "urgente", fechaLimite: TOMORROW }),
    task({ id: "overdue", prioridad: "media", fechaLimite: YESTERDAY }),
  ]
  assert.equal(pickCurrentFocus(withOverdue, NOW)?.task.id, "overdue")

  // No overdue → highest priority wins.
  const withHigh = [
    task({ id: "low", prioridad: "baja", fechaLimite: TOMORROW }),
    task({ id: "alta", prioridad: "alta", fechaLimite: TOMORROW }),
  ]
  assert.equal(pickCurrentFocus(withHigh, NOW)?.task.id, "alta")

  // No overdue / no high → soonest-due open task.
  const onlyNormal = [
    task({ id: "later", prioridad: "media", fechaLimite: "2026-07-01T12:00:00.000Z" }),
    task({ id: "sooner", prioridad: "media", fechaLimite: TOMORROW }),
  ]
  assert.equal(pickCurrentFocus(onlyNormal, NOW)?.task.id, "sooner")
})

test("pickCurrentFocus falls back to first task when all are done, null when empty", () => {
  const allDone = [task({ id: "x", estado: "completada" }), task({ id: "y", estado: "cancelada" })]
  assert.equal(pickCurrentFocus(allDone, NOW)?.task.id, "x")
  assert.equal(pickCurrentFocus([], NOW), null)
})
