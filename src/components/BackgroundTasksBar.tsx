import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { BackgroundTask, subscribeBackgroundTasks } from "../lib/backgroundTasks";

export const BackgroundTasksBar: React.FC = () => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  useEffect(() => subscribeBackgroundTasks(setTasks), []);

  const running = tasks.filter((t) => t.status === "running");
  const recent = tasks.filter((t) => t.status !== "running").slice(0, 2);

  if (running.length === 0 && recent.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[120] max-w-sm w-[min(100vw-2rem,22rem)] pointer-events-none">
      <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-800/80 flex items-center gap-2">
          <Loader2 className={`h-3.5 w-3.5 text-indigo-400 ${running.length > 0 ? "animate-spin" : "opacity-40"}`} />
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 font-mono">
            {running.length > 0
              ? `${running.length} tarea${running.length > 1 ? "s" : ""} en paralelo`
              : "Tareas completadas"}
          </span>
        </div>

        <div className="px-3.5 py-2.5 space-y-1.5 max-h-40 overflow-y-auto">
          {running.map((task) => (
            <div key={task.id} className="flex items-start gap-2 text-[10px] text-slate-300">
              <Loader2 className="h-3 w-3 animate-spin text-indigo-400 shrink-0 mt-0.5" />
              <span className="leading-snug font-medium">{task.label}</span>
            </div>
          ))}
          {recent.map((task) => (
            <div key={task.id} className="flex items-start gap-2 text-[10px] text-slate-500">
              {task.status === "done" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-3 w-3 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">
                {task.label}
                {task.detail ? ` — ${task.detail}` : ""}
              </span>
            </div>
          ))}
        </div>

        {running.length > 1 && (
          <div className="px-3.5 py-2 border-t border-slate-800/80 text-[9px] text-slate-500 font-mono">
            Puedes seguir usando otros módulos mientras estas tareas terminan.
          </div>
        )}
      </div>
    </div>
  );
};
