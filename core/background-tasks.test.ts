import assert from "node:assert/strict"
import test from "node:test"
import {
  BackgroundQuiescenceTimeoutError,
  awaitBackgroundQuiescence,
  drainBackgroundTasks,
  pendingBackgroundTaskCount,
  startBackgroundTask,
  startBackgroundTaskRecording,
  stopBackgroundTaskRecording,
  trackBackgroundTask,
} from "./background-tasks"
import { PrivilegedOperationDeniedError, resetPolicySource, setPolicySource, type PolicySource } from "@core/privileged-operations"

const mode = (m: "normal" | "freeze-writes"): PolicySource => ({ name: `test:${m}`, resolve: () => ({ kind: "mode", mode: m, origin: `test:${m}` }) })

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test.afterEach(async () => {
  resetPolicySource()
  await drainBackgroundTasks()
})

test("startBackgroundTask: in normal mode the factory runs and the task is tracked like before", async () => {
  setPolicySource(mode("normal"))
  startBackgroundTaskRecording()
  let started = false
  const p = startBackgroundTask("t:normal", async () => {
    started = true
    return 42
  })
  assert.equal(pendingBackgroundTaskCount(), 1)
  assert.equal(await p, 42)
  assert.ok(started)
  const outcomes = await drainBackgroundTasks()
  assert.deepEqual(outcomes.map((o) => [o.label, o.status, o.value]), [["t:normal", "fulfilled", 42]])
  stopBackgroundTaskRecording()
})

test("no new writeful background work starts while frozen: factory never invoked, nothing pending, refusal visible to the caller", async () => {
  setPolicySource(mode("freeze-writes"))
  let invoked = 0
  const p = startBackgroundTask("t:frozen", async () => {
    invoked++
    return "should-not-run"
  })
  await assert.rejects(p, PrivilegedOperationDeniedError)
  assert.equal(invoked, 0, "the factory was never called")
  assert.equal(pendingBackgroundTaskCount(), 0, "nothing was registered")
  // A call site's own .catch sees the refusal like any other failure.
  let seen: unknown = null
  await startBackgroundTask("t:frozen2", async () => 1).catch((err) => {
    seen = err
  })
  assert.ok(seen instanceof PrivilegedOperationDeniedError)
})

test("in-flight work started before the freeze drains; quiescence is proven with pending = 0", async () => {
  setPolicySource(mode("normal"))
  const d = deferred<string>()
  const inFlight = trackBackgroundTask("t:inflight", d.promise)
  setPolicySource(mode("freeze-writes"))
  await assert.rejects(startBackgroundTask("t:new", async () => "x"), PrivilegedOperationDeniedError)
  assert.equal(pendingBackgroundTaskCount(), 1, "only the pre-freeze task is in flight")
  setTimeout(() => d.resolve("done"), 20)
  const report = await awaitBackgroundQuiescence({ timeoutMs: 5_000 })
  assert.equal(report.pendingAtStart, 1)
  assert.equal(report.pendingAtEnd, 0)
  assert.equal(await inFlight, "done")
  assert.equal(pendingBackgroundTaskCount(), 0)
})

test("quiescence timeout is deterministic: names the pending count, leaves the task registered, and a failed task still counts as drained", async () => {
  setPolicySource(mode("normal"))
  const d = deferred<void>()
  trackBackgroundTask("t:slow", d.promise)
  await assert.rejects(awaitBackgroundQuiescence({ timeoutMs: 30 }), (err: unknown) => {
    assert.ok(err instanceof BackgroundQuiescenceTimeoutError)
    assert.equal(err.pendingCount, 1)
    assert.match(err.message, /1 task\(s\) still pending after 30 ms/)
    return true
  })
  assert.equal(pendingBackgroundTaskCount(), 1, "the timeout does not discard the task")
  d.reject(new Error("boom"))
  const report = await awaitBackgroundQuiescence({ timeoutMs: 1_000 })
  assert.equal(report.pendingAtEnd, 0, "a rejected task is settled, therefore drained")
  await assert.rejects(awaitBackgroundQuiescence({ timeoutMs: -1 }), /non-negative/)
  assert.deepEqual(await awaitBackgroundQuiescence({ timeoutMs: 0 }).then((r) => r.pendingAtEnd), 0, "idle registry returns immediately")
})
