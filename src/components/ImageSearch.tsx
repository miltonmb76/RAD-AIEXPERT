import React, { useState } from "react";
import { Sparkles, Loader2, Image as ImageIcon, ArrowRightLeft } from "lucide-react";

interface ImageSearchProps {
  onExportToAnalysis?: (imageUrl: string, mimeType: string) => void;
}

export default function ImageSearch({ onExportToAnalysis }: ImageSearchProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);
    setImageUrl(null);

    try {
      const response = await fetch("/api/generate-medical-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (data.success) {
        setImageUrl(data.imageUrl);
      } else {
        setError(data.error || "Error al generar la imagen.");
      }
    } catch (err) {
      setError("Error de comunicación con el servidor.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 border-2 border-slate-850 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl -z-10" />

        <h2 className="text-xl font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-2.5">
          <ImageIcon className="w-6 h-6 text-indigo-400" />
          Generador de Imágenes Médicas (IA)
        </h2>
        <p className="text-slate-400 text-xs leading-relaxed max-w-2xl uppercase font-medium mb-5">
          Describe la imagen anatómica, patológica o de simulación diagnóstica que necesitas para tu estudio o explicación interactiva.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && prompt && !isGenerating) {
                handleGenerate();
              }
            }}
            placeholder="Ej: RX de tórax AP con consolidación lobar derecha sugerente de neumonía bacteriana..."
            className="flex-grow bg-slate-950/90 border-2 border-slate-800 rounded-2xl px-4 py-3.5 text-white text-xs focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder-slate-600 transition-all duration-300"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="bg-indigo-600 hover:bg-indigo-505 active:scale-97 text-white px-7 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-[0_4px_15px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none shrink-0"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generar Imagen
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/15 text-rose-400 p-4 rounded-2xl border border-rose-900/35 text-[11px] font-mono leading-relaxed text-left uppercase font-bold tracking-wide">
          ⚠️ {error}
        </div>
      )}

      {isGenerating && (
        <div className="bg-slate-900/40 border-2 border-slate-850 p-12 text-center rounded-3xl space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
              Generando imagen médica...
            </h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Gemini está sintetizando una simulación diagnóstica de alta resolución.
            </p>
          </div>
        </div>
      )}

      {imageUrl && !isGenerating && (
        <div className="bg-[#04060C]/95 border-2 border-slate-850 p-6 rounded-3xl shadow-[0_0_50px_rgba(99,102,241,0.06)] relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/2 rounded-full blur-3xl -z-10" />
          <img src={imageUrl} alt="Resultado IA" className="max-w-full md:max-w-xl rounded-2xl mx-auto shadow-2xl border border-slate-800 select-none" />
          <div className="mt-3.5 text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider mb-4">
            Imagen generada por síntesis neural diagnóstica (con fines formativos y de soporte ilustrativo).
          </div>
          
          {onExportToAnalysis && (
            <div className="flex justify-center border-t border-slate-850 pt-4 mt-2">
              <button
                onClick={() => onExportToAnalysis(imageUrl, "image/jpeg")}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-97 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-[0_4px_12px_rgba(16,185,129,0.2)] cursor-pointer select-none"
              >
                <ArrowRightLeft className="w-4 h-4 animate-pulse" />
                Exportar a Doble Valoración IA (Hacer Mediciones)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
