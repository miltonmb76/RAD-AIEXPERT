
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ListTodo,
  X,
  ImagePlus,
  Upload,
  Loader2,
  AlertCircle,
  Clock,
  Trash2,
  Check,
} from "lucide-react";
import type { Worklist, WorklistPatient } from "../firebaseDb";
import { ManualPatientAdder } from "./ManualPatientAdder";
import { UltrasoundWorklistExporter } from "./UltrasoundWorklistExporter";

export interface WorklistSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  worklist: Worklist | null;
  worklistError: string | null;
  isProcessingWorklist: boolean;
  selectedWorklistPatientId: string | null | undefined;
  bridgeOnline: boolean;
  bridgePatientCount: number;
  onUploadImage: (file: File, mergeExisting: boolean) => void;
  onClearWorklist: () => void;
  onSelectPatient: (patient: WorklistPatient) => void;
  onDeletePatient: (patientId: string) => void;
  onUpdateStatus: (patientId: string, status: WorklistPatient["status"]) => void;
  onAddPatient: (newPatient: {
    name: string;
    age: string;
    gender: string;
    patientId: string;
    studyType: string;
    time: string;
    phone?: string;
  }) => void;
}

export const WorklistSidebar: React.FC<WorklistSidebarProps> = ({
  isOpen,
  onClose,
  worklist,
  worklistError,
  isProcessingWorklist,
  selectedWorklistPatientId,
  bridgeOnline,
  bridgePatientCount,
  onUploadImage,
  onClearWorklist,
  onSelectPatient,
  onDeletePatient,
  onUpdateStatus,
  onAddPatient,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="no-print h-full bg-[#090D1C] border-l border-slate-805 p-0 shrink-0 flex flex-col overflow-hidden relative z-20"
        >
                {/* Decorative top border glow */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_10px_#6366f1]" />
            
                {/* Sidebar Header */}
                <div className="p-4.5 border-b border-slate-805 flex items-center justify-between bg-slate-950/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <ListTodo className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black tracking-wider uppercase text-white font-mono flex items-center gap-1.5">
                        Lista de Trabajo
                      </h3>
                      <p className="text-[9px] font-bold text-indigo-400/80 uppercase tracking-widest font-mono">
                        Agenda Diaria
                      </p>
                    </div>
                  </div>
              
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Sidebar Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
              
                  {/* Upload Section / Agenda Digitizer */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-indigo-300/90 tracking-widest font-mono flex items-center gap-1">
                        <ImagePlus className="h-3 w-3" /> Digitalizar Agenda
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-905 px-1.5 py-0.5 rounded font-mono">
                        IA CORE
                      </span>
                    </div>
                
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Sube una foto de tu lista de pacientes del día para que la IA la digitalice automáticamente.
                    </p>

                    {/* Drag-n-Drop File Upload Target */}
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/20 hover:bg-indigo-950/5 rounded-xl p-4.5 text-center cursor-pointer transition relative group overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const mergeCheckbox = document.getElementById("merge-checkbox") as HTMLInputElement;
                            onUploadImage(file, mergeCheckbox?.checked || false);
                          }
                        }}
                        className="hidden"
                        disabled={isProcessingWorklist}
                      />
                  
                      {isProcessingWorklist ? (
                        <div className="py-2 flex flex-col items-center justify-center space-y-2">
                          <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
                          <span className="text-[9.5px] font-bold text-indigo-300 uppercase tracking-wider animate-pulse">Digitalizando Agenda...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-1.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition group-hover:scale-105 duration-200">
                            <Upload className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-300 block">Tomar Foto / Subir Imagen</span>
                            <span className="text-[8.5px] text-slate-500 font-mono">Soporta PNG, JPG, WEBP</span>
                          </div>
                        </div>
                      )}
                    </label>

                    {/* Merge Options Checkbox */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="merge-checkbox"
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 bg-slate-950 cursor-pointer"
                        defaultChecked={false}
                      />
                      <label htmlFor="merge-checkbox" className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300">
                        Combinar con lista actual
                      </label>
                    </div>
                  </div>

                  {/* Error Banner */}
                  {worklistError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3 text-[10px] leading-relaxed flex gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <div>
                        <span className="font-bold uppercase tracking-wider block mb-0.5">Error de Digitalización</span>
                        {worklistError}
                      </div>
                    </div>
                  )}

                  {/* Patient Worklist Tracker */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-805/40 pb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                        Pacientes ({worklist?.patients.length || 0})
                      </span>
                      {worklist && worklist.patients.length > 0 && (
                        <button
                          onClick={() => {
                            if (confirm("¿Estás seguro de que deseas limpiar la lista de trabajo de hoy?")) {
                              onClearWorklist();
                            }
                          }}
                          className="text-[9px] font-extrabold uppercase text-rose-400/80 hover:text-rose-400 hover:underline transition tracking-wider cursor-pointer"
                        >
                          Vaciar
                        </button>
                      )}
                    </div>

                    {/* List Container */}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {!worklist || worklist.patients.length === 0 ? (
                        <div className="text-center py-8 px-4 rounded-xl border border-slate-850 bg-slate-900/10">
                          <Clock className="h-6 w-6 text-slate-650 mx-auto mb-2" />
                          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">No hay pacientes</span>
                          <span className="text-[9px] text-slate-600 block mt-1">Digitaliza una agenda o añade uno manual</span>
                        </div>
                      ) : (
                        worklist.patients.map((patient, index) => {
                          const isSelected = patient.id === selectedWorklistPatientId || patient.status === 'current';
                      
                          let statusColorClass = "border-slate-850 bg-slate-900/15 hover:bg-slate-900/30";
                          let statusBadgeClass = "bg-slate-800 text-slate-400";
                          let statusText = "Pendiente";

                          if (patient.status === 'current') {
                            statusColorClass = "border-indigo-500/50 bg-indigo-950/10 shadow-[0_0_15px_rgba(99,102,241,0.05)]";
                            statusBadgeClass = "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20";
                            statusText = "Atendiendo";
                          } else if (patient.status === 'attended') {
                            statusColorClass = "border-emerald-500/20 bg-emerald-950/5 opacity-70";
                            statusBadgeClass = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
                            statusText = "Atendido";
                          }

                          // Patient metadata text
                          const metaParts = [];
                          if (patient.age) metaParts.push(`${patient.age} a`);
                          if (patient.gender) metaParts.push(patient.gender.toUpperCase());
                          if (patient.patientId) metaParts.push(`ID: ${patient.patientId}`);
                          if (patient.phone) metaParts.push(`📞 ${patient.phone}`);
                          const metaText = metaParts.join(" • ");

                          return (
                            <div
                              key={patient.id}
                              className={`border rounded-xl p-3 flex flex-col gap-2 transition-all duration-300 relative group/item ${statusColorClass}`}
                            >
                              {/* Inner header */}
                              <div className="flex items-start justify-between gap-1.5">
                                <div 
                                  className="flex-1 cursor-pointer"
                                  onClick={() => onSelectPatient(patient)}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {patient.time && (
                                      <span className="text-[9px] font-black font-mono text-indigo-400 bg-indigo-950/60 px-1 rounded border border-indigo-500/10">
                                        {patient.time}
                                      </span>
                                    )}
                                    <h4 className="text-xs font-bold text-white group-hover/item:text-indigo-300 transition truncate max-w-[170px]">
                                      {patient.name}
                                    </h4>
                                  </div>
                                  {metaText && (
                                    <p className="text-[9.5px] font-mono font-bold text-slate-500 mt-0.5">
                                      {metaText}
                                    </p>
                                  )}
                                </div>

                                {/* Delete button */}
                                <button
                                  onClick={() => onDeletePatient(patient.id)}
                                  className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-slate-900 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                  title="Eliminar de la lista"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Study requested if any */}
                              {patient.studyType && (
                                <p className="text-[10px] font-bold text-slate-400 bg-slate-950/30 px-2 py-1 rounded border border-slate-850 font-mono truncate">
                                  {patient.studyType}
                                </p>
                              )}

                              {/* Actions and Status */}
                              <div className="flex items-center justify-between border-t border-slate-850 pt-2 mt-1 gap-1">
                                {/* Status indicator */}
                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${statusBadgeClass}`}>
                                  {statusText}
                                </span>

                                {/* Toggles */}
                                <div className="flex items-center gap-1">
                                  {patient.status === 'pending' && (
                                    <button
                                      onClick={() => onSelectPatient(patient)}
                                      className="text-[8.5px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded transition shadow-[0_1px_5px_rgba(99,102,241,0.2)] cursor-pointer"
                                    >
                                      Atender
                                    </button>
                                  )}
                                  {patient.status === 'current' && (
                                    <button
                                      onClick={() => onUpdateStatus(patient.id, 'attended')}
                                      className="text-[8.5px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded transition flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <Check className="h-2.5 w-2.5" /> Terminar
                                    </button>
                                  )}
                                  {patient.status === 'attended' && (
                                    <button
                                      onClick={() => onUpdateStatus(patient.id, 'pending')}
                                      className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 px-1 hover:underline transition cursor-pointer"
                                    >
                                      Reabrir
                                    </button>
                                  )}
                                </div>
                              </div>
                          
                              {/* Decorative pulsating active beacon */}
                              {patient.status === 'current' && (
                                <div className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Manual Patient Adder form */}
                  <ManualPatientAdder onAdd={onAddPatient} />

                  {/* Sincronizador de Ecógrafo / Exportador de Lista de Trabajo */}
                  <UltrasoundWorklistExporter
                    patients={worklist ? worklist.patients : []}
                    bridgeOnline={bridgeOnline}
                    bridgePatientCount={bridgePatientCount}
                  />

                </div>
              </motion.aside>
            )}
          </AnimatePresence>
  );
};
