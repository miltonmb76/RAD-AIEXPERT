/** Run independent jobs with bounded parallelism, preserving every result. */
export async function runConcurrent<T>(
  jobs: Array<() => Promise<T>>,
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }
  const results: PromiseSettledResult<T>[] = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await jobs[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
      // Give input/paint events a turn between image decodes or result updates.
      if (next < jobs.length) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

/** Share only overlapping reads for the same key; never retain completed data. */
export function singleFlight<T>(load: (key: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>();
  return (key: string): Promise<T> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(() => load(key)).finally(() => {
      pending.delete(key);
    });
    pending.set(key, request);
    return request;
  };
}
