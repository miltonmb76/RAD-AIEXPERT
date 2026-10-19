import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Loader2, MessageSquare, Volume2, VolumeX } from "lucide-react";
import {
  browserTtsSupported,
  downloadPatientSummaryAudioMp3,
  estimateSpokenSeconds,
  fetchPatientSummaryAudioScript,
  listPatientSummaryFindingLabels,
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
  const [isBuildingScript, setIsBuildingScript] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mp3Url, setMp3Url] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buildGen = useRef(0);

  const seconds = useMemo(() => estimateSpokenSeconds(script), [script]);
  const findingCount = useMemo(
    () => listPatientSummaryFindingLabels(patientSummary).length,
    [patientSummary]
  );

  useEffect(() => {
    return () => {
      stopPatientSummarySpeech();
      if (mp3Url) URL.revokeObjectURL(mp3Url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup once
  }, []);

  useEffect(() => {
    if (!patientSummary) {
      setScript("");
      return;
    }
    const gen = ++buildGen.current;
    setIsBuildingScript(true);
    setError(null);
    if (mp3Url) {
      URL.revokeObjectURL(mp3Url);
      setMp3Url(null);
    }
    void fetchPatientSummaryAudioScript({
      patientSummary,
      includeFollowUp,
      followUpText: includeFollowUp ? followUpText : "",
      studyType,
      patientFirstName: patientName,
    })
      .then((res) => {
        if (buildGen.current !== gen) return;
        setScript(res.script);
      })
      .catch((e: any) => {
        if (buildGen.current !== gen) return;
        setError(e?.message || "No se pudo armar el guion de audio.");
      })
      .finally(() => {
        if (buildGen.current === gen) setIsBuildingScript(false);
      });
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
    if (!patientSummary) return;
    setIsDownloading(true);
    setError(null);
    try {
      // Refresh script so MP3 always covers every finding
      const { script: fresh } = await fetchPatientSummaryAudioScript({
        patientSummary,
        includeFollowUp,
        followUpText: includeFollowUp ? followUpText : "",
        studyType,
        patientFirstName: patientName,
      });
      setScript(fresh);
      const blob = await downloadPatientSummaryAudioMp3({
        script: fresh,
        includeFollowUp,
        filename: "explicacion-paciente-whatsapp.mp3",
      });
      if (mp3Url) URL.revokeObjectURL(mp3Url);
      setMp3Url(URL.createObjectURL(blob));
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
      "*Audio / explicación breve para el paciente*\n_Basado en «Qué estudio se le realizó» y «En pocas palabras» — sin plan de tratamiento" +
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
            Audio WhatsApp (2 primeras secciones)
          </div>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-xl">
            Narra{" "}
            <span className="text-emerald-200/90">Qué estudio se le realizó</span>
            {" + "}
            <span className="text-emerald-200/90">En pocas palabras</span>
            {findingCount > 0 ? (
              <span className="text-slate-500">
                {" "}
                · PDF con {findingCount} ficha{findingCount === 1 ? "" : "s"} de hallazgo
              </span>
            ) : null}
            {script ? (
              <span className="text-slate-500"> · ~{seconds}s estimados</span>
            ) : null}
            {isBuildingScript ? (
              <span className="text-emerald-400/80"> · preparando guion…</span>
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
        <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 max-h-36 overflow-y-auto">
          {script}
        </p>
      ) : isBuildingScript ? (
        <p className="text-[11px] text-slate-500 italic px-1">
          La IA está armando el audio con las dos primeras secciones del PDF…
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!isSpeaking ? (
          <button
            type="button"
            onClick={handlePlayBrowser}
            disabled={isBuildingScript || !script}
            className="text-[9px] font-black text-emerald-100 border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/30 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5 disabled:opacity-50"
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
          disabled={!script}
          className="text-[9px] font-black text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5 bg-slate-950/40 disabled:opacity-50"
        >
          <Copy className="h-3 w-3" />
          Copiar guion
        </button>
        <button
          type="button"
          onClick={handleDownloadMp3}
          disabled={isDownloading || isBuildingScript || !patientSummary}
          className="text-[9px] font-black text-slate-100 border border-slate-600 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5 bg-slate-900 disabled:opacity-50"
          title="Voz natural OpenAI. Guion = Qué estudio se le realizó + En pocas palabras."
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
          disabled={!script}
          className="text-[9px] font-black text-white border border-emerald-500/40 px-3 py-1.5 rounded-xl uppercase tracking-wider font-mono inline-flex items-center gap-1.5 bg-emerald-950/50 disabled:opacity-50"
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
          El audio usa las mismas dos primeras secciones del PDF explicativo (estudio + en
          pocas palabras). Sin recomendaciones salvo que marque seguimiento.
        </p>
      )}

      {mp3Url ? (
        <audio ref={audioRef} src={mp3Url} controls className="w-full h-8 mt-1" />
      ) : null}
    </div>
  );
};
