import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Loader2, MessageSquare, Volume2, VolumeX } from "lucide-react";
import {
  browserTtsSupported,
  buildPatientSummarySpokenScript,
  estimateSpokenSeconds,
  speakPatientSummaryScript,
  stopPatientSummarySpeech,
  type PatientSummaryAudioInput,
} from "../lib/patientSummaryAudio";
import { buildWhatsAppSendUrl } from "../lib/whatsappShare";

type Props = {
  patientSummary: PatientSummaryAudioInput | null;
  studyType?: string;
  patientName?: string;
  /** Prefill when user opts into follow-up (e.g. scorecard recommendation). */
  followUpText?: string | null;
  whatsappPhone?: string;
  onCopy?: (text: string) => void;
};

/**
 * Opt-in WhatsApp audio bar for the patient summary.
 * Easy to remove: delete this component + its import in App.
 */
export const PatientSummaryAudioBar: React.FC<Props> = ({
  patientSummary,
  studyType,
  patientName,
  followUpText,
  whatsappPhone,
  onCopy,
}) => {
  const [includeFollowUp, setIncludeFollowUp] = useState(false);
  const [script, setScript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mp3Url, setMp3Url] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const seconds = useMemo(() => estimateSpokenSeconds(script), [script]);

  useEffect(() => {
    return () => {
      stopPatientSummarySpeech();
      if (mp3Url) URL.revokeObjectURL(mp3Url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup once
  }, []);

  useEffect(() => {
    // Rebuild script when summary or follow-up toggle changes
    if (!patientSummary) {
      setScript("");
      return;
    }
    const next = buildPatientSummarySpokenScript(patientSummary, {
      includeFollowUp,
      followUpText: includeFollowUp ? followUpText : "",
      studyType,
      patientFirstName: patientName,
      maxWords: includeFollowUp ? 125 : 110,
    });
    setScript(next);
    setError(null);
    if (mp3Url) {
      URL.revokeObjectURL(mp3Url);
      setMp3Url(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mp3Url revoked when inputs change
  }, [patientSummary, includeFollowUp, followUpText, studyType, patientName]);

  const handlePlayBrowser = () => {
    setError(null);
    if (!script.trim()) {
      setError("No hay guion de audio. Genere primero la explicación al paciente.");
      return;
    }
    if (!browserTtsSupported()) {
      setError("Este navegador no soporta voz. Use Descargar MP3 si hay OpenAI.");
      return;
    }
    setIsSpeaking(true);
    speakPatientSummaryScript(script, {
      onEnd: () => setIsSpeaking(false),
      onError: (msg) => {
        setIsSpeaking(false);
        setError(msg);
      },
    });
  };

  const handleStop = () => {
    stopPatientSummarySpeech();
    setIsSpeaking(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleCopy = async () => {
    if (!script.trim()) return;
    try {
      await navigator.clipboard.writeText(script);
      onCopy?.(script);
    } catch {
      setError("No se pudo copiar el guion.");
    }
  };

  const handleDownloadMp3 = async () => {
    if (!script.trim()) return;
    setIsDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/patient-summary-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script,
          includeFollowUp,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "No se pudo generar el MP3.");
      }
      if (!contentType.includes("audio")) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "El servidor no devolvió audio.");
      }
      const blob = await res.blob();
      if (mp3Url) URL.revokeObjectURL(mp3Url);
      const url = URL.createObjectURL(blob);
      setMp3Url(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = "explicacion-paciente-whatsapp.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      setError(
        e?.message ||
          "MP3 no disponible. Puede reproducir con la voz del navegador o copiar el guion."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsAppText = () => {
    if (!script.trim()) return;
    const intro =
      "*Audio / explicación breve para el paciente*\n_Solo hallazgos — sin plan de tratamiento" +
      (includeFollowUp ? " (incluye seguimiento solicitado)_" : "_") +
      "\n\n";
    const url = buildWhatsAppSendUrl(whatsappPhone || "", intro + script);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!patientSummary) return null;

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-3 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 font-mono flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5" />
            Audio WhatsApp (30–45 s)
          </div>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-xl">
            Misma explicación del PDF corto, en voz. Por defecto{" "}
            <span className="text-emerald-200/90">sin recomendaciones ni tratamiento</span>.
            {script ? (
              <span className="text-slate-500"> · ~{seconds}s estimados</span>
            ) : null}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-[10px] text-slate-300 cursor-pointer select-none border border-slate-700/80 rounded-lg px-2.5 py-1.5 bg-slate-950/50">
          <input
            type="checkbox"
            checked={includeFollowUp}
            onChange={(e) => setIncludeFollowUp(e.target.checked)}
            className="rounded border-slate-600"
          />
          Incluir seguimiento (BI-RADS, TI-RADS…)
        </label>
      </div>

      {script ? (
        <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 max-h-28 overflow-y-auto">
          {script}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!isSpeaking ? (
          <button
            type="button"
            onClick={handlePlayBrowser}
            className="text-[9px] font-black text-emerald-100 border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/30 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5"
          >
            <Volume2 className="h-3 w-3" />
            Escuchar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="text-[9px] font-black text-rose-200 border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5"
          >
            <VolumeX className="h-3 w-3" />
            Detener
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="text-[9px] font-black text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5 bg-slate-950/40"
        >
          <Copy className="h-3 w-3" />
          Copiar guion
        </button>
        <button
          type="button"
          onClick={handleDownloadMp3}
          disabled={isDownloading || !script}
          className="text-[9px] font-black text-slate-100 border border-slate-600 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5 bg-slate-900 disabled:opacity-50"
          title="Voz natural OpenAI (gpt-4o-mini-tts). Requiere OPENAI_API_KEY. Si falla, use Escuchar o Copiar guion."
        >
          {isDownloading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          Descargar MP3 (voz natural)
        </button>
        <button
          type="button"
          onClick={handleWhatsAppText}
          className="text-[9px] font-black text-white border border-emerald-500/40 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5 bg-emerald-950/50"
          title="Abre WhatsApp con el guion. Adjunte el MP3 manualmente si lo descargó."
        >
          <MessageSquare className="h-3 w-3 text-emerald-400" />
          WhatsApp (texto)
        </button>
      </div>

      {error ? (
        <p className="text-[10px] text-amber-300/90 leading-snug">{error}</p>
      ) : (
        <p className="text-[9px] text-slate-500 leading-snug">
          Tip: «Escuchar» usa la voz del navegador (más robótica). «Descargar MP3» usa voz
          natural OpenAI — adjúntelo en WhatsApp; el botón WhatsApp solo pega el guion.
        </p>
      )}

      {mp3Url ? (
        <audio ref={audioRef} src={mp3Url} controls className="w-full h-8 mt-1" />
      ) : null}
    </div>
  );
};
