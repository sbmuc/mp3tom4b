/**
 * Probes on the shared instance take turns. Every 'log' listener hears every
 * run on that instance, so two probes at once would each parse the other's
 * output too — and the merge tool probes every dropped file at the same moment.
 */
let queue: Promise<unknown> = Promise.resolve()

export function oneAtATime<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op)
  queue = run.catch(() => undefined)
  return run
}
