import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { 
  FileArchive, Loader2, AlertTriangle, 
  Download, Image as ImageIcon, Check, X, Layers
} from "lucide-react";
import { motion } from "motion/react";
import { 
  uint8ToBase64, 
  parseDicomMetadata, 
  decodeDicomImage,
  extractImageFromDicom, 
  generateDicomVisualMockup,
  DicomMetadata
} from "../lib/dicomHelpers";

export interface ExtractedFile {
  name: string;
  nameOnly: string;
  size: number;
  isDicom: boolean;
  base64: string; 
  rawBase64: string; 
  mimeType: string;
  rawArray: Uint8Array;
  metadata?: DicomMetadata;
  visualUrl?: string;
}

interface ZipDicomExtractorProps {
  isOpen: boolean;
  onClose: () => void;
  zipFile: File | null;
  onLoadToGenerator: (extracted: ExtractedFile) => void;
  onLoadToSlot: (extracted: ExtractedFile, slot: 1 | 2 | 3) => void;
  onLoadMultipleSlots?: (selections: { file: ExtractedFile; slot: 1 | 2 | 3 }[]) => void;
}

export default function ZipDicomExtractor({
  isOpen,
  onClose,
  zipFile,
  onLoadToGenerator,
  onLoadToSlot,
  onLoadMultipleSlots
}: ZipDicomExtractorProps) {
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<ExtractedFile[]>([]);
  const [isUnzipping, setIsUnzipping] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && zipFile) {
      handleParseZip(zipFile);
    } else {
      setExtractedFiles([]);
      setSelectedFiles([]);
      setErrorMsg(null);
    }
  }, [isOpen, zipFile]);

  const handleParseZip = async (file: File) => {
    setIsUnzipping(true);
    setErrorMsg(null);
    setExtractedFiles([]);
    setSelectedFiles([]);
    
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      const tempFiles: ExtractedFile[] = [];

      for (const [filename, fileObj] of Object.entries(loadedZip.files)) {
        if ((fileObj as any).dir) continue; 

        const u8Array = await (fileObj as any).async("uint8array");
        const size = u8Array.length;

        // Check if file is a DICOM based on extension or magic header "DICM" at byte 128
        const ext = filename.split('.').pop()?.toLowerCase() || "";
        const isDicomExt = ["dcm", "dicom"].includes(ext);
        const hasDicomHeader = u8Array.length > 132 && 
                               u8Array[128] === 0x44 && 
                               u8Array[129] === 0x49 && 
                               u8Array[130] === 0x43 && 
                               u8Array[131] === 0x4D; 
        
        const isDicom = isDicomExt || hasDicomHeader;
        const isImage = ["png", "jpg", "jpeg", "bmp", "gif", "webp"].includes(ext);

        if (!isDicom && !isImage) {
          continue; // Skip irrelevant files
        }

        let mimeType = "image/png";
        if (isDicom) {
          mimeType = "application/dicom";
        } else if (ext === "jpg" || ext === "jpeg") {
          mimeType = "image/jpeg";
        } else if (ext === "bmp") {
          mimeType = "image/bmp";
        } else if (ext === "webp") {
          mimeType = "image/webp";
        }

        const rawBase64 = uint8ToBase64(u8Array);
        let base64 = "";
        let meta: DicomMetadata | undefined = undefined;
        let generatedVisualUrl = "";

        if (isImage) {
          base64 = rawBase64;
          generatedVisualUrl = `data:${mimeType};base64,${rawBase64}`;
        } else if (isDicom) {
          try {
            // Slice the buffer cleanly to release any pooled arrays
            const cleanDcmBuffer = u8Array.buffer.slice(u8Array.byteOffset, u8Array.byteOffset + u8Array.byteLength);
            const dicomFileName = filename.split("/").pop() || filename;
            meta = parseDicomMetadata(cleanDcmBuffer, dicomFileName);
            let visualUrl = "";

            const isPackedUncompressedYbr =
              meta.photometricInterpretation?.trim().toUpperCase() === "YBR_FULL_422" &&
              ["1.2.840.10008.1.2", "1.2.840.10008.1.2.1"].includes(meta.transferSyntaxUID || "");

            if (isPackedUncompressedYbr) {
              visualUrl = extractImageFromDicom(cleanDcmBuffer, meta) || "";
            } else {
              try {
                visualUrl = await decodeDicomImage(cleanDcmBuffer, dicomFileName);
              } catch (codecError) {
                console.warn("El codec DICOM avanzado no pudo decodificar el archivo; usando compatibilidad básica:", codecError);
                visualUrl = extractImageFromDicom(cleanDcmBuffer, meta) || "";
              }
            }
            
            if (!visualUrl) {
              visualUrl = generateDicomVisualMockup(meta);
            }
            
            // Trim space/linebreak artifacts immediately to prevent serialization errors
            generatedVisualUrl = visualUrl.trim().replace(/\s/g, "");
            base64 = generatedVisualUrl.includes(",") ? generatedVisualUrl.split(",")[1] : generatedVisualUrl;
          } catch (err) {
            console.error("Error decoding zip-extracted DICOM raw pixel values:", err);
            if (meta) {
              generatedVisualUrl = generateDicomVisualMockup(meta);
              base64 = generatedVisualUrl.split(",")[1] || "";
            } else {
              continue;
            }
          }
        }

        const nameOnly = filename.split("/").pop() || filename;

        tempFiles.push({
          name: filename,
          nameOnly,
          size,
          isDicom,
          base64,
          rawBase64,
          mimeType,
          rawArray: u8Array,
          metadata: meta,
          visualUrl: generatedVisualUrl
        });
      }

      if (tempFiles.length === 0) {
        setErrorMsg("El archivo .ZIP no contiene archivos DICOM (.dcm) ni imágenes médicas válidas (PNG, JPG).");
      } else {
        setExtractedFiles(tempFiles);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Error al descomprimir el archivo: ${e.message || "Estructura ZIP corrupta"}`);
    } finally {
      setIsUnzipping(false);
    }
  };

  // Triggers client browser saving of the extracted raw file
  const handleDownloadFile = (extracted: ExtractedFile) => {
    try {
      const blob = new Blob([extracted.rawArray], { type: extracted.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = extracted.nameOnly;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error al descargar el archivo:", e);
    }
  };

  const handleToggleSelect = (file: ExtractedFile) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.name === file.name);
      if (isSelected) {
        // Unmark: remove from selection list
        return prev.filter(f => f.name !== file.name);
      } else {
        // Mark: allow up to 3 selections matching Slots 1, 2, and 3
        if (prev.length >= 3) {
          return prev; // Cap at 3
        }
        return [...prev, file];
      }
    });
  };

  const handleConfirmBatchLoad = () => {
    if (selectedFiles.length === 0) return;
    
    if (onLoadMultipleSlots) {
      const payload = selectedFiles.map((file, index) => {
        const slot = (index + 1) as 1 | 2 | 3;
        return { file, slot };
      });
      onLoadMultipleSlots(payload);
    } else {
      // Fallback
      selectedFiles.forEach((file, index) => {
        onLoadToSlot(file, (index + 1) as 1 | 2 | 3);
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header banner */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-violet-950/40 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileArchive className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Extractor Clínico Pro & Selección Multi-Slot</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">
                {zipFile ? `${zipFile.name} • (${(zipFile.size / 1024 / 1024).toFixed(2)} MB)` : "Asignación Automática de Doble Valoración"}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info Tip Header */}
        {!isUnzipping && !errorMsg && extractedFiles.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center gap-2.5 text-left">
            <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
            <p className="text-[10px] font-medium text-slate-350 leading-tight">
              Marque de <strong className="text-indigo-300">1 a 3 imágenes</strong> en el orden deseado. Se cargarán <strong className="text-indigo-300">automáticamente</strong> en los Slots 1, 2 y 3 de Doble Valoración según sus marcas.
            </p>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 min-h-0 scrollbar-thin">
          {isUnzipping && (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400 select-none">
              <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
              <div className="text-xs font-black uppercase tracking-widest text-slate-300">Analizando estructura comprimida...</div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Decodificando imágenes y extrayendo cabeceras DICOM en alta fidelidad</p>
            </div>
          )}

          {errorMsg && (
            <div className="py-12 px-5 bg-rose-500/5 border-2 border-rose-500/10 rounded-2xl flex items-start gap-3.5">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl mt-0.5 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 text-left">
                <h4 className="text-[11px] font-black text-rose-200 uppercase tracking-widest font-mono">Fichero No Reconocido</h4>
                <p className="text-[11px] text-slate-350 leading-relaxed font-semibold">{errorMsg}</p>
                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-rose-950/20 hover:bg-rose-950/45 border border-rose-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-rose-300 transition-all cursor-pointer"
                  >
                    Cerrar ventana
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isUnzipping && !errorMsg && extractedFiles.length > 0 && (
            <div className="space-y-3 pb-4">
              {/* Items List */}
              <div className="space-y-2">
                {extractedFiles.map((file) => {
                  const selectIndex = selectedFiles.findIndex(f => f.name === file.name);
                  const isChecked = selectIndex !== -1;
                  const slotNum = isChecked ? selectIndex + 1 : null;

                  return (
                    <div 
                      key={file.name}
                      onClick={() => handleToggleSelect(file)}
                      className={`border rounded-2xl p-3 flex items-center justify-between gap-4 transition-all hover:bg-slate-850/40 cursor-pointer select-none ${
                        isChecked 
                          ? "bg-indigo-950/20 border-indigo-500/40 hover:border-indigo-500/60" 
                          : "border-slate-800 bg-slate-950/30 hover:border-slate-700"
                      }`}
                    >
                      {/* Left side: Checkbox + Image + Meta */}
                      <div className="flex items-center gap-4 min-w-0 flex-1 text-left">
                        
                        {/* 🔘 BEAUTIFUL INTERACTIVE CUSTOM CHECKBOX */}
                        <div className="shrink-0 relative">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all font-mono font-black text-[11px] ${
                            isChecked 
                              ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 scale-105" 
                              : "border-slate-700 group-hover:border-slate-500 bg-slate-900 text-transparent"
                          }`}>
                            {isChecked ? slotNum : ""}
                          </div>
                        </div>

                        {/* Mini Preview Box */}
                        <div className="w-14 h-14 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 relative">
                          <img 
                            src={file.visualUrl || `data:image/png;base64,${file.base64}`}
                            alt={file.nameOnly}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Labels and values metadata */}
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="text-[11px] font-black text-slate-200 uppercase tracking-wide truncate font-mono" title={file.name}>
                            {file.nameOnly}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-wider font-mono">
                            <span className="text-slate-500 bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded-md">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                            {file.isDicom ? (
                              <span className="text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded-md">
                                DICOM [{file.metadata?.modality || "RX"}]
                              </span>
                            ) : (
                              <span className="text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-1.5 py-0.5 rounded-md">
                                Imagen Estándar
                              </span>
                            )}
                            {isChecked && (
                              <span className="text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-md">
                                ASIGNADA AL SLOT {slotNum}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side Actions (Download Original) */}
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(file)}
                          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-emerald-400 rounded-xl transition-all cursor-pointer shadow-sm"
                          title="Descargar archivo original original"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Visual Slot Allocations & Batch Loader Footer */}
        {!isUnzipping && !errorMsg && extractedFiles.length > 0 && (
          <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col gap-3">
            {/* Visual Slots Preview Drawer */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((slot) => {
                const filledFile = selectedFiles[slot - 1];
                return (
                  <div 
                    key={slot}
                    className={`border rounded-xl p-2.5 flex items-center gap-2.5 text-left transition-all relative ${
                      filledFile 
                        ? "bg-slate-900 border-indigo-500/30" 
                        : "bg-slate-950 border-slate-850 border-dashed"
                    }`}
                  >
                    {/* Badge Slot identifier */}
                    <div className="absolute top-1 right-1 text-[7px] font-black uppercase tracking-wider bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded-full font-mono text-slate-500">
                      Slot {slot}
                    </div>

                    {/* Miniature thumbnail */}
                    {filledFile ? (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                          <img 
                            src={filledFile.visualUrl || `data:image/png;base64,${filledFile.base64}`} 
                            alt={`slot-${slot}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[8px] font-black uppercase text-indigo-400 font-mono truncate">
                            {filledFile.nameOnly}
                          </div>
                          <div className="text-[7px] font-black uppercase text-slate-500 font-mono mt-0.5">
                            {(filledFile.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        {/* Instant remove button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(filledFile)}
                          className="p-1 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/20 text-slate-500 hover:text-rose-400 rounded-md transition-all cursor-pointer"
                          title="Quitar este slot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="py-2 flex items-center justify-center gap-1.5 text-slate-500 select-none w-full">
                        <span className="text-[8px] font-black uppercase tracking-widest font-mono text-slate-600">Siga marcando...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Row */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <span className="text-[9px] font-black text-slate-500 font-mono uppercase tracking-widest">
                {selectedFiles.length > 0 
                  ? `${selectedFiles.length} / 3 imágenes marcadas` 
                  : "Por favor, marque al menos una imagen médica"
                }
              </span>
              
              <div className="flex gap-2 shrink-0">
                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="px-3 py-2 border border-slate-800 hover:border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest font-mono text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                  >
                    Limpiar marcas
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={handleConfirmBatchLoad}
                  disabled={selectedFiles.length === 0}
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest font-mono transition-all flex items-center gap-1.5 shadow-md ${
                    selectedFiles.length > 0
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-[0.98]"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Cargar Selección en slots ({selectedFiles.length})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info strip */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-900 flex items-center justify-between text-[8px] font-black text-slate-600 font-mono uppercase tracking-widest select-none">
          <span>Decodificación médica asíncrona local con aislamiento de hilos</span>
          <div className="flex gap-2.5 text-indigo-500 shrink-0">
            <span>DR. MILTON RADIOLOGY</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
