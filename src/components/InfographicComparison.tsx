import React, { useEffect, useRef, useState } from "react";
import { requestOpenAiInfographic, type InfographicAudience, type InfographicCandidate, type InfographicComparisonInput } from "../lib/infographicComparison";

type Props = {
  contextKey: string;
  input: InfographicComparisonInput;
  patientImage: string | null;
  clinicianImage: string | null;
  busy: boolean;
  onUse: (audience: InfographicAudience, imageUrl: string) => void;
};
type Candidate = InfographicCandidate & { source: string };
const audiences: InfographicAudience[] = ["patient", "clinician"];
const label = (audience: InfographicAudience) => audience === "patient" ? "Paciente" : "Médico";
const button = "rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-100 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400";

export function InfographicComparison({ contextKey, input, patientImage, clinicianImage, busy, onUse }: Props) {
  const [tab, setTab] = useState<InfographicAudience>("patient");
  const [candidates, setCandidates] = useState<Partial<Record<InfographicAudience, Candidate>>>({});
  const [originals, setOriginals] = useState<Partial<Record<InfographicAudience, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<InfographicAudience, string>>>({});
  const [running, setRunning] = useState<InfographicAudience | null>(null);
  const [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  const source = JSON.stringify([contextKey, input]);
  const latestSource = useRef(source);
  latestSource.current = source;

  // Changing the report or switching studies invalidates candidates and late responses.
  useEffect(() => {
    active.current?.abort(); active.current = null;
    setCandidates({}); setOriginals({}); setErrors({}); setRunning(null); setNotice("");
    return () => { active.current?.abort(); active.current = null; };
  }, [source]);

  const generate = async (targets: InfographicAudience[]) => {
    if (active.current || busy) return;
    const controller = new AbortController();
    active.current = controller;
    setNotice("");
    // Preserve originals before any explicit choice replaces the image used in a PDF.
    setOriginals(previous => {
      const next = { ...previous };
      for (const audience of targets) {
        const current = audience === "patient" ? patientImage : clinicianImage;
        if (current && current !== candidates[audience]?.imageUrl) next[audience] = current;
      }
      return next;
    });
    try {
      // One image at a time: a failure for one audience does not discard the other.
      for (const audience of targets) {
        if (controller.signal.aborted || latestSource.current !== source) break;
        setRunning(audience);
        setErrors(previous => ({ ...previous, [audience]: "" }));
        try {
          const candidate = await requestOpenAiInfographic(input, audience, controller.signal);
          if (!controller.signal.aborted && latestSource.current === source) {
            setCandidates(previous => ({ ...previous, [audience]: { ...candidate, source } }));
          }
        } catch (error) {
          if (!controller.signal.aborted && latestSource.current === source) {
            setErrors(previous => ({ ...previous, [audience]: error instanceof Error ? error.message : "No se pudo generar la imagen." }));
          }
        }
      }
    } finally {
      if (active.current === controller) { active.current = null; setRunning(null); }
    }
  };
  const candidate = candidates[tab]?.source === source ? candidates[tab] : undefined;
  const current = tab === "patient" ? patientImage : clinicianImage;
  const original = originals[tab] || (current !== candidate?.imageUrl ? current : null);
  const choose = (imageUrl: string) => {
    if (busy || running || latestSource.current !== source) return;
    onUse(tab, imageUrl);
    setNotice(tab === "patient" ? "Imagen seleccionada para el PDF de explicación al paciente." : "Imagen seleccionada para el PDF del informe formal.");
  };

  return <section aria-label="Comparación de infografías con OpenAI" className="mb-5 rounded-xl border border-cyan-800 bg-slate-900 p-4 space-y-3">
    <h4 className="text-sm font-bold text-cyan-200">Comparar infografías con OpenAI</h4>
    <p className="text-xs text-slate-300">Paciente: explicación sencilla de los hallazgos, sin recomendaciones. Médico: contenido técnico para el informe formal.</p>
    <p className="text-xs text-slate-400">La prueba utiliza la API de OpenAI, con facturación independiente de ChatGPT. Puedes seguir trabajando mientras se genera. Elige una imagen para incorporarla al PDF después de revisar texto, medidas y lateralidad.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={busy || !!running} onClick={() => generate(["patient"])}>Probar OpenAI · paciente</button>
      <button type="button" className={button} disabled={busy || !!running} onClick={() => generate(["clinician"])}>Probar OpenAI · médico</button>
      <button type="button" className={button} disabled={busy || !!running} onClick={() => generate(audiences)}>Probar ambas</button>
      {running && <button type="button" className={button} onClick={() => { active.current?.abort(); setNotice("Prueba cancelada. Se conservan las imágenes disponibles."); }}>Cancelar prueba</button>}
    </div>
    <div role="status" aria-live="polite" className="text-xs text-cyan-200">
      {running ? `Generando versión ${label(running).toLowerCase()} con OpenAI…` : notice}
    </div>
    <div className="flex gap-2" aria-label="Público de la comparación">
      {audiences.map(audience => <button type="button" key={audience} className={button} aria-pressed={tab === audience} onClick={() => setTab(audience)}>{label(audience)}{errors[audience] ? " · error" : candidates[audience] ? " · disponible" : ""}</button>)}
    </div>
    {errors[tab] && <p role="alert" className="text-xs text-rose-300">{errors[tab]}</p>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {([
        { title: "Versión actual / original", url: original, caption: "Conservada para comparar o volver a utilizarla." },
        { title: "Prueba OpenAI", url: candidate?.imageUrl, caption: candidate ? `${candidate.model} · ${Math.round(candidate.elapsedMs / 1000)} s` : "Todavía no se ha generado para este público." },
      ]).map(card => <div key={card.title} className="min-w-0 space-y-2">
        <h5 className="text-xs font-semibold text-slate-200">{card.title} · {label(tab)}</h5>
        <p className="text-xs text-slate-400">{card.caption}</p>
        {card.url ? <>
          <a href={card.url} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar ${card.title}, ${label(tab)}`}><img src={card.url} alt={`${card.title} para ${label(tab).toLowerCase()}`} loading="lazy" decoding="async" className="w-full rounded-lg" /></a>
          <button type="button" className={button} disabled={busy || !!running} onClick={() => choose(card.url!)}>Usar en {tab === "patient" ? "PDF paciente" : "PDF formal"}</button>
        </> : <p className="text-xs text-slate-500">{card.title === "Prueba OpenAI" ? "Usa los botones de prueba." : "Genera primero la infografía habitual si deseas comparar ambas."}</p>}
      </div>)}
    </div>
  </section>;
}
