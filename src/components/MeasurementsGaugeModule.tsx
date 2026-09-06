import React, { useMemo, useState } from "react";
import {
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  FileText,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { MeasurementGaugeData, MeasurementGaugeItem } from "../types";

interface MeasurementsGaugeModuleProps {
  selectedModel: string;
  reportText: string;
  studyType?: string;
  gaugeData: MeasurementGaugeData | null;
  setGaugeData: (data: MeasurementGaugeData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (v: boolean) => void;
  /** When true, PDF annex also lists normal measurements. Default false. */
  includeNormalsInPdf: boolean;
  setIncludeNormalsInPdf: (v: boolean) => void;
}

function statusChipClass(status: MeasurementGaugeItem["status"]) {
  switch (status) {
    case "altered":
      return "bg-rose-500/15 text-rose-300 border-rose-500/40";
    case "borderline":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "normal":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    default:
      return "bg-slate-500/15 text-slate-400 border-slate-600/40";
  }
}

function statusLabel(status: MeasurementGaugeItem["status"]) {
  switch (status) {
    case "altered":
      return "Alterado";
    case "borderline":
      return "Límite";
    case "normal":
      return "Normal";
    default:
      return "No hallado";
  }
}

function markerClass(status: MeasurementGaugeItem["status"]) {
  switch (status) {
    case "altered":
      return "bg-rose-400";
    case "borderline":
      return "bg-amber-400";
    case "normal":
      return "bg-emerald-400";
    default:
      return "bg-slate-400";
  }
}

function GaugeBar({ item }: { item: MeasurementGaugeItem }) {
  const scaleMin = Number.isFinite(item.scaleMin) ? item.scaleMin : 0;
  const scaleMax =
    Number.isFinite(item.scaleMax) && item.scaleMax > scaleMin ? item.scaleMax : scaleMin + 1;
  const span = scaleMax - scaleMin;
  const bandL = item.rangeMin == null ? scaleMin : Math.max(scaleMin, item.rangeMin);
  const bandR = item.rangeMax == null ? scaleMax : Math.min(scaleMax, item.rangeMax);
  const bandLeftPct = ((bandL - scaleMin) / span) * 100;
  const bandWidthPct = Math.max(2, ((bandR - bandL) / span) * 100);
  const markerPct =
    item.valueNumeric != null && Number.isFinite(item.valueNumeric)
      ? Math.min(100, Math.max(0, ((item.valueNumeric - scaleMin) / span) * 100))
      : null;

  return (
    <div className="relative h-3 rounded-full bg-slate-800/90 border border-slate-700/60 overflow-hidden">
      <div
        className="absolute inset-y-0 bg-emerald-500/25"
        style={{ left: `${bandLeftPct}%`, width: `${bandWidthPct}%` }}
      />
      {markerPct != null && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-slate-950 shadow ${markerClass(item.status)}`}
          style={{ left: `${markerPct}%` }}
          title={String(item.valueNumeric)}
        />
      )}
    </div>
  );
}

export const MeasurementsGaugeModule: React.FC<MeasurementsGaugeModuleProps> = ({
  selectedModel,
  reportText,
  studyType,
  gaugeData,
  setGaugeData,
  includeInReport,
  setIncludeInReport,
  includeNormalsInPdf,
  setIncludeNormalsInPdf,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNormalsInUi, setShowNormalsInUi] = useState(true);

  const visibleRows = useMemo(() => {
    const list = gaugeData?.measurements || [];
    return list.filter((m) => {
      if (m.status === "not_found") return false;
      if (!showNormalsInUi && m.status === "normal") return false;
      return true;
    });
  }, [gaugeData, showNormalsInUi]);

  const counts = useMemo(() => {
    const list = gaugeData?.measurements || [];
    return {
      altered: list.filter((m) => m.status === "altered").length,
      borderline: list.filter((m) => m.status === "borderline").length,
      normal: list.filter((m) => m.status === "normal").length,
    };
  }, [gaugeData]);

  const handleExtract = async () => {
    if (!reportText.trim()) {
      setError("El informe está vacío. Genera o pega un reporte primero.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/extract-measurement-gauges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "",
        }),
      });
      const json = await resp.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudieron extraer las medidas.");
      }
      setGaugeData(json.data as MeasurementGaugeData);
      setIncludeInReport(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-900/40 bg-slate-950/70 shadow-xl overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 border-b border-blue-900/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-400/30">
            <Gauge className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-blue-100">
              Extractor de medidas
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Barras vs rango normal (GIM, PSV, diámetros, RI…) · cualquier estudio cuantitativo
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/40"
              checked={includeInReport}
              onChange={(e) => setIncludeInReport(e.target.checked)}
            />
            {includeInReport ? "Incluido en PDF" : "No incluir en PDF"}
          </label>
          <label
            className={`inline-flex items-center gap-2 text-[11px] cursor-pointer select-none ${
              includeInReport ? "text-slate-300" : "text-slate-500"
            }`}
            title="Si está desmarcada, el PDF solo muestra alteradas/límite"
          >
            <input
              type="checkbox"
              className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
              checked={includeNormalsInPdf}
              disabled={!includeInReport}
              onChange={(e) => setIncludeNormalsInPdf(e.target.checked)}
            />
            Incluir medidas normales en PDF
          </label>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExtract}
            disabled={isLoading || !reportText.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wide"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isLoading ? "Extrayendo…" : gaugeData ? "Regenerar gauges" : "Extraer medidas"}
          </button>
          {gaugeData && (
            <button
              type="button"
              onClick={handleExtract}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-600 text-slate-300 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          )}
          {gaugeData && (
            <label className="inline-flex items-center gap-2 ml-auto text-[11px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-600 bg-slate-900 text-slate-400"
                checked={showNormalsInUi}
                onChange={(e) => setShowNormalsInUi(e.target.checked)}
              />
              Mostrar normales en pantalla
            </label>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!gaugeData && !isLoading && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-700 rounded-xl px-4 py-6 text-center">
            Extrae del informe las medidas numéricas y compáralas con rangos de referencia.
            Por defecto el PDF solo incluye alteradas/límite; marca la casilla para añadir las normales.
          </div>
        )}

        {gaugeData && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-lg bg-blue-950/50 border border-blue-800/40 text-blue-200 font-semibold">
                {gaugeData.studyType || "Estudio"}
              </span>
              <span className="text-slate-500">{gaugeData.referenceSource}</span>
              <span className="ml-auto flex items-center gap-3 text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" /> {counts.altered} alt.
                </span>
                <span className="inline-flex items-center gap-1">
                  <CircleDot className="w-3 h-3 text-amber-400" /> {counts.borderline} límite
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {counts.normal} normal
                </span>
              </span>
            </div>

            <div className="space-y-3">
              {visibleRows.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-xs font-bold text-slate-100">{item.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Rango: {item.normalRangeLabel}
                        {item.interpretation ? ` · ${item.interpretation}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-100 tabular-nums">
                        {item.measuredValue || "—"}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${statusChipClass(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                  <GaugeBar item={item} />
                </div>
              ))}
              {visibleRows.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-4">
                  No hay filas visibles con el filtro actual.
                </div>
              )}
            </div>

            {includeInReport && (
              <div className="flex items-center gap-2 text-[10px] text-blue-300/90 bg-blue-950/30 border border-blue-900/40 rounded-lg px-3 py-2">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                PDF:{" "}
                {includeNormalsInPdf
                  ? "anexo con normales + alteradas"
                  : "anexo solo con alteradas / límite"}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
