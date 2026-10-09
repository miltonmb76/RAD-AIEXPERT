import {
  applyScorecardGovernanceToFigurePack,
  buildAtlasDirectivesFromScorecard,
  buildAtlasPanelFindingAssignments,
  buildVascularDirectivesFromScorecard,
  buildThyroidDirectivesFromScorecard,
  buildBreastDirectivesFromScorecard,
  buildShoulderDirectivesFromScorecard,
  buildKneeDirectivesFromScorecard,
  buildAnkleDirectivesFromScorecard,
  buildKidneyDirectivesFromScorecard,
  buildAbdomenDirectivesFromScorecard,
  buildAbdominalWallDirectivesFromScorecard,
  buildScrotumDirectivesFromScorecard,
  buildMuscleTendonDirectivesFromScorecard,
  buildWristDirectivesFromScorecard,
  mergeOverlaysOntoAtlas,
} from "./clinicalIntelligence";

export type BatchModuleActivatorDeps = {
  biomechanicalRadarData: any;
  clinicalHistory: string;
  clinicalScorecardData: any;
  editedReportText: string;
  generatedReport: string;
  handleAnalyzeCase: (...args: any[]) => any;
  handleGenerateDynamicGlossary: (...args: any[]) => any;
  handleGenerateSchematicSummary: (...args: any[]) => any;
  handleSearchBibliography: (...args: any[]) => any;
  isEditingReportManual: boolean;
  modelFor: (task?: any) => string;
  patientGender: string;
  selectedBatchModules: Record<string, boolean>;
  setAbdomen3dData: (...args: any[]) => void;
  setAbdominalWall3dData: (...args: any[]) => void;
  setAnkle3dData: (...args: any[]) => void;
  setAtlas3dData: (...args: any[]) => void;
  setAtlasDirectivesFromScorecard: (...args: any[]) => void;
  setBatchSuccessMessage: (...args: any[]) => void;
  setBreast3dData: (...args: any[]) => void;
  setClinicalScorecardData: (...args: any[]) => void;
  setDifferentialTreeData: (...args: any[]) => void;
  setFindingsInfographicData: (...args: any[]) => void;
  setIncludeAbdomen3dInReport: (...args: any[]) => void;
  setIncludeAbdominalWall3dInReport: (...args: any[]) => void;
  setIncludeAnkle3dInReport: (...args: any[]) => void;
  setIncludeAtlas3dInReport: (...args: any[]) => void;
  setIncludeBreast3dInReport: (...args: any[]) => void;
  setIncludeDifferentialTreeInReport: (...args: any[]) => void;
  setIncludeFindingsInfographicInReport: (...args: any[]) => void;
  setIncludeKidney3dInReport: (...args: any[]) => void;
  setIncludeKnee3dInReport: (...args: any[]) => void;
  setIncludeMuscleTendon3dInReport: (...args: any[]) => void;
  setIncludeNegativityChecklistInReport: (...args: any[]) => void;
  setIncludeReasoningChainInReport: (...args: any[]) => void;
  setIncludeScorecardInReport: (...args: any[]) => void;
  setIncludeScrotum3dInReport: (...args: any[]) => void;
  setIncludeSemioticsConductMatrixInReport: (...args: any[]) => void;
  setIncludeShoulder3dInReport: (...args: any[]) => void;
  setIncludeThyroid3dInReport: (...args: any[]) => void;
  setIncludeVascular3dInReport: (...args: any[]) => void;
  setIncludeWrist3dInReport: (...args: any[]) => void;
  setIsAbdomen3dSuiteOpen: (...args: any[]) => void;
  setIsAbdominalWall3dSuiteOpen: (...args: any[]) => void;
  setIsActivatingBatch: (...args: any[]) => void;
  setIsAnkle3dSuiteOpen: (...args: any[]) => void;
  setIsAsistenteMedidasOpen: (...args: any[]) => void;
  setIsBiomechanicalRadarOpen: (...args: any[]) => void;
  setIsBreast3dSuiteOpen: (...args: any[]) => void;
  setIsClinicalScorecardOpen: (...args: any[]) => void;
  setIsCreadorCuadroSinopticoOpen: (...args: any[]) => void;
  setIsCreadorNotasOpen: (...args: any[]) => void;
  setIsCreadorSinopsisFracturasOpen: (...args: any[]) => void;
  setIsDifferentialTreeOpen: (...args: any[]) => void;
  setIsFindingsInfographicOpen: (...args: any[]) => void;
  setIsGeneratingOperationalSummary: (...args: any[]) => void;
  setIsGeneratingPatientSummary: (...args: any[]) => void;
  setIsKidney3dSuiteOpen: (...args: any[]) => void;
  setIsKnee3dSuiteOpen: (...args: any[]) => void;
  setIsMuscleTendon3dSuiteOpen: (...args: any[]) => void;
  setIsNegativityChecklistOpen: (...args: any[]) => void;
  setIsPatientSummaryExpanded: (...args: any[]) => void;
  setIsReasoningChainOpen: (...args: any[]) => void;
  setIsScrotum3dSuiteOpen: (...args: any[]) => void;
  setIsSecondReaderOpen: (...args: any[]) => void;
  setIsSemioticsConductMatrixOpen: (...args: any[]) => void;
  setIsShoulder3dSuiteOpen: (...args: any[]) => void;
  setIsThyroid3dSuiteOpen: (...args: any[]) => void;
  setIsWrist3dSuiteOpen: (...args: any[]) => void;
  setKidney3dData: (...args: any[]) => void;
  setKnee3dData: (...args: any[]) => void;
  setModifyError: (...args: any[]) => void;
  setMuscleTendon3dData: (...args: any[]) => void;
  setNegativityChecklistData: (...args: any[]) => void;
  setOperationalSummaryText: (...args: any[]) => void;
  setPatientSummary: (...args: any[]) => void;
  setPatientSummaryError: (...args: any[]) => void;
  setReasoningChainData: (...args: any[]) => void;
  setScrotum3dData: (...args: any[]) => void;
  setSecondReaderData: (...args: any[]) => void;
  setSemioticsConductMatrixData: (...args: any[]) => void;
  setShoulder3dData: (...args: any[]) => void;
  setThyroid3dData: (...args: any[]) => void;
  setVascular3dData: (...args: any[]) => void;
  setWrist3dData: (...args: any[]) => void;
  specificStudy: string;
  studyType: string;
};

export function createBatchModuleActivator(d: BatchModuleActivatorDeps) {
  return async (
    reportOverride?: string,
    modulesOverride?: Record<string, boolean>
  ) => {
    const {
      biomechanicalRadarData,
      clinicalHistory,
      clinicalScorecardData,
      editedReportText,
      generatedReport,
      handleAnalyzeCase,
      handleGenerateDynamicGlossary,
      handleGenerateSchematicSummary,
      handleSearchBibliography,
      isEditingReportManual,
      modelFor,
      patientGender,
      selectedBatchModules,
      setAbdomen3dData,
      setAbdominalWall3dData,
      setAnkle3dData,
      setAtlas3dData,
      setAtlasDirectivesFromScorecard,
      setBatchSuccessMessage,
      setBreast3dData,
      setClinicalScorecardData,
      setDifferentialTreeData,
      setFindingsInfographicData,
      setIncludeAbdomen3dInReport,
      setIncludeAbdominalWall3dInReport,
      setIncludeAnkle3dInReport,
      setIncludeAtlas3dInReport,
      setIncludeBreast3dInReport,
      setIncludeDifferentialTreeInReport,
      setIncludeFindingsInfographicInReport,
      setIncludeKidney3dInReport,
      setIncludeKnee3dInReport,
      setIncludeMuscleTendon3dInReport,
      setIncludeNegativityChecklistInReport,
      setIncludeReasoningChainInReport,
      setIncludeScorecardInReport,
      setIncludeScrotum3dInReport,
      setIncludeSemioticsConductMatrixInReport,
      setIncludeShoulder3dInReport,
      setIncludeThyroid3dInReport,
      setIncludeVascular3dInReport,
      setIncludeWrist3dInReport,
      setIsAbdomen3dSuiteOpen,
      setIsAbdominalWall3dSuiteOpen,
      setIsActivatingBatch,
      setIsAnkle3dSuiteOpen,
      setIsAsistenteMedidasOpen,
      setIsBiomechanicalRadarOpen,
      setIsBreast3dSuiteOpen,
      setIsClinicalScorecardOpen,
      setIsCreadorCuadroSinopticoOpen,
      setIsCreadorNotasOpen,
      setIsCreadorSinopsisFracturasOpen,
      setIsDifferentialTreeOpen,
      setIsFindingsInfographicOpen,
      setIsGeneratingOperationalSummary,
      setIsGeneratingPatientSummary,
      setIsKidney3dSuiteOpen,
      setIsKnee3dSuiteOpen,
      setIsMuscleTendon3dSuiteOpen,
      setIsNegativityChecklistOpen,
      setIsPatientSummaryExpanded,
      setIsReasoningChainOpen,
      setIsScrotum3dSuiteOpen,
      setIsSecondReaderOpen,
      setIsSemioticsConductMatrixOpen,
      setIsShoulder3dSuiteOpen,
      setIsThyroid3dSuiteOpen,
      setIsWrist3dSuiteOpen,
      setKidney3dData,
      setKnee3dData,
      setModifyError,
      setMuscleTendon3dData,
      setNegativityChecklistData,
      setOperationalSummaryText,
      setPatientSummary,
      setPatientSummaryError,
      setReasoningChainData,
      setScrotum3dData,
      setSecondReaderData,
      setSemioticsConductMatrixData,
      setShoulder3dData,
      setThyroid3dData,
      setVascular3dData,
      setWrist3dData,
      specificStudy,
      studyType
    } = d;

    const activeReport =
      typeof reportOverride === "string" && reportOverride.trim()
        ? reportOverride.trim()
        : (isEditingReportManual ? editedReportText : (generatedReport || "")).trim();
    const modules = modulesOverride || selectedBatchModules;
    if (!activeReport) {
      setModifyError("Genera o redacta un reporte antes de activar los modulos en lote.");
      return;
    }

    setIsActivatingBatch(true);
    setBatchSuccessMessage(null);

    // 1. Activate interactive UI panels immediately
    if (modules.radar) setIsBiomechanicalRadarOpen(true);
    if (modules.measurements) setIsAsistenteMedidasOpen(true);
    if (modules.footnotes) setIsCreadorNotasOpen(true);
    if (modules.organ_synoptic) setIsCreadorCuadroSinopticoOpen(true);
    if (modules.fractures) setIsCreadorSinopsisFracturasOpen(true);
    if (modules.reasoning_chain) setIsReasoningChainOpen(true);
    if (modules.negativity_checklist) setIsNegativityChecklistOpen(true);
    if (modules.second_reader) setIsSecondReaderOpen(true);
    if (modules.differential_tree) setIsDifferentialTreeOpen(true);
    if (modules.semiotics_conduct_matrix) setIsSemioticsConductMatrixOpen(true);
    if (modules.findings_infographic) setIsFindingsInfographicOpen(true);
    // 2. Trigger async AI generation processes concurrently
    const promises: Promise<any>[] = [];

    // Scorecard bridge: downstream modules await this gate so categoryAssigned is ready
    let scorecardBridge: any = clinicalScorecardData;
    let releaseScorecardGate: (v?: any) => void = () => {};
    const scorecardGate = new Promise<any>((resolve) => {
      releaseScorecardGate = resolve;
    });

    if (modules.case_analysis) promises.push(handleAnalyzeCase());
    if (modules.bibliography) promises.push(handleSearchBibliography());

    if (modules.operational_summary) {
      setOperationalSummaryText("");
      setIsGeneratingOperationalSummary(true);
      promises.push((async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("operational_summary"),
              messages: [{
                role: "user",
                text:
                  "Resume de forma muy concisa UNICAMENTE los hallazgos clinicos principales de este reporte medico en 3 o 4 vinietas de texto asertivas y claras, redactadas con un lenguaje profesional pero comprensible, apto para ser compartido por WhatsApp y consultado digitalmente por el paciente. NO incluyas ninguna recomendacion, sugerencia de manejo ni plan a futuro, limitate estrictamente a los hallazgos de forma asertiva. No agregues preambulos, saludos, ni comentarios personales, devuelve directamente las vinietas con guiones '-'. Reporte:\n\n" +
                  activeReport,
              }],
            }),
          });
          const data = await response.json();
          if (response.ok && data.success && data.reply) {
            setOperationalSummaryText(String(data.reply).trim());
          } else {
            console.error("Resumen operacional fallo:", data.error);
          }
        } catch (error) {
          console.error("Error generando resumen operacional:", error);
        } finally {
          setIsGeneratingOperationalSummary(false);
        }
      })());
    }

    if (modules.patient_summary) {
      setPatientSummary(null);
      setPatientSummaryError(null);
      setIsGeneratingPatientSummary(true);
      // Keep inline (not fullscreen) so auto-generation after report does not interrupt the workspace
      setIsPatientSummaryExpanded(false);
      promises.push((async () => {
        try {
          const response = await fetch("/api/generate-patient-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("patient_summary"),
              report: activeReport,
              studyType: studyType || "Estudio Radiologico",
              clinicalHistory: clinicalHistory || "",
            }),
          });
          const data = await response.json();
          if (data.success && data.data) {
            const raw = data.data;
            const findings = Array.isArray(raw.keyFindings)
              ? raw.keyFindings.map((f: any) => ({
                  title: f?.title || "",
                  originalTerm: f?.originalTerm || "",
                  simplifiedExplanation: f?.simplifiedExplanation || "",
                  analogy: f?.analogy || "",
                  clinicalContext: f?.clinicalContext || f?.reassurance || "",
                  reassurance: f?.clinicalContext || f?.reassurance || "",
                }))
              : [];
            const glossary = Array.isArray(raw.glossary)
              ? raw.glossary
                  .map((g: any) => ({
                    term: String(g?.term || "").trim(),
                    plainDefinition: String(g?.plainDefinition || g?.definition || "").trim(),
                  }))
                  .filter((g: any) => g.term && g.plainDefinition)
              : [];
            setPatientSummary({
              studyOverview: raw.studyOverview || "",
              summary: raw.summary || "",
              keyFindings: findings,
              glossary,
            });
          } else {
            setPatientSummaryError(data.error || "Error al generar el resumen del paciente.");
          }
        } catch (err: any) {
          setPatientSummaryError(err?.message || String(err));
        } finally {
          setIsGeneratingPatientSummary(false);
        }
      })());
    }

    if (modules.glossary) promises.push(handleGenerateDynamicGlossary());
    if (modules.schematic) promises.push(handleGenerateSchematicSummary());
    // Scorecard first (findings-based), then organ suites guided by scorecard directives.
    // Organ suites must NOT require atlas/vascular to be checked — e.g. Suite Mama alone.
    const anyOrganSuite = Boolean(
      modules.atlas3d ||
        modules.vascular3d ||
        modules.thyroid3d ||
        modules.breast3d ||
        modules.shoulder3d ||
        modules.knee3d ||
        modules.ankle3d ||
        modules.kidney3d ||
        modules.abdomen3d ||
        modules.abdominalWall3d ||
        modules.scrotum3d ||
        modules.muscleTendon3d ||
        modules.wrist3d
    );
    if (modules.clinical_scorecard || anyOrganSuite) {
      promises.push((async () => {
        let scorecardForModules = clinicalScorecardData;

        if (modules.clinical_scorecard) {
          setIsClinicalScorecardOpen(true);
          try {
            const scResp = await fetch("/api/generate-clinical-scorecard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: modelFor("clinical_scorecard"),
                report: activeReport,
                studyType: specificStudy || studyType || "",
                protocolId: "auto",
                includeRecommendations: false,
              }),
            });
            const scJson = await scResp.json();
            if (scJson.success && scJson.data) {
              scorecardForModules = scJson.data;
              scorecardBridge = scJson.data;
              setClinicalScorecardData(scJson.data);
              // Scorecard activates for directives/Atlas; PDF annex stays opt-in
              setIncludeScorecardInReport(false);
              const directives = buildAtlasDirectivesFromScorecard(scJson.data);
              if (directives) setAtlasDirectivesFromScorecard(directives);
            } else {
              console.error("Scorecard en lote fallo:", scJson.error);
            }
          } catch (scErr) {
            console.error("Error al generar Scorecard en lote:", scErr);
          }
        }

        // Unlock diferencial / infografía as soon as category is known (suites can continue)
        releaseScorecardGate(scorecardBridge);

        if (modules.atlas3d) {
          try {
            const panelAssignments = buildAtlasPanelFindingAssignments(scorecardForModules);
            // With per-panel assignments, skip global Scorecard blob to avoid dominant-lesion bias.
            const scorecardDirectives = panelAssignments.length
              ? ""
              : buildAtlasDirectivesFromScorecard(scorecardForModules);
            const resp = await fetch("/api/generate-3d-atlas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                organOrStudy: specificStudy || studyType || "",
                laterality: (patientGender || "").toLowerCase().includes("izq") ? "Izquierda" : "",
                requestedModel: modelFor("atlas3d"),
                customDirectives: scorecardDirectives || undefined,
                panelAssignments: panelAssignments.length ? panelAssignments : undefined,
              })
            });
            const j = await resp.json();
            if (j.success && j.data) {
              let nextAtlas = j.data;
              if (scorecardForModules?.atlasOverlays?.length) {
                nextAtlas = mergeOverlaysOntoAtlas(nextAtlas, scorecardForModules.atlasOverlays, "shared") || nextAtlas;
              }
              nextAtlas =
                applyScorecardGovernanceToFigurePack(nextAtlas, scorecardForModules) || nextAtlas;
              setAtlas3dData(nextAtlas);
              setIncludeAtlas3dInReport(true);
            }
          } catch (atlasErr) {
            console.error("Error al generar Atlas 3D en lote:", atlasErr);
          }
        }

        if (modules.vascular3d) {
          try {
            const vascularDirectives = buildVascularDirectivesFromScorecard(scorecardForModules);
            const resp = await fetch("/api/generate-3d-vascular", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                requestedModel: modelFor("vascular3d"),
                customDirectives: vascularDirectives || undefined
              })
            });
            const j = await resp.json();
            if (j.success && j.data) {
              setVascular3dData(applyScorecardGovernanceToFigurePack(j.data, scorecardForModules) || j.data);
              setIncludeVascular3dInReport(true);
            }
          } catch (e) {
            console.error("Error en batch vascular 3d:", e);
          }
        }

        if (modules.thyroid3d) {
          try {
            const thyroidDirectives = buildThyroidDirectivesFromScorecard(scorecardForModules);
            const resp = await fetch("/api/generate-3d-thyroid", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                thyroidType: "general_thyroid",
                requestedModel: modelFor("thyroid3d"),
                customDirectives: thyroidDirectives || undefined
              })
            });
            const j = await resp.json();
            if (j.success && j.data) {
              setThyroid3dData(applyScorecardGovernanceToFigurePack(j.data, scorecardForModules) || j.data);
              setIncludeThyroid3dInReport(true);
              setIsThyroid3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch thyroid 3d:", e);
          }
        }

        if (modules.breast3d) {
          try {
            const breastDirectives = buildBreastDirectivesFromScorecard(scorecardForModules);
            const resp = await fetch("/api/generate-3d-breast", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                breastType: "general_breast",
                requestedModel: modelFor("breast3d"),
                customDirectives: breastDirectives || undefined
              })
            });
            const j = await resp.json();
            if (j.success && j.data) {
              setBreast3dData(applyScorecardGovernanceToFigurePack(j.data, scorecardForModules) || j.data);
              setIncludeBreast3dInReport(true);
              setIsBreast3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch breast 3d:", e);
          }
        }

        if (modules.shoulder3d) {
          try {
            const radarForShoulder = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const shoulderDirectives = buildShoulderDirectivesFromScorecard(scorecardForModules, radarForShoulder);
            const resp = await fetch("/api/generate-3d-shoulder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                shoulderType: "hombro_manguito",
                requestedModel: modelFor("shoulder3d"),
                customDirectives: shoulderDirectives || undefined
              })
            });
            const j = await resp.json();
            if (j.success && j.data) {
              setShoulder3dData(applyScorecardGovernanceToFigurePack(j.data, scorecardForModules) || j.data);
              setIncludeShoulder3dInReport(true);
              setIsShoulder3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch shoulder 3d:", e);
          }
        }

        if (modules.knee3d) {
          try {
            const radarForKnee = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const kneeDirectives = buildKneeDirectivesFromScorecard(scorecardForModules, radarForKnee);
            const resp = await fetch("/api/generate-3d-knee", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                kneeType: "rodilla_ligamentos",
                requestedModel: modelFor("knee3d"),
                customDirectives: kneeDirectives || undefined
              })
            });
            const j = await resp.json();
            if (j.success && j.data) {
              setKnee3dData(applyScorecardGovernanceToFigurePack(j.data, scorecardForModules) || j.data);
              setIncludeKnee3dInReport(true);
              setIsKnee3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch knee 3d:", e);
          }
        }

        if (modules.ankle3d) {
          try {
            const radarForAnkle = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const ankleDirectives = buildAnkleDirectivesFromScorecard(scorecardForModules, radarForAnkle);
            const resp = await fetch("/api/generate-3d-ankle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                ankleType: "tobillo_ligamentos",
                requestedModel: modelFor("ankle3d"),
                customDirectives: ankleDirectives || undefined
              })
            });
            const jAnkle = await resp.json();
            if (jAnkle.success && jAnkle.data) {
              setAnkle3dData(applyScorecardGovernanceToFigurePack(jAnkle.data, scorecardForModules) || jAnkle.data);
              setIncludeAnkle3dInReport(true);
              setIsAnkle3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch ankle 3d:", e);
          }
        }

        if (modules.kidney3d) {
          try {
            const radarForKidney = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const kidneyDirectives = buildKidneyDirectivesFromScorecard(scorecardForModules, radarForKidney);
            const resp = await fetch("/api/generate-3d-kidney", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                kidneyType: "renal_b_mode",
                requestedModel: modelFor("kidney3d"),
                customDirectives: kidneyDirectives || undefined
              })
            });
            const jKid = await resp.json();
            if (jKid.success && jKid.data) {
              setKidney3dData(applyScorecardGovernanceToFigurePack(jKid.data, scorecardForModules) || jKid.data);
              setIncludeKidney3dInReport(true);
              setIsKidney3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch kidney 3d:", e);
          }
        }

        if (modules.abdomen3d) {
          try {
            const radarForAbdomen = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const abdomenDirectives = buildAbdomenDirectivesFromScorecard(scorecardForModules, radarForAbdomen);
            const resp = await fetch("/api/generate-3d-abdomen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                abdomenType: "abdomen_completo",
                requestedModel: modelFor("abdomen3d"),
                customDirectives: abdomenDirectives || undefined
              })
            });
            const jAbd = await resp.json();
            if (jAbd.success && jAbd.data) {
              setAbdomen3dData(applyScorecardGovernanceToFigurePack(jAbd.data, scorecardForModules) || jAbd.data);
              setIncludeAbdomen3dInReport(true);
              setIsAbdomen3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch abdomen 3d:", e);
          }
        }

        if (modules.abdominalWall3d) {
          try {
            const radarForWall = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const wallDirectives = buildAbdominalWallDirectivesFromScorecard(scorecardForModules, radarForWall);
            const resp = await fetch("/api/generate-3d-abdominal-wall", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                abdominalWallType: "general_pared_abdominal",
                requestedModel: modelFor("abdominalWall3d"),
                customDirectives: wallDirectives || undefined
              })
            });
            const jWall = await resp.json();
            if (jWall.success && jWall.data) {
              setAbdominalWall3dData(applyScorecardGovernanceToFigurePack(jWall.data, scorecardForModules) || jWall.data);
              setIncludeAbdominalWall3dInReport(true);
              setIsAbdominalWall3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch abdominal wall 3d:", e);
          }
        }

        if (modules.scrotum3d) {
          try {
            const radarForScrotum = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const scrotumDirectives = buildScrotumDirectivesFromScorecard(scorecardForModules, radarForScrotum);
            const resp = await fetch("/api/generate-3d-scrotum", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                scrotumType: "general_scrotum",
                requestedModel: modelFor("scrotum3d"),
                customDirectives: scrotumDirectives || undefined
              })
            });
            const jScr = await resp.json();
            if (jScr.success && jScr.data) {
              setScrotum3dData(applyScorecardGovernanceToFigurePack(jScr.data, scorecardForModules) || jScr.data);
              setIncludeScrotum3dInReport(true);
              setIsScrotum3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch scrotum 3d:", e);
          }
        }

        if (modules.muscleTendon3d) {
          try {
            const radarForMuscleTendon = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const muscleTendonDirectives = buildMuscleTendonDirectivesFromScorecard(scorecardForModules, radarForMuscleTendon);
            const resp = await fetch("/api/generate-3d-muscle-tendon", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                muscleTendonType: "general_musculo_tendon",
                requestedModel: modelFor("muscleTendon3d"),
                customDirectives: muscleTendonDirectives || undefined
              })
            });
            const jMt = await resp.json();
            if (jMt.success && jMt.data) {
              setMuscleTendon3dData(applyScorecardGovernanceToFigurePack(jMt.data, scorecardForModules) || jMt.data);
              setIncludeMuscleTendon3dInReport(true);
              setIsMuscleTendon3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch muscle-tendon 3d:", e);
          }
        }

        if (modules.wrist3d) {
          try {
            const radarForWrist = biomechanicalRadarData
              ? {
                  radarMode: biomechanicalRadarData.radarMode,
                  dominantVector: biomechanicalRadarData.dominantVector,
                  clinicalSummary: biomechanicalRadarData.clinicalSummary,
                  globalScore: biomechanicalRadarData.globalScore,
                  axes: biomechanicalRadarData.axes,
                }
              : undefined;
            const wristDirectives = buildWristDirectivesFromScorecard(scorecardForModules, radarForWrist);
            const resp = await fetch("/api/generate-3d-wrist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportText: activeReport,
                wristType: "general_muneca",
                requestedModel: modelFor("wrist3d"),
                customDirectives: wristDirectives || undefined
              })
            });
            const jWr = await resp.json();
            if (jWr.success && jWr.data) {
              setWrist3dData(applyScorecardGovernanceToFigurePack(jWr.data, scorecardForModules) || jWr.data);
              setIncludeWrist3dInReport(true);
              setIsWrist3dSuiteOpen(true);
            }
          } catch (e) {
            console.error("Error en batch wrist 3d:", e);
          }
        }

      })());
    } else {
      releaseScorecardGate(scorecardBridge);
    }

    if (modules.reasoning_chain) {
      promises.push((async () => {
        setIsReasoningChainOpen(true);
        try {
          const resp = await fetch("/api/generate-reasoning-chain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("reasoning_chain"),
              report: activeReport,
              studyType: specificStudy || studyType || "",
              clinicalHistory: clinicalHistory || "",
              includeManagement: false,
            }),
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setReasoningChainData(j.data);
            setIncludeReasoningChainInReport(true);
          } else {
            console.error("Cadena de razonamiento en lote fallo:", j.error);
          }
        } catch (e) {
          console.error("Error al generar cadena de razonamiento en lote:", e);
        }
      })());
    }

    if (modules.negativity_checklist) {
      promises.push((async () => {
        setIsNegativityChecklistOpen(true);
        try {
          const resp = await fetch("/api/generate-negativity-checklist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("negativity_checklist"),
              report: activeReport,
              studyType: specificStudy || studyType || "",
              clinicalHistory: clinicalHistory || "",
            }),
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setNegativityChecklistData(j.data);
            // Checklist activates for clinical polish; PDF annex stays opt-in
            setIncludeNegativityChecklistInReport(false);
          } else {
            console.error("Checklist de negatividad en lote fallo:", j.error);
          }
        } catch (e) {
          console.error("Error al generar checklist de negatividad en lote:", e);
        }
      })());
    }

    if (modules.second_reader) {
      promises.push((async () => {
        setIsSecondReaderOpen(true);
        try {
          const resp = await fetch("/api/generate-second-reader", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("second_reader"),
              report: activeReport,
              studyType: specificStudy || studyType || "",
              clinicalHistory: clinicalHistory || "",
            }),
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setSecondReaderData(j.data);
          } else {
            console.error("Segundo lector en lote fallo:", j.error);
          }
        } catch (e) {
          console.error("Error al generar segundo lector en lote:", e);
        }
      })());
    }

    if (modules.differential_tree) {
      promises.push((async () => {
        setIsDifferentialTreeOpen(true);
        try {
          await scorecardGate;
          const sc = scorecardBridge;
          const {
            alignDifferentialTreeToScorecard,
            differentialFocusFromScorecard,
            getScorecardGovernance,
          } = await import("./clinicalIntelligence");
          const gov = getScorecardGovernance(sc);
          const scoreFocus = differentialFocusFromScorecard(sc);
          const resp = await fetch("/api/generate-differential-tree", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("differential_tree"),
              report: activeReport,
              studyType: specificStudy || studyType || "",
              clinicalHistory: clinicalHistory || "",
              includeManagement: false,
              focusText: scoreFocus || undefined,
              scorecardCategory: gov?.categoryAssigned || undefined,
              scorecardProtocol: gov?.protocolName || undefined,
              scorecardRecommendation: gov?.recommendation || undefined,
            }),
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setDifferentialTreeData(
              alignDifferentialTreeToScorecard(j.data, sc) || j.data
            );
            setIncludeDifferentialTreeInReport(true);
          } else {
            console.error("Arbol de diferenciales en lote fallo:", j.error);
          }
        } catch (e) {
          console.error("Error al generar arbol de diferenciales en lote:", e);
        }
      })());
    }

    if (modules.semiotics_conduct_matrix) {
      promises.push((async () => {
        setIsSemioticsConductMatrixOpen(true);
        try {
          const resp = await fetch("/api/generate-semiotics-conduct-matrix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("semiotics_conduct_matrix"),
              report: activeReport,
              studyType: specificStudy || studyType || "",
              clinicalHistory: clinicalHistory || "",
              focusTopic: "Auto (del informe)",
              focusPreset: "auto",
            }),
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setSemioticsConductMatrixData(j.data);
            setIncludeSemioticsConductMatrixInReport(true);
          } else {
            console.error("Matriz semiologia-conducta en lote fallo:", j.error);
          }
        } catch (e) {
          console.error("Error al generar matriz semiologia-conducta en lote:", e);
        }
      })());
    }

    if (modules.findings_infographic) {
      promises.push((async () => {
        setIsFindingsInfographicOpen(true);
        try {
          await scorecardGate;
          const sc = scorecardBridge;
          const { getScorecardGovernance } = await import("./clinicalIntelligence");
          const { infographicFromScorecard } = await import("./infographicFromModules");
          const gov = getScorecardGovernance(sc);
          if (sc && gov?.categoryAssigned) {
            setFindingsInfographicData(infographicFromScorecard(sc));
            setIncludeFindingsInfographicInReport(true);
            return;
          }
          const resp = await fetch("/api/generate-findings-infographic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelFor("findings_infographic"),
              report: activeReport,
              studyType: specificStudy || studyType || "",
              clinicalHistory: clinicalHistory || "",
              diagnosis: "Diagnóstico del informe",
              diagnosisPreset: "auto",
              layout: "auto",
              contentMode: "justify_diagnosis",
            }),
          });
          const j = await resp.json();
          if (j.success && j.data) {
            setFindingsInfographicData(j.data);
            setIncludeFindingsInfographicInReport(true);
          } else {
            console.error("Infografia de hallazgos en lote fallo:", j.error);
          }
        } catch (e) {
          console.error("Error al generar infografia de hallazgos en lote:", e);
        }
      })());
    }

    try {
      await Promise.allSettled(promises);
      const activeCount = Object.values(modules).filter(Boolean).length;
      setBatchSuccessMessage(`¡Éxito! Se han activado y procesado ${activeCount} módulos seleccionados en lote.`);
      setTimeout(() => setBatchSuccessMessage(null), 6000);
    } catch (err) {
      console.error("Error al procesar módulos en lote:", err);
    } finally {
      setIsActivatingBatch(false);
    }
  };
}
