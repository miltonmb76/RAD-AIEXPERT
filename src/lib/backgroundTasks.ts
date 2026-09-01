/**
 * Registro ligero de tareas en segundo plano para ejecutar varios módulos IA en paralelo.
 */

export type BackgroundTaskStatus = "running" | "done" | "error";

export interface BackgroundTask {
  id: string;
  label: string;
  status: BackgroundTaskStatus;
  startedAt: number;
  finishedAt?: number;
  detail?: string;
}

type Listener = (tasks: BackgroundTask[]) => void;

const tasks = new Map<string, BackgroundTask>();
const listeners = new Set<Listener>();

function snapshot(): BackgroundTask[] {
  return Array.from(tasks.values()).sort((a, b) => b.startedAt - a.startedAt);
}

function notify() {
  const list = snapshot();
  listeners.forEach((fn) => fn(list));
}

export function subscribeBackgroundTasks(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function startBackgroundTask(id: string, label: string): void {
  tasks.set(id, {
    id,
    label,
    status: "running",
    startedAt: Date.now(),
  });
  notify();
}

export function finishBackgroundTask(id: string, error?: string): void {
  const existing = tasks.get(id);
  if (!existing) return;
  tasks.set(id, {
    ...existing,
    status: error ? "error" : "done",
    finishedAt: Date.now(),
    detail: error,
  });
  notify();
  window.setTimeout(() => {
    const current = tasks.get(id);
    if (current?.finishedAt && Date.now() - current.finishedAt > 8000) {
      tasks.delete(id);
      notify();
    }
  }, 8500);
}

export async function runBackgroundTask<T>(
  id: string,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  startBackgroundTask(id, label);
  try {
    const result = await fn();
    finishBackgroundTask(id);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    finishBackgroundTask(id, message);
    throw err;
  }
}

export function getActiveBackgroundTaskCount(): number {
  return snapshot().filter((t) => t.status === "running").length;
}
