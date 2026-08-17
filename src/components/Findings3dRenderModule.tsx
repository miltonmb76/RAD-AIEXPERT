import React, { useState } from "react";
import { 
  Box, 
  Sparkles, 
  X, 
  Check, 
  Loader2, 
  Download, 
  Trash2, 
  Edit3, 
  FileText, 
  Layers, 
  Eye, 
  Info, 
  RefreshCw, 
  CheckCircle2, 
  Image as ImageIcon,
  ChevronRight,
  Maximize2,
  Columns,
  Grid,
  ZoomIn,
  Compass,
  ShieldAlert,
  FlipHorizontal,
  Crosshair,
  Target,
  Activity,
  CheckCheck,
  Fingerprint,
  Lock
} from "lucide-react";

export const flipImageBase64 = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str) return resolve(base64Str);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        console.error("Error al voltear imagen en canvas:", e);
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
};

export interface Finding3dRender {
  id: string;
  sourceImageId?: string;
  sourceImageBase64?: string;
  render3dBase64: string;
  render3dMacroBase64?: string; // Optional for Dual perspective
  dualPerspective?: boolean;
  pdfLayout?: "triptych" | "grid2x2"; // Layout format choice for PDF
  title: string;
  findingDescription: string;
  explanation: string;
  anatomicalLocation?: string;
  renderStyle?: "volumetric_glass" | "anatomical_cross_section" | "holographic_medical" | "subsurface_organic";
  includeInPdf: boolean;
  createdAt: string;
  targetDigit?: string;
  targetJointLevel?: string;
  targetAspect?: string;
  specificAnatomicalUnit?: string;
  lateralityIdentified?: string;
  isTopographyAccurate?: boolean;
  isAnatomicalPositionCorrect?: boolean;
  focalWasFlipped?: boolean;
  anatomicalCoordinates?: {
    targetStructure?: string;
    exactAnatomicalLocation?: string;
    exactAnatomicalLocationEs?: string;
    cardinalLandmarks?: string[];
    cardinalLandmarksEs?: string[];
    prohibitedMisplacements?: string[];
    prohibitedMisplacementsEs?: string[];
    anatomicalAspect?: string;
    tissueLayerDepth?: string;
    isAnatomicalPositionCorrect?: boolean;
    depictedPosition?: string;
    anatomicalAuditLog?: string;
  };
}

export const DIGIT_OPTIONS = [
  { id: "auto", label: "Auto-detectar", short: "Auto", desc: "Detección inteligente" },
  { id: "1st_thumb", label: "1° Pulgar", short: "1° Pulgar", desc: "Primer dedo mano" },
  { id: "2nd_index", label: "2° Índice", short: "2° Índice", desc: "Segundo dedo mano" },
  { id: "3rd_middle", label: "3° Medio", short: "3° Medio", desc: "Tercer dedo mano" },
  { id: "4th_ring_finger", label: "4° Anular", short: "4° Anular", desc: "Cuarto dedo mano" },
  { id: "5th_little", label: "5° Meñique", short: "5° Meñique", desc: "Quinto dedo mano" },
  { id: "toe_1_hallux", label: "1° Ortejo (Hallux)", short: "Hallux", desc: "Primer dedo pie" },
  { id: "toe_2", label: "2° Ortejo", short: "2° Ortejo", desc: "Segundo dedo pie" },
  { id: "toe_3", label: "3° Ortejo", short: "3° Ortejo", desc: "Tercer dedo pie" },
  { id: "toe_4", label: "4° Ortejo", short: "4° Ortejo", desc: "Cuarto dedo pie" },
  { id: "toe_5", label: "5° Ortejo", short: "5° Ortejo", desc: "Quinto dedo pie" },
  { id: "none", label: "No es Dedo/Ortejo", short: "N/A", desc: "Estructura no digital" }
];

export const JOINT_OPTIONS = [
  { id: "auto", label: "Auto-detectar", short: "Auto", desc: "Detección inteligente" },
  { id: "DIP_distal_interphalangeal", label: "IFD (Interfalángica Distal)", short: "IFD (Distal)", desc: "Articulación distal subungueal" },
  { id: "PIP_proximal_interphalangeal", label: "IFP (Interfalángica Proximal)", short: "IFP (Media)", desc: "Articulación media" },
  { id: "MCP_metacarpophalangeal", label: "MCF (Metacarpofalángica)", short: "MCF (Nudillo)", desc: "Nudillo / base dedo" },
  { id: "IP_interphalangeal", label: "IF Pulgar (Interfalángica)", short: "IF Pulgar", desc: "Articulación única pulgar" },
  { id: "MTP_metatarsophalangeal", label: "MTF (Metatarsofalángica)", short: "MTF (Pie)", desc: "Articulación dedos pie" },
  { id: "insertion_enthesis", label: "Inserción / Entesis Distal", short: "Inserción Distal", desc: "Inserción tendinosa en falange" },
  { id: "diaphysis_shaft", label: "Diáfisis / Cuerpo Falange", short: "Diáfisis Falange", desc: "Cuerpo óseo falángico" },
  { id: "none", label: "No Aplica Nivel Articular", short: "N/A", desc: "Músculo / órgano continuo" }
];

export const ASPECT_OPTIONS = [
  { id: "auto", label: "Auto-detectar", short: "Auto", desc: "Detección inteligente" },
  { id: "volar_palmar_flexor", label: "Volar / Palmar (Flexor)", short: "Volar (Flexor)", desc: "Cara palmar, tendones flexores y poleas" },
  { id: "dorsal_extensor", label: "Dorsal (Extensor)", short: "Dorsal (Extensor)", desc: "Cara dorsal, aparato extensor y uñas" },
  { id: "radial_lateral", label: "Radial (Lateral)", short: "Radial", desc: "Borde externo radial" },
  { id: "ulnar_medial", label: "Cubital (Medial)", short: "Cubital", desc: "Borde interno cubital" },
  { id: "plantar", label: "Plantar", short: "Plantar", desc: "Planta del pie" },
  { id: "anterior", label: "Anterior", short: "Anterior", desc: "Cara anterior general" },
  { id: "posterior", label: "Posterior", short: "Posterior", desc: "Cara posterior general" },
  { id: "none", label: "No Aplica", short: "N/A", desc: "Circunferencial o profundo" }
];

export const getDigitLabel = (digitId?: string): string => {
  const match = DIGIT_OPTIONS.find(d => d.id === digitId);
  return match ? match.short : digitId || "";
};

export const getJointLabel = (jointId?: string): string => {
  const match = JOINT_OPTIONS.find(j => j.id === jointId);
  return match ? match.short : jointId || "";
};

export const getAspectLabel = (aspectId?: string): string => {
  const match = ASPECT_OPTIONS.find(a => a.id === aspectId);
  return match ? match.short : aspectId || "";
};

export const RENDER_STYLES = [
  {
    id: "volumetric_glass",
    name: "Volumétrico Cristal Orgánico",
    desc: "Corte anatómico limpio con materiales translúcidos, iluminación cromática e índice de refracción médica.",
    badge: "RECOMENDADO",
    color: "from-cyan-500/20 to-indigo-500/20 border-cyan-500/40 text-cyan-300"
  },
  {
    id: "anatomical_cross_section",
    name: "Corte Anatómico de Alta Fidelidad",
    desc: "Visualización volumétrica fotorrealista de capas tisulares, bordes y relaciones de vecindad.",
    badge: "ANATÓMICO",
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300"
  },
  {
    id: "holographic_medical",
    name: "Holograma Clínico 3D (HUD)",
    desc: "Estilo quirúrgico digital futurista con vectores de profundidad y realce de lesiones en cian/ámbar.",
    badge: "DIGITAL",
    color: "from-blue-500/20 to-purple-500/20 border-blue-500/40 text-blue-300"
  },
  {
    id: "subsurface_organic",
    name: "Dispersión Subsuperficial Orgánica",
    desc: "Realismo de matriz tisular suave para diferenciar quistes, ecos internos y cápsulas de nódulos.",
    badge: "TISULAR",
    color: "from-amber-500/20 to-rose-500/20 border-amber-500/40 text-amber-300"
  }
];

interface Findings3dRenderModuleProps {
  renders: Finding3dRender[];
  onToggleIncludeInPdf: (id: string) => void;
  onDeleteRender: (id: string) => void;
  onUpdateRender: (updated: Finding3dRender) => void;
  onOpenCreateModal: (sourceImage?: any, initialFinding?: string) => void;
}

export const Findings3dRenderModule: React.FC<Findings3dRenderModuleProps> = ({
  renders,
  onToggleIncludeInPdf,
  onDeleteRender,
  onUpdateRender,
  onOpenCreateModal
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const handleFlipFocal = async (item: Finding3dRender) => {
    const flipped = await flipImageBase64(item.render3dBase64);
    onUpdateRender({
      ...item,
      render3dBase64: flipped
    });
  };

  const handleFlipMacro = async (item: Finding3dRender) => {
    if (!item.render3dMacroBase64) return;
    const flipped = await flipImageBase64(item.render3dMacroBase64);
    onUpdateRender({
      ...item,
      render3dMacroBase64: flipped
    });
  };

  const startEditing = (item: Finding3dRender) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditExplanation(item.explanation);
  };

  const saveEditing = (item: Finding3dRender) => {
    onUpdateRender({
      ...item,
      title: editTitle.trim() || item.title,
      explanation: editExplanation.trim() || item.explanation
    });
    setEditingId(null);
  };

  const downloadImage = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="my-6 p-5 sm:p-6 bg-slate-900/80 border-2 border-cyan-500/30 rounded-3xl shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-950 to-indigo-950 border border-cyan-500/50 rounded-2xl text-cyan-400 shadow-lg shadow-cyan-950/50 shrink-0">
            <Box className="h-6 w-6 animate-pulse text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-100 uppercase tracking-wider font-mono">
                Representación Esquemática 3D del Hallazgo
              </h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-amber-400" /> ILUSTRACIÓN VOLUMÉTRICA DUAL
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Transformación multimodal de ultrasonidos 2D a ilustraciones 3D fotorrealistas con perspectiva focal y panorámica regional.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenCreateModal()}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 flex items-center gap-2 cursor-pointer transition-all shrink-0"
        >
          <Sparkles className="h-4 w-4 text-amber-300" />
          <span>Generar Nuevo Render 3D</span>
        </button>
      </div>

      {/* Content: List of Renders */}
      {renders.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-slate-900 rounded-full text-slate-500">
            <Box className="h-8 w-8 text-cyan-400/50" />
          </div>
          <div className="max-w-md space-y-1">
            <p className="text-sm font-bold text-slate-300">
              No hay ilustraciones 3D generadas aún para este estudio
            </p>
            <p className="text-xs text-slate-500">
              Puedes hacer clic en el botón <strong className="text-cyan-400">"Render 3D del Hallazgo"</strong> situado en cualquier captura ecográfica cargada, o pulsar en el botón superior para crear una a partir de tu descripción clínica con vista focal o dual.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenCreateModal()}
            className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Crear Primera Ilustración 3D</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {renders.map((item, idx) => {
            const isEditing = editingId === item.id;
            const isDual = !!item.render3dMacroBase64;
            const currentLayout = item.pdfLayout || "triptych";

            return (
              <div
                key={item.id}
                className="bg-slate-950/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 sm:p-5 transition-all shadow-xl space-y-4"
              >
                {/* Card Top Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded-md text-[10px] font-mono font-bold">
                      RENDER #{idx + 1}
                    </span>
                    {isDual && (
                      <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-500/40 rounded-md text-[9px] font-mono font-bold flex items-center gap-1">
                        <Compass className="h-3 w-3 text-cyan-400" /> VISTA DUAL (FOCAL + MACRO)
                      </span>
                    )}
                    {(item.targetDigit || item.targetJointLevel || item.targetAspect) && (
                      <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-md text-[9px] font-mono font-bold flex items-center gap-1">
                        <Target className="h-2.5 w-2.5 text-emerald-400" />
                        <span>
                          {[
                            item.targetDigit ? getDigitLabel(item.targetDigit) : null,
                            item.targetJointLevel ? getJointLabel(item.targetJointLevel) : null,
                            item.targetAspect ? getAspectLabel(item.targetAspect) : null
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    )}
                    {item.isTopographyAccurate && (
                      <span className="px-1.5 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 rounded text-[8px] font-mono flex items-center gap-1">
                        <CheckCheck className="h-2.5 w-2.5 text-cyan-400" /> Topografía Auditada
                      </span>
                    )}
                    <h4 className="text-sm font-bold text-slate-100">
                      {item.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap self-end sm:self-auto">
                    {/* PDF Layout Selector (if Dual) */}
                    {isDual && (
                      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => onUpdateRender({ ...item, pdfLayout: "triptych" })}
                          className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            currentLayout === "triptych"
                              ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Diseño A: Tríptico Horizontal (3 columnas alineadas)"
                        >
                          <Columns className="h-3 w-3" />
                          <span>Tríptico</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onUpdateRender({ ...item, pdfLayout: "grid2x2" })}
                          className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            currentLayout === "grid2x2"
                              ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Diseño B: Cuadrícula 2x2 (con cuadro explicativo lateral)"
                        >
                          <Grid className="h-3 w-3" />
                          <span>Cuadrícula 2x2</span>
                        </button>
                      </div>
                    )}

                    {/* PDF Toggle */}
                    <button
                      type="button"
                      onClick={() => onToggleIncludeInPdf(item.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border ${
                        item.includeInPdf
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-sm"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                      title={item.includeInPdf ? "Se incluirá en el PDF del informe" : "No se incluirá en el PDF"}
                    >
                      <CheckCircle2 className={`h-3 w-3 ${item.includeInPdf ? "text-emerald-400" : "text-slate-600"}`} />
                      <span>{item.includeInPdf ? "En PDF: Sí" : "En PDF: No"}</span>
                    </button>

                    {/* Download Focal */}
                    <button
                      type="button"
                      onClick={() => downloadImage(item.render3dBase64, `render_3d_focal_${item.id}.png`)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer"
                      title="Descargar Render 3D Focal (PNG)"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>

                    {/* Download Macro if exists */}
                    {item.render3dMacroBase64 && (
                      <button
                        type="button"
                        onClick={() => downloadImage(item.render3dMacroBase64!, `render_3d_macro_${item.id}.png`)}
                        className="p-1.5 bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 rounded-lg border border-indigo-800 transition-all cursor-pointer"
                        title="Descargar Render 3D Panorámico Macro (PNG)"
                      >
                        <Compass className="h-3.5 w-3.5 text-cyan-400" />
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => (isEditing ? saveEditing(item) : startEditing(item))}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer"
                      title={isEditing ? "Guardar cambios" : "Editar texto de la ilustración"}
                    >
                      {isEditing ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Edit3 className="h-3.5 w-3.5" />}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDeleteRender(item.id)}
                      className="p-1.5 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-800 hover:border-rose-900/50 transition-all cursor-pointer"
                      title="Eliminar render"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Visual Panels: Dual 3-Column or Single 2-Column */}
                <div className={`grid grid-cols-1 ${isDual ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3.5`}>
                  {/* Panel 1: 2D Source Image */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <ImageIcon className="h-3 w-3 text-indigo-400" /> 1. Ecografía 2D
                      </span>
                      <span className="text-[8px] text-slate-500">Corte Original</span>
                    </div>

                    <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-slate-850 flex items-center justify-center group">
                      {item.sourceImageBase64 ? (
                        <>
                          <img
                            src={item.sourceImageBase64}
                            alt="Ecografía 2D"
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setZoomImage(item.sourceImageBase64 || null)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                          >
                            <Maximize2 className="h-5 w-5 text-white" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-3 text-slate-600 text-xs font-mono">
                          Descripción clínica
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-300 bg-slate-950/60 p-1.5 rounded-lg border border-slate-850 truncate">
                      <span className="font-bold text-slate-400 font-mono text-[8px] uppercase block">Hallazgo:</span>
                      <span className="truncate block">{item.findingDescription}</span>
                    </div>
                  </div>

                  {/* Panel 2: 3D Focal Render */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-cyan-500/30 flex flex-col justify-between gap-2 shadow-lg shadow-cyan-950/30">
                    <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Box className="h-3 w-3 text-cyan-400" /> 2. 3D Focal (Detalle)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFlipFocal(item)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-[9px] font-mono text-cyan-200 rounded transition-all cursor-pointer shadow-sm hover:border-cyan-400"
                          title="Invertir orientación anatómica / Voltear lado horizontalmente (Flip ↔)"
                        >
                          <FlipHorizontal className="h-2.5 w-2.5 text-cyan-400" />
                          <span>Invertir Lado ↔</span>
                        </button>
                        <span className="px-1.5 py-0.2 bg-cyan-950 border border-cyan-500/40 text-[8px] rounded text-cyan-200">
                          {item.renderStyle || "Volumétrico"}
                        </span>
                      </div>
                    </div>

                    <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-cyan-500/40 flex items-center justify-center group shadow-inner">
                      <img
                        src={item.render3dBase64}
                        alt="3D Focal"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setZoomImage(item.render3dBase64)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <Maximize2 className="h-5 w-5 text-cyan-200" />
                      </button>
                    </div>

                    <div className="text-[10px] text-cyan-200 bg-cyan-950/40 p-1.5 rounded-lg border border-cyan-500/20 text-center font-mono flex items-center justify-between px-2">
                      <span>Corte tisular y morfología fina</span>
                      <button
                        type="button"
                        onClick={() => handleFlipFocal(item)}
                        className="text-[9px] text-cyan-400 hover:text-cyan-200 underline font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <FlipHorizontal className="h-2.5 w-2.5" /> Voltear L/R
                      </button>
                    </div>
                  </div>

                  {/* Panel 3: 3D Macro Panoramic Render (if Dual) */}
                  {isDual && (
                    <div className="bg-slate-900/90 rounded-xl p-3 border border-indigo-500/40 flex flex-col justify-between gap-2 shadow-lg shadow-indigo-950/30">
                      <div className="flex items-center justify-between text-[10px] font-mono text-indigo-300 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Compass className="h-3 w-3 text-indigo-400" /> 3. 3D Panorámico (Macro)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleFlipMacro(item)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-[9px] font-mono text-indigo-200 rounded transition-all cursor-pointer shadow-sm hover:border-indigo-400"
                            title="Invertir orientación anatómica / Voltear lado horizontalmente (Flip ↔)"
                          >
                            <FlipHorizontal className="h-2.5 w-2.5 text-indigo-400" />
                            <span>Invertir Lado ↔</span>
                          </button>
                          <span className="px-1.5 py-0.2 bg-indigo-950 border border-indigo-500/40 text-[8px] rounded text-indigo-200">
                            Topográfico
                          </span>
                        </div>
                      </div>

                      <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-indigo-500/40 flex items-center justify-center group shadow-inner">
                        <img
                          src={item.render3dMacroBase64}
                          alt="3D Macro Panorámico"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setZoomImage(item.render3dMacroBase64 || null)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                        >
                          <Maximize2 className="h-5 w-5 text-indigo-200" />
                        </button>
                      </div>

                      <div className="text-[10px] text-indigo-200 bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-500/20 text-center font-mono flex items-center justify-between px-2">
                        <span>Ubicación regional y relaciones</span>
                        <button
                          type="button"
                          onClick={() => handleFlipMacro(item)}
                          className="text-[9px] text-indigo-400 hover:text-indigo-200 underline font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <FlipHorizontal className="h-2.5 w-2.5" /> Voltear L/R
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Explanation & Interpretation Text */}
                <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-indigo-400" /> Interpretación Anatómica y Correlación 3D
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="h-2.5 w-2.5" /> Editar texto
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-[9px] font-mono text-slate-500 block mb-1">Título del Render:</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg focus:border-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-slate-500 block mb-1">Explicación Clínica para el Informe / PDF:</label>
                        <textarea
                          rows={4}
                          value={editExplanation}
                          onChange={(e) => setEditExplanation(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs p-3 rounded-lg focus:border-cyan-500 outline-none resize-y font-sans leading-relaxed"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 text-xs rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditing(item)}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="h-3 w-3" /> Guardar Texto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-normal">
                        {item.explanation}
                      </div>

                      {item.anatomicalCoordinates && (
                        <div className="mt-2.5 p-2.5 bg-slate-950/80 rounded-lg border border-cyan-900/40 text-[10px] font-mono space-y-1">
                          <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-slate-800/80 pb-1">
                            <span className="flex items-center gap-1.5">
                              <Target className="h-3 w-3 text-emerald-400" /> Grounding y Coordenadas Anatómicas Consultadas
                            </span>
                            <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              ✓ Posición Auditada
                            </span>
                          </div>
                          {item.anatomicalCoordinates.exactAnatomicalLocationEs && (
                            <div className="text-slate-300">
                              <strong className="text-slate-400 font-semibold">Ubicación Anatómica Exacta: </strong>
                              <span className="text-cyan-200">{item.anatomicalCoordinates.exactAnatomicalLocationEs}</span>
                            </div>
                          )}
                          {item.anatomicalCoordinates.cardinalLandmarksEs && item.anatomicalCoordinates.cardinalLandmarksEs.length > 0 && (
                            <div className="text-slate-400">
                              <strong className="text-slate-400 font-semibold">Hitos de Anclaje: </strong>
                              <span className="text-slate-300">{item.anatomicalCoordinates.cardinalLandmarksEs.join(" · ")}</span>
                            </div>
                          )}
                          {item.anatomicalCoordinates.prohibitedMisplacementsEs && item.anatomicalCoordinates.prohibitedMisplacementsEs.length > 0 && (
                            <div className="text-slate-400">
                              <strong className="text-rose-400/90 font-semibold">Zonas Excluidas Prohibidas: </strong>
                              <span className="text-slate-400 line-through decoration-rose-500/60">{item.anatomicalCoordinates.prohibitedMisplacementsEs.join(" · ")}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full px-2">
              <button
                type="button"
                onClick={async () => {
                  const flipped = await flipImageBase64(zoomImage);
                  setZoomImage(flipped);
                }}
                className="px-3 py-1.5 bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
              >
                <FlipHorizontal className="h-4 w-4 text-cyan-400" />
                <span>Invertir Lado en Vista Ampliada ↔</span>
              </button>

              <button
                onClick={() => setZoomImage(null)}
                className="p-2 bg-slate-900/80 text-white rounded-full hover:bg-rose-600 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={zoomImage}
              alt="Zoom"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-slate-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface Create3dRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachedImages: any[];
  sourceImage?: any;
  initialFinding?: string;
  studyType: string;
  clinicalHistory: string;
  onSaveRender: (renderObj: Finding3dRender) => void;
}

export const Create3dRenderModal: React.FC<Create3dRenderModalProps> = ({
  isOpen,
  onClose,
  attachedImages,
  sourceImage,
  initialFinding = "",
  studyType,
  clinicalHistory,
  onSaveRender
}) => {
  const [selectedImgId, setSelectedImgId] = useState<string>(sourceImage?.id || (attachedImages[0]?.id || ""));
  const [findingDesc, setFindingDesc] = useState<string>(initialFinding || sourceImage?.caption || "");
  const [anatomicalLocation, setAnatomicalLocation] = useState<string>(studyType || "");
  const [renderStyle, setRenderStyle] = useState<string>("volumetric_glass");
  const [dualPerspective, setDualPerspective] = useState<boolean>(true);
  const [laterality, setLaterality] = useState<"auto" | "right" | "left" | "midline">("auto");
  const [targetDigit, setTargetDigit] = useState<string>("auto");
  const [targetJointLevel, setTargetJointLevel] = useState<string>("auto");
  const [targetAspect, setTargetAspect] = useState<string>("auto");
  const [specificAnatomicalUnit, setSpecificAnatomicalUnit] = useState<string>("");
  const [pdfLayout, setPdfLayout] = useState<"triptych" | "grid2x2">("triptych");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [generatedResult, setGeneratedResult] = useState<Finding3dRender | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFlipPreviewFocal = async () => {
    if (!generatedResult) return;
    const flipped = await flipImageBase64(generatedResult.render3dBase64);
    setGeneratedResult({
      ...generatedResult,
      render3dBase64: flipped
    });
  };

  const handleFlipPreviewMacro = async () => {
    if (!generatedResult || !generatedResult.render3dMacroBase64) return;
    const flipped = await flipImageBase64(generatedResult.render3dMacroBase64);
    setGeneratedResult({
      ...generatedResult,
      render3dMacroBase64: flipped
    });
  };

  // Real-time laterality detection from text
  const detectedLaterality = React.useMemo(() => {
    const text = `${findingDesc} ${studyType} ${clinicalHistory} ${anatomicalLocation}`.toLowerCase();
    const hasRight = /\b(derech[ao]s?|der\b|dcha\b|dcho\b|right\b|rt\b|l[oó]bulo derecho|riñ[oó]n derecho|mama derecha|hombro derecho|rodilla derecha|muslo derecho|pierna derecha|brazo derecho|test[ií]culo derecho|ovario derecho)\b/i.test(text);
    const hasLeft = /\b(izquierd[ao]s?|izq\b|izda\b|left\b|lt\b|l[oó]bulo izquierdo|riñ[oó]n izquierdo|mama izquierda|hombro izquierdo|rodilla izquierda|muslo izquierdo|pierna izquierda|brazo izquierdo|test[ií]culo izquierdo|ovario izquierdo)\b/i.test(text);
    if (hasRight && !hasLeft) return "right";
    if (hasLeft && !hasRight) return "left";
    if (hasRight && hasLeft) return "bilateral";
    return "unspecified";
  }, [findingDesc, studyType, clinicalHistory, anatomicalLocation]);

  // Real-time digit detection from text
  const detectedDigit = React.useMemo(() => {
    const text = `${findingDesc} ${studyType} ${clinicalHistory} ${anatomicalLocation}`.toLowerCase();
    if (/\b(4to|4º|cuarto|anular|ring finger|4th digit|cuarto dedo)\b/i.test(text)) return "4th_ring_finger";
    if (/\b(3er|3º|tercer|medio|coraz[oó]n|middle finger|3rd digit|tercer dedo)\b/i.test(text)) return "3rd_middle";
    if (/\b(2do|2º|segundo|[ií]ndice|index finger|2nd digit|segundo dedo)\b/i.test(text)) return "2nd_index";
    if (/\b(1er|1º|primer|pulgar|thumb|1st digit|primer dedo)\b/i.test(text)) return "1st_thumb";
    if (/\b(5to|5º|quinto|meñique|auricular|little finger|pinky|5th digit|quinto dedo)\b/i.test(text)) return "5th_little";
    if (/\b(hallux|primer ort[eé]jo|1er ort[eé]jo)\b/i.test(text)) return "toe_1_hallux";
    if (/\b(segundo ort[eé]jo|2do ort[eé]jo)\b/i.test(text)) return "toe_2";
    if (/\b(tercer ort[eé]jo|3er ort[eé]jo)\b/i.test(text)) return "toe_3";
    if (/\b(cuarto ort[eé]jo|4to ort[eé]jo)\b/i.test(text)) return "toe_4";
    if (/\b(quinto ort[eé]jo|5to ort[eé]jo)\b/i.test(text)) return "toe_5";
    return undefined;
  }, [findingDesc, studyType, clinicalHistory, anatomicalLocation]);

  // Real-time joint level detection from text
  const detectedJoint = React.useMemo(() => {
    const text = `${findingDesc} ${studyType} ${clinicalHistory} ${anatomicalLocation}`.toLowerCase();
    if (/\b(ifd|interfal[aá]ngica distal|dip\b|distal interphalangeal|falange distal|subungueal)\b/i.test(text)) return "DIP_distal_interphalangeal";
    if (/\b(ifp|interfal[aá]ngica proximal|pip\b|proximal interphalangeal|falange media)\b/i.test(text)) return "PIP_proximal_interphalangeal";
    if (/\b(mcf|metacarpofal[aá]ngica|mcp\b|metacarpophalangeal|nudillo|cabeza metacarpiano)\b/i.test(text)) return "MCP_metacarpophalangeal";
    if (/\b(if\b|interfal[aá]ngica del pulgar)\b/i.test(text)) return "IP_interphalangeal";
    if (/\b(mtf|metatarsofal[aá]ngica|mtp\b)\b/i.test(text)) return "MTP_metatarsophalangeal";
    if (/\b(entesis|inserci[oó]n distal|inserci[oó]n tendinosa|avulsi[oó]n)\b/i.test(text)) return "insertion_enthesis";
    if (/\b(di[aá]fisis|cuerpo fal[aá]ngico)\b/i.test(text)) return "diaphysis_shaft";
    return undefined;
  }, [findingDesc, studyType, clinicalHistory, anatomicalLocation]);

  // Real-time aspect detection from text
  const detectedAspect = React.useMemo(() => {
    const text = `${findingDesc} ${studyType} ${clinicalHistory} ${anatomicalLocation}`.toLowerCase();
    if (/\b(volar|palmar|flexor|flexora|polea|a1|a2|a4|profundo de los dedos|superficial de los dedos)\b/i.test(text)) return "volar_palmar_flexor";
    if (/\b(dorsal|extensor|extensora|bandeleta|aparato extensor)\b/i.test(text)) return "dorsal_extensor";
    if (/\b(radial|lateral|colateral radial)\b/i.test(text)) return "radial_lateral";
    if (/\b(cubital|ulnar|medial|colateral cubital)\b/i.test(text)) return "ulnar_medial";
    if (/\b(plantar|fascia plantar)\b/i.test(text)) return "plantar";
    if (/\b(anterior)\b/i.test(text)) return "anterior";
    if (/\b(posterior)\b/i.test(text)) return "posterior";
    return undefined;
  }, [findingDesc, studyType, clinicalHistory, anatomicalLocation]);

  const effectiveDigit = targetDigit === "auto" ? detectedDigit : (targetDigit === "none" ? undefined : targetDigit);
  const effectiveJoint = targetJointLevel === "auto" ? detectedJoint : (targetJointLevel === "none" ? undefined : targetJointLevel);
  const effectiveAspect = targetAspect === "auto" ? detectedAspect : (targetAspect === "none" ? undefined : targetAspect);

  // Sync initial values when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (sourceImage) {
        setSelectedImgId(sourceImage.id);
        setFindingDesc(sourceImage.caption || initialFinding || "");
      } else if (attachedImages.length > 0 && !selectedImgId) {
        setSelectedImgId(attachedImages[0].id);
        setFindingDesc(attachedImages[0].caption || initialFinding || "");
      }
      setGeneratedResult(null);
      setErrorMessage(null);
      setIsGenerating(false);
    }
  }, [isOpen, sourceImage]);

  const activeImageObj = attachedImages.find(img => img.id === selectedImgId) || sourceImage;

  const handleExecuteGeneration = async () => {
    if (!findingDesc.trim() && !activeImageObj) {
      setErrorMessage("Por favor describe el hallazgo o selecciona una imagen ecográfica.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setProgressStep("1/3: Analizando semiología ecográfica y topografía quirúrgica exacta...");

    try {
      setTimeout(() => {
        setProgressStep(
          dualPerspective
            ? "2/3: Generando render focal aislado y vista macro regional con auditoría de lateralidad..."
            : "2/3: Construyendo corte anatómico volumétrico de alta precisión..."
        );
      }, 2500);

      setTimeout(() => {
        setProgressStep("3/3: Auditando fidelidad anatómica y corrigiendo orientación (Gemini Vision Auditor)...");
      }, 6500);

      const resp = await fetch("/api/generate-3d-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: activeImageObj?.base64 || undefined,
          mimeType: activeImageObj?.base64?.includes("image/png") ? "image/png" : "image/jpeg",
          findingDescription: findingDesc,
          studyType,
          clinicalHistory,
          anatomicalLocation,
          renderStyle,
          customInstructions,
          dualPerspective,
          laterality,
          targetDigit: effectiveDigit,
          targetJointLevel: effectiveJoint,
          targetAspect: effectiveAspect,
          specificAnatomicalUnit: specificAnatomicalUnit.trim() || undefined
        })
      });

      const data = await resp.json();
      if (data.success && data.render3dBase64) {
        const newRender: Finding3dRender = {
          id: Math.random().toString(36).substring(2, 11),
          sourceImageId: activeImageObj?.id,
          sourceImageBase64: activeImageObj?.base64 || activeImageObj?.url,
          render3dBase64: data.render3dBase64,
          render3dMacroBase64: data.render3dMacroBase64,
          dualPerspective: data.dualPerspective,
          pdfLayout: pdfLayout,
          title: data.title || `Representación 3D: ${findingDesc.slice(0, 35)}`,
          findingDescription: findingDesc,
          explanation: data.explanation || "",
          anatomicalLocation,
          renderStyle: renderStyle as any,
          includeInPdf: true,
          createdAt: new Date().toISOString(),
          targetDigit: data.digitIdentified || effectiveDigit,
          targetJointLevel: data.jointIdentified || effectiveJoint,
          targetAspect: effectiveAspect,
          specificAnatomicalUnit: specificAnatomicalUnit.trim() || undefined,
          lateralityIdentified: data.lateralityIdentified,
          isTopographyAccurate: data.isTopographyAccurate,
          isAnatomicalPositionCorrect: data.isAnatomicalPositionCorrect,
          focalWasFlipped: data.focalWasFlipped,
          anatomicalCoordinates: data.anatomicalCoordinates
        };
        setGeneratedResult(newRender);
      } else {
        setErrorMessage(data.error || "Ocurrió un error al generar la ilustración 3D.");
      }
    } catch (err: any) {
      console.error("Error generating 3D render:", err);
      setErrorMessage(err?.message || "Fallo de conexión con el servidor al generar la ilustración 3D.");
    } finally {
      setIsGenerating(false);
      setProgressStep("");
    }
  };

  const handleConfirmAndSave = () => {
    if (!generatedResult) return;
    onSaveRender({
      ...generatedResult,
      pdfLayout: pdfLayout
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl text-slate-100 space-y-5 my-auto max-h-[92vh] flex flex-col justify-between">
        
        {/* Modal Top Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-950 to-indigo-950 border border-cyan-500/50 rounded-2xl text-cyan-300">
              <Box className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider font-mono text-slate-100 flex items-center gap-2">
                Generador de Ilustración 3D de Hallazgos
                <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                  <Target className="h-2.5 w-2.5 text-emerald-400" /> ALTA PRECISIÓN ANATÓMICA
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Renderizado volumétrico guiado por restricciones topográficas estrictas y auditoría de lateralidad.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto pr-1 space-y-4 max-h-[62vh]">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <X className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {generatedResult ? (
            /* PREVIEW OF GENERATED RESULT */
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center justify-between font-mono flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">¡Ilustración 3D generada y auditada!</span>
                  {(generatedResult.targetDigit || generatedResult.targetJointLevel) && (
                    <span className="px-2 py-0.5 bg-emerald-900/60 text-emerald-200 border border-emerald-500/40 rounded text-[9px]">
                      🎯 {[
                        generatedResult.targetDigit ? getDigitLabel(generatedResult.targetDigit) : null,
                        generatedResult.targetJointLevel ? getJointLabel(generatedResult.targetJointLevel) : null,
                        generatedResult.targetAspect ? getAspectLabel(generatedResult.targetAspect) : null
                      ].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {generatedResult.focalWasFlipped && (
                    <span className="px-2 py-0.5 bg-cyan-900/60 text-cyan-200 border border-cyan-500/40 rounded text-[9px]">
                      ↔ Lateralidad Corregida
                    </span>
                  )}
                </div>

                {generatedResult.render3dMacroBase64 && (
                  <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400">Diseño PDF:</span>
                    <button
                      type="button"
                      onClick={() => setPdfLayout("triptych")}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        pdfLayout === "triptych" ? "bg-cyan-600 text-white" : "text-slate-400"
                      }`}
                    >
                      Tríptico (3 Col)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfLayout("grid2x2")}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        pdfLayout === "grid2x2" ? "bg-cyan-600 text-white" : "text-slate-400"
                      }`}
                    >
                      Cuadrícula 2x2
                    </button>
                  </div>
                )}
              </div>

              {/* Side-by-Side (or 3-panel) Result */}
              <div className={`grid grid-cols-1 ${generatedResult.render3dMacroBase64 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3.5`}>
                {/* 2D Original */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                    1. Ecografía 2D
                  </span>
                  <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-850 flex items-center justify-center">
                    {generatedResult.sourceImageBase64 ? (
                      <img
                        src={generatedResult.sourceImageBase64}
                        alt="2D"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Sin imagen 2D</span>
                    )}
                  </div>
                </div>

                {/* 3D Focal */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-cyan-500/40 space-y-2 shadow-lg shadow-cyan-950/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-400" /> 2. 3D Focal
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleFlipPreviewFocal}
                        className="flex items-center gap-1 px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-[9px] font-mono text-cyan-200 rounded transition-all cursor-pointer shadow-sm hover:border-cyan-400"
                        title="Invertir orientación anatómica / Voltear lado horizontalmente (Flip ↔)"
                      >
                        <FlipHorizontal className="h-2.5 w-2.5 text-cyan-400" />
                        <span>Invertir Lado ↔</span>
                      </button>
                      <span className="text-[8px] bg-cyan-950 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono">
                        Detalle Fino
                      </span>
                    </div>
                  </div>
                  <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden border border-cyan-500/40 flex items-center justify-center">
                    <img
                      src={generatedResult.render3dBase64}
                      alt={generatedResult.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleFlipPreviewFocal}
                      className="text-[9.5px] text-cyan-400 hover:text-cyan-200 underline font-mono flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <FlipHorizontal className="h-2.5 w-2.5" /> Voltear Lado (L/R)
                    </button>
                  </div>
                </div>

                {/* 3D Macro (if Dual) */}
                {generatedResult.render3dMacroBase64 && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-indigo-500/40 space-y-2 shadow-lg shadow-indigo-950/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase flex items-center gap-1">
                        <Compass className="h-3 w-3 text-cyan-400" /> 3. 3D Panorámico
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleFlipPreviewMacro}
                          className="flex items-center gap-1 px-2 py-0.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-[9px] font-mono text-indigo-200 rounded transition-all cursor-pointer shadow-sm hover:border-indigo-400"
                          title="Invertir orientación anatómica / Voltear lado horizontalmente (Flip ↔)"
                        >
                          <FlipHorizontal className="h-2.5 w-2.5 text-indigo-400" />
                          <span>Invertir Lado ↔</span>
                        </button>
                        <span className="text-[8px] bg-indigo-950 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono">
                          Macro Región
                        </span>
                      </div>
                    </div>
                    <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden border border-indigo-500/40 flex items-center justify-center">
                      <img
                        src={generatedResult.render3dMacroBase64}
                        alt="3D Macro"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleFlipPreviewMacro}
                        className="text-[9.5px] text-indigo-400 hover:text-indigo-200 underline font-mono flex items-center justify-center gap-1 mx-auto cursor-pointer"
                      >
                        <FlipHorizontal className="h-2.5 w-2.5" /> Voltear Lado (L/R)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Editable Fields in Result */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                    Título de la Ilustración:
                  </label>
                  <input
                    type="text"
                    value={generatedResult.title}
                    onChange={(e) => setGeneratedResult({ ...generatedResult, title: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                    Explicación Clínica e Interpretación Anatómica (para el Informe y PDF):
                  </label>
                  <textarea
                    rows={4}
                    value={generatedResult.explanation}
                    onChange={(e) => setGeneratedResult({ ...generatedResult, explanation: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs p-3 rounded-xl focus:border-cyan-500 outline-none resize-y leading-relaxed"
                  />
                </div>

                {generatedResult.anatomicalCoordinates && (
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-cyan-500/30 text-[10px] font-mono space-y-1.5 shadow-inner">
                    <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-slate-800 pb-1">
                      <span className="flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-emerald-400" /> Grounding y Validación Anatómica Pre-Dibujo
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                        ✓ Coordenadas Validadas por IA
                      </span>
                    </div>
                    {generatedResult.anatomicalCoordinates.exactAnatomicalLocationEs && (
                      <div className="text-slate-300">
                        <strong className="text-slate-400 font-semibold">Ubicación Quirúrgica: </strong>
                        <span className="text-cyan-200">{generatedResult.anatomicalCoordinates.exactAnatomicalLocationEs}</span>
                      </div>
                    )}
                    {generatedResult.anatomicalCoordinates.cardinalLandmarksEs && generatedResult.anatomicalCoordinates.cardinalLandmarksEs.length > 0 && (
                      <div className="text-slate-400">
                        <strong className="text-slate-400 font-semibold">Hitos Anatómicos de Anclaje: </strong>
                        <span className="text-slate-300">{generatedResult.anatomicalCoordinates.cardinalLandmarksEs.join(" · ")}</span>
                      </div>
                    )}
                    {generatedResult.anatomicalCoordinates.prohibitedMisplacementsEs && generatedResult.anatomicalCoordinates.prohibitedMisplacementsEs.length > 0 && (
                      <div className="text-slate-400">
                        <strong className="text-rose-400 font-semibold">Zonas Erróneas Prohibidas Excluidas: </strong>
                        <span className="text-slate-400 line-through decoration-rose-500/60">{generatedResult.anatomicalCoordinates.prohibitedMisplacementsEs.join(" · ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* CONFIGURATION FORM */
            <div className="space-y-4">
              {/* Select Source Image if available */}
              {attachedImages.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">
                    Seleccionar Captura de Ecografía 2D:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {attachedImages.map((img, idx) => {
                      const isSelected = selectedImgId === img.id;
                      return (
                        <div
                          key={img.id}
                          onClick={() => {
                            setSelectedImgId(img.id);
                            if (img.caption && !findingDesc) {
                              setFindingDesc(img.caption);
                            }
                          }}
                          className={`p-2 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                            isSelected
                              ? "bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-500/40"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <div className="aspect-[4/3] bg-black rounded-lg overflow-hidden">
                            <img src={img.url || img.base64} alt={img.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="text-[9px] font-mono truncate text-slate-300 font-bold">
                            Figura {idx + 1}: {img.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center justify-between">
                  <span>Descripción del Hallazgo Ecográfico (Obligatorio):</span>
                  <span className="text-[9px] text-cyan-400 font-normal">Describe estructura, fibras/parénquima, márgenes y ubicación</span>
                </label>
                <textarea
                  rows={2}
                  value={findingDesc}
                  onChange={(e) => setFindingDesc(e.target.value)}
                  placeholder="Ej: Lesión tendinosa flexora en el cuarto dedo sobre articulación interfalángica distal (IFD), o nódulo tiroideo sólido..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-slate-200 text-xs p-3 rounded-xl outline-none focus:ring-1 focus:ring-cyan-500/30 font-medium"
                />
              </div>

              {/* SURGICAL ANATOMICAL PRECISION CONTROL BOX */}
              <div className="p-3.5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 rounded-2xl border-2 border-emerald-500/40 space-y-3 shadow-lg shadow-emerald-950/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-950 border border-emerald-500/50 rounded-lg text-emerald-300">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider font-mono text-emerald-300 flex items-center gap-1.5">
                        Localizador Anatómico de Precisión Quirúrgica
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Fija con exactitud el dedo, nivel articular y cara para eliminar ambigüedades.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      {effectiveDigit ? getDigitLabel(effectiveDigit) : "Dedo: Auto"} · {effectiveJoint ? getJointLabel(effectiveJoint) : "Nivel: Auto"}
                    </span>
                  </div>
                </div>

                {/* 1. Digit Selector */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-slate-300 uppercase font-bold flex items-center justify-between">
                    <span>1. Dedo / Estructura Digital:</span>
                    {detectedDigit && (
                      <span className="text-[8.5px] text-cyan-300 font-normal">
                        Auto-detectado en texto: <strong className="text-cyan-200">{getDigitLabel(detectedDigit)}</strong>
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {DIGIT_OPTIONS.slice(0, 6).map((opt) => {
                      const isSelected = targetDigit === opt.id || (targetDigit === "auto" && detectedDigit === opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTargetDigit(opt.id)}
                          className={`px-2 py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-950 border-emerald-400 text-emerald-200 ring-1 ring-emerald-500/50 shadow"
                              : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <span className="text-[10px] font-bold block">{opt.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Joint Level Selector */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-slate-300 uppercase font-bold flex items-center justify-between">
                    <span>2. Nivel Articular / Segmento:</span>
                    {detectedJoint && (
                      <span className="text-[8.5px] text-cyan-300 font-normal">
                        Auto-detectado en texto: <strong className="text-cyan-200">{getJointLabel(detectedJoint)}</strong>
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {JOINT_OPTIONS.slice(0, 4).map((opt) => {
                      const isSelected = targetJointLevel === opt.id || (targetJointLevel === "auto" && detectedJoint === opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTargetJointLevel(opt.id)}
                          className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-cyan-950 border-cyan-400 text-cyan-200 ring-1 ring-cyan-500/50 shadow"
                              : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <span className="text-[10px] font-bold block">{opt.short}</span>
                          <span className="text-[8px] text-slate-400 block truncate">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Aspect / Cara Selector & Unit Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-300 uppercase font-bold block">
                      3. Cara / Aspecto Anatómico:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {ASPECT_OPTIONS.slice(0, 3).map((opt) => {
                        const isSelected = targetAspect === opt.id || (targetAspect === "auto" && detectedAspect === opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTargetAspect(opt.id)}
                            className={`px-1.5 py-1 rounded-lg border text-center transition-all cursor-pointer ${
                              isSelected
                                ? "bg-indigo-950 border-indigo-400 text-indigo-200 ring-1 ring-indigo-500/50 shadow"
                                : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <span className="text-[9.5px] font-bold block truncate">{opt.short}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-300 uppercase font-bold block">
                      4. Estructura o Tendón Específico:
                    </label>
                    <input
                      type="text"
                      value={specificAnatomicalUnit}
                      onChange={(e) => setSpecificAnatomicalUnit(e.target.value)}
                      placeholder="Ej: Tendón flexor profundo del 4to dedo en inserción IFD..."
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* Negative constraint badge guarantee */}
                {(effectiveDigit || effectiveJoint) && (
                  <div className="p-2 bg-slate-950/90 rounded-xl border border-emerald-500/30 text-[9.5px] text-emerald-200 flex items-center gap-2 font-mono">
                    <Lock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>
                      <strong className="text-emerald-300">Restricción Topográfica Estricta:</strong> La IA aislará exclusivamente {effectiveDigit ? getDigitLabel(effectiveDigit) : "el dedo objetivo"} a nivel {effectiveJoint ? getJointLabel(effectiveJoint) : "articular seleccionado"}, excluyendo dedos y articulaciones adyacentes.
                    </span>
                  </div>
                )}
              </div>

              {/* Strict Anatomical Laterality Selector */}
              <div className="space-y-2 bg-slate-950/70 p-3 rounded-2xl border border-cyan-500/30">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-cyan-300 uppercase font-bold flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" /> Control de Lateralidad Anatómica del Paciente:
                  </label>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                    {laterality === "auto" 
                      ? (detectedLaterality === "right" ? "Detectado: DERECHO" : detectedLaterality === "left" ? "Detectado: IZQUIERDO" : "Auto: Detección activa")
                      : laterality === "right" ? "Fijado: DERECHO" : laterality === "left" ? "Fijado: IZQUIERDO" : "Fijado: BILATERAL / LÍNEA MEDIA"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setLaterality("auto")}
                    className={`px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                      laterality === "auto"
                        ? "bg-cyan-950 border-cyan-400 text-cyan-200 shadow"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[11px] font-bold block">Auto-detectar</span>
                    <span className="text-[8px] text-slate-400 block truncate">
                      {detectedLaterality === "right" ? "👉 Lado Derecho" : detectedLaterality === "left" ? "👈 Lado Izquierdo" : "Por texto clínico"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaterality("right")}
                    className={`px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                      laterality === "right"
                        ? "bg-emerald-950 border-emerald-400 text-emerald-200 shadow"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[11px] font-bold block text-emerald-300">Derecha (R)</span>
                    <span className="text-[8px] text-slate-400 block truncate">Lado derecho paciente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaterality("left")}
                    className={`px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                      laterality === "left"
                        ? "bg-indigo-950 border-indigo-400 text-indigo-200 shadow"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[11px] font-bold block text-indigo-300">Izquierda (L)</span>
                    <span className="text-[8px] text-slate-400 block truncate">Lado izquierdo paciente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaterality("midline")}
                    className={`px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                      laterality === "midline"
                        ? "bg-purple-950 border-purple-400 text-purple-200 shadow"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[11px] font-bold block text-purple-300">Línea Media / Ambos</span>
                    <span className="text-[8px] text-slate-400 block truncate">Central o Bilateral</span>
                  </button>
                </div>

                <p className="text-[9.5px] text-slate-400 leading-tight">
                  <span className="text-cyan-300 font-semibold">Garantía de lateralidad estricta:</span> La IA posiciona la lesión exactamente en el lado anatómico del paciente tanto en vista anterior (izquierda de pantalla) como posterior (derecha de pantalla) para evitar cualquier inversión.
                </p>
              </div>

              {/* Perspective Mode Selector: Single vs Dual */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">
                  Perspectiva de Renderizado 3D:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setDualPerspective(true)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                      dualPerspective
                        ? "bg-gradient-to-br from-indigo-950/80 via-cyan-950/60 to-purple-950/80 border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg"
                        : "bg-slate-950/70 border-slate-800 hover:border-slate-700 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5 text-cyan-400" /> Doble Perspectiva (Focal + Panorámica)
                      </span>
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                        RECOMENDADO
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                      Genera 2 vistas 3D: 1) Corte focal exacto de la ecografía (fibras/profundidad) + 2) Vista panorámica macro del grupo anatómico para ubicarse espacialmente.
                    </p>
                  </div>

                  <div
                    onClick={() => setDualPerspective(false)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                      !dualPerspective
                        ? "bg-gradient-to-br from-slate-900 to-slate-850 border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg"
                        : "bg-slate-950/70 border-slate-800 hover:border-slate-700 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5 text-slate-400" /> Render Focal Único
                      </span>
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400">
                        CLÁSICO
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Genera únicamente 1 ilustración 3D fiel al campo estrecho de la ecografía.
                    </p>
                  </div>
                </div>
              </div>

              {/* PDF Layout Selector if Dual */}
              {dualPerspective && (
                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <label className="text-[10px] font-mono text-cyan-400 uppercase font-bold flex items-center gap-1.5">
                    <Columns className="h-3 w-3" /> Formato de Diagramación en el PDF:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPdfLayout("triptych")}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        pdfLayout === "triptych"
                          ? "bg-cyan-950/80 border-cyan-500 text-cyan-200"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className="text-xs font-bold block flex items-center gap-1.5">
                        <Columns className="h-3.5 w-3.5 text-cyan-400" /> Opción A: Tríptico Horizontal
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">
                        3 imágenes alineadas arriba (2D + 3D Focal + 3D Macro) y cuadro explicativo abajo.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPdfLayout("grid2x2")}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        pdfLayout === "grid2x2"
                          ? "bg-cyan-950/80 border-cyan-500 text-cyan-200"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className="text-xs font-bold block flex items-center gap-1.5">
                        <Grid className="h-3.5 w-3.5 text-indigo-400" /> Opción B: Cuadrícula 2x2
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">
                        Arriba 2D + 3D Focal; abajo 3D Macro + Cuadro explicativo al costado.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Render Styles Grid */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">
                  Estilo Visual del Render 3D:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RENDER_STYLES.map((style) => {
                    const isSelected = renderStyle === style.id;
                    return (
                      <div
                        key={style.id}
                        onClick={() => setRenderStyle(style.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? `bg-gradient-to-br ${style.color} ring-2 ring-cyan-500/40 shadow-lg`
                            : "bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{style.name}</span>
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300">
                            {style.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{style.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Instructions (Optional) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold block">
                  Instrucciones Visuales Adicionales (Opcional):
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ej: Destacar el músculo en corte sagital con halo translúcido cian..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl focus:border-cyan-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-mono">
            {isGenerating ? (
              <span className="flex items-center gap-2 text-cyan-300 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                {progressStep}
              </span>
            ) : generatedResult ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Listo para incrustar en el PDF ({pdfLayout === "grid2x2" ? "Cuadrícula 2x2" : "Tríptico"})
              </span>
            ) : (
              <span>Motor multimodal Gemini 3.7 + Auditoría Topográfica y Lateralidad Dual</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            {generatedResult ? (
              <>
                <button
                  type="button"
                  onClick={() => setGeneratedResult(null)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Regenerar</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndSave}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Aprobar e Incrustar en PDF</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleExecuteGeneration}
                disabled={isGenerating || (!findingDesc.trim() && !activeImageObj)}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-950/60 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                    <span>Generando {dualPerspective ? "Renders 3D Duales..." : "Render 3D..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>{dualPerspective ? "Generar Vistas 3D Duales" : "Generar Ilustración 3D"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
