import React, { useState } from "react";
import { 
  Search, 
  Loader2, 
  BookOpenText, 
  ExternalLink, 
  GraduationCap, 
  Sparkles, 
  RotateCcw,
  Maximize2,
  Minimize2
} from "lucide-react";

interface BibliographySearchProps {
  renderElegantResponse: (text: string, accentColor?: string) => React.ReactNode;
}

export default function BibliographySearch({ renderElegantResponse }: BibliographySearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState("");
  const [sources, setSources] = useState<Array<{ uri: string; title: string; summary?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearch = async (overrideQuery?: string) => {
    const searchQuery = overrideQuery || query;
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setResults("");
    setSources([]);

    try {
      const response = await fetch("/api/search-bibliography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          report: searchQuery 
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.bibliography);
        setSources(data.sources || []);
      } else {
        setError(data.error || "Error al buscar bibliografía médica en la base de datos científica.");
      }
    } catch (err) {
      setError("Error de comunicación de datos con el servidor central de búsqueda.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleReset = () => {
    setQuery("");
    setResults("");
    setSources([]);
    setError(null);
    setActivePreset(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 🎓 HEADER DE LA SECCIÓN DE EDUCACIÓN MÉDICA CONTINUA */}
      <div className="bg-slate-900 border-2 border-slate-850 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/80 text-indigo-400 hover:text-indigo-300 border border-indigo-900/40 text-[10px] font-black uppercase tracking-widest rounded-xl font-mono">
              <GraduationCap className="w-3.5 h-3.5" />
              Educación Médica Continua & Retroalimentación Científica
            </div>
            <h2 className="text-xl font-extrabold text-white uppercase tracking-wider flex items-center gap-2.5">
              <BookOpenText className="w-6 h-6 text-indigo-400" />
              Buscador Bibliográfico Avanzado
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-2xl uppercase font-medium">
              Consulta en tiempo real artículos de PubMed, guías oficiales del ACR, consensos de Fleischner, Radiopaedia y publicaciones indexadas para sustentar diagnósticos, clasificaciones y pautas de seguimiento médico.
            </p>
          </div>
          {(results || query) && (
            <button
              onClick={handleReset}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all self-start cursor-pointer select-none font-mono"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Nueva Consulta
            </button>
          )}
        </div>

        {/* 🔍 INPUT DE BÚSQUEDA */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-grow">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (activePreset) setActivePreset(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query && !isSearching) {
                  handleSearch();
                }
              }}
              placeholder="Ej: ¿Cuáles son las pautas de seguimiento de un nódulo pancreático incidental de 1.5 cm?"
              className="w-full bg-slate-950/90 border-2 border-slate-800 rounded-2xl pl-4 pr-10 py-3.5 text-white text-xs focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder-slate-600 transition-all duration-300"
            />
            {query && (
              <button 
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1.5 font-sans font-black"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-97 text-white px-7 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-[0_4px_15px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none shrink-0"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar Literatura
          </button>
        </div>
      </div>

      {/* ⚠️ MENSAJE DE ERROR */}
      {error && (
        <div className="bg-rose-950/15 text-rose-400 p-4 rounded-2xl border border-rose-900/35 text-[11px] font-mono leading-relaxed text-left uppercase font-bold tracking-wide">
          ⚠️ {error}
        </div>
      )}

      {/* ⏳ ESTADO DE CARGA */}
      {isSearching && (
        <div className="bg-slate-900/40 border-2 border-slate-850 rounded-3xl p-12 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
              Buscando e indexando artículos médicos...
            </h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Realizando crawling en PubMed, Radiopaedia, guías del ACR y consensos internacionales recomendados.
            </p>
          </div>
        </div>
      )}

      {/* 📚 RESULTADOS DE LA BÚSQUEDA */}
      {results && !isSearching && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left animate-fade-in-up">
          {/* Main response panel */}
          <div className={isExpanded 
            ? "fixed inset-4 md:inset-10 z-50 bg-[#04060C]/98 backdrop-blur-2xl border-2 border-indigo-500/40 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col space-y-5 overflow-y-auto animate-fade-in"
            : "lg:col-span-8 bg-[#04060C]/95 border-2 border-slate-850 p-6 rounded-3xl shadow-2xl relative overflow-hidden space-y-5"
          }>
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/2 rounded-full blur-3xl -z-10" />
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest font-mono">
                  SÍNTESIS BIBLIOGRÁFICA Y RECOMENDACIÓN LITERARIA
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {activePreset && (
                  <span className="text-[8px] font-black uppercase font-mono bg-indigo-950 text-indigo-300 border border-indigo-900/40 px-2 py-0.5 rounded">
                    Preset: {activePreset}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsExpanded(p => !p)}
                  className={`p-1.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                    isExpanded
                      ? "bg-indigo-950/90 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/30"
                      : "bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-100"
                  }`}
                  title={isExpanded ? "Restaurar tamaño estándar de componente" : "Maximizar área de lectura (Modo Expandido)"}
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className={`prose prose-invert max-w-none text-slate-200 ${isExpanded ? "flex-1 overflow-y-auto pr-1" : ""}`}>
              {renderElegantResponse(results, "text-indigo-400")}
            </div>
          </div>

          {/* Right sidebar with Grounded source links and quick CME stats */}
          <div className="lg:col-span-4 space-y-6">
            {/* Grounded Sources list */}
            <div className="bg-gradient-to-b from-slate-900 to-[#050814]/80 border-2 border-slate-850 p-5 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.3)] space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-black text-slate-250 uppercase tracking-wider font-mono">
                  Enlaces Directos a Literatura Relacionada
                </h4>
              </div>

              {sources && sources.length > 0 ? (
                <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                  {sources.map((item, index) => (
                    <a
                      key={index}
                      href={item.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="block p-4 bg-slate-950/80 hover:bg-[#070c18] border-2 border-slate-850 hover:border-indigo-500/35 rounded-2xl transition-all duration-300 group relative shadow-md"
                    >
                      <div className="space-y-2.5">
                        <p className="text-[11px] font-extrabold text-slate-200 uppercase leading-snug tracking-wide group-hover:text-indigo-400 transition-colors">
                          {item.title || "Artículo Científico / Capítulo de Interés"}
                        </p>
                        
                        {item.summary && (
                          <p className="text-[10px] text-slate-400 font-medium normal-case leading-relaxed font-sans border-l-2 border-indigo-500/30 pl-2.5">
                            {item.summary}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-slate-500 group-hover:text-slate-400 transition-colors tracking-wider uppercase font-mono">
                          <BookOpenText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[220px]">{item.uri}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    No se recuperaron fuentes estructuradas directas.
                  </p>
                </div>
              )}
            </div>

            {/* Educational Continuous Training Pill */}
            <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border-2 border-indigo-950/55 rounded-3xl p-5 space-y-3 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 p-3 text-indigo-400/5">
                <GraduationCap className="w-16 h-16" />
              </div>
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Retroalimentación CME Activa
              </h4>
              <p className="text-[9.5px] font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                Aprovecha estos recursos de soporte científico para consolidar tu diagnóstico o compartir fundamentos académicos en tus informes. Diseñado por radiólogos para fomentar la medicina de alta calidad basada en evidencia.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
