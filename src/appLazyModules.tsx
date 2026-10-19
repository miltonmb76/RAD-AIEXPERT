import React from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { lazyRetry } from "./lib/lazyRetry";

const BibliographySearch = lazyRetry(() => import("./components/BibliographySearch"));
const ImageSearch = lazyRetry(() => import("./components/ImageSearch"));
const ExpertImageAnalysis = lazyRetry(() => import("./components/ExpertImageAnalysis"));
const ZipDicomExtractor = lazyRetry(() => import("./components/ZipDicomExtractor"));
const AsistenteMedidas = lazyRetry(
  () => import("./components/AsistenteMedidas"),
  "AsistenteMedidas"
);
const CreadorNotasPie = lazyRetry(
  () => import("./components/CreadorNotasPie"),
  "CreadorNotasPie"
);
const BiomechanicalRadarModule = lazyRetry(
  () => import("./components/BiomechanicalRadarModule"),
  "BiomechanicalRadarModule"
);
const ClinicalScorecardModule = lazyRetry(
  () => import("./components/ClinicalScorecardModule"),
  "ClinicalScorecardModule"
);
const ReasoningChainModule = lazyRetry(
  () => import("./components/ReasoningChainModule"),
  "ReasoningChainModule"
);
const NegativityChecklistModule = lazyRetry(
  () => import("./components/NegativityChecklistModule"),
  "NegativityChecklistModule"
);
const SecondReaderModule = lazyRetry(
  () => import("./components/SecondReaderModule"),
  "SecondReaderModule"
);
const ReportEnrichmentPanel = lazyRetry(
  () => import("./components/ReportEnrichmentPanel"),
  "ReportEnrichmentPanel"
);
const ReportQaGateModal = lazyRetry(
  () => import("./components/ReportQaGateModal"),
  "ReportQaGateModal"
);
const DifferentialTreeModule = lazyRetry(
  () => import("./components/DifferentialTreeModule"),
  "DifferentialTreeModule"
);
const SemioticsConductMatrixModule = lazyRetry(
  () => import("./components/SemioticsConductMatrixModule"),
  "SemioticsConductMatrixModule"
);
const FindingsInfographicModule = lazyRetry(
  () => import("./components/FindingsInfographicModule"),
  "FindingsInfographicModule"
);
const DominantLesionCardModule = lazyRetry(
  () => import("./components/DominantLesionCardModule"),
  "DominantLesionCardModule"
);
const FindingExplainerModule = lazyRetry(
  () => import("./components/FindingExplainerModule"),
  "FindingExplainerModule"
);
const DiagnosticPackModule = lazyRetry(
  () => import("./components/DiagnosticPackModule"),
  "DiagnosticPackModule"
);
const FindingsMapModule = lazyRetry(
  () => import("./components/FindingsMapModule"),
  "FindingsMapModule"
);
const DiagnosisAnchorBar = lazyRetry(
  () => import("./components/DiagnosisAnchorBar"),
  "DiagnosisAnchorBar"
);
const MeasurementsGaugeModule = lazyRetry(
  () => import("./components/MeasurementsGaugeModule"),
  "MeasurementsGaugeModule"
);
const CreadorCuadroSinoptico = lazyRetry(
  () => import("./components/CreadorCuadroSinoptico"),
  "CreadorCuadroSinoptico"
);
const CreadorSinopsisFracturas = lazyRetry(
  () => import("./components/CreadorSinopsisFracturas"),
  "CreadorSinopsisFracturas"
);
const ElastographyQUSPresentationModule = lazyRetry(
  () => import("./components/ElastographyQUSPresentationModule"),
  "ElastographyQUSPresentationModule"
);

// 3D suites / spatial modules — load only when first opened
const Atlas3DModule = lazyRetry(() => import("./components/Atlas3DModule"), "Atlas3DModule");
const Vascular3DModule = lazyRetry(
  () => import("./components/Vascular3DModule"),
  "Vascular3DModule"
);
const FocalLesion3DModule = lazyRetry(
  () => import("./components/FocalLesion3DModule"),
  "FocalLesion3DModule"
);
const UltrasoundPlaneSimulatorModule = lazyRetry(
  () => import("./components/UltrasoundPlaneSimulatorModule"),
  "UltrasoundPlaneSimulatorModule"
);
const Thyroid3DModule = lazyRetry(() => import("./components/Thyroid3DModule"), "Thyroid3DModule");
const Breast3DModule = lazyRetry(() => import("./components/Breast3DModule"), "Breast3DModule");
const Shoulder3DModule = lazyRetry(
  () => import("./components/Shoulder3DModule"),
  "Shoulder3DModule"
);
const Knee3DModule = lazyRetry(() => import("./components/Knee3DModule"), "Knee3DModule");
const Ankle3DModule = lazyRetry(() => import("./components/Ankle3DModule"), "Ankle3DModule");
const Kidney3DModule = lazyRetry(() => import("./components/Kidney3DModule"), "Kidney3DModule");
const Abdomen3DModule = lazyRetry(() => import("./components/Abdomen3DModule"), "Abdomen3DModule");
const AbdominalWall3DModule = lazyRetry(
  () => import("./components/AbdominalWall3DModule"),
  "AbdominalWall3DModule"
);
const Scrotum3DModule = lazyRetry(() => import("./components/Scrotum3DModule"), "Scrotum3DModule");
const MuscleTendon3DModule = lazyRetry(
  () => import("./components/MuscleTendon3DModule"),
  "MuscleTendon3DModule"
);
const Wrist3DModule = lazyRetry(() => import("./components/Wrist3DModule"), "Wrist3DModule");

export function Suite3DSuspense({
  children,
  label = "suite 3D",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <AppErrorBoundary label={label}>
      <React.Suspense
        fallback={
          <div className="p-4 text-xs font-mono text-cyan-400 bg-slate-900/60 rounded-xl border border-cyan-900/40 animate-pulse">
            {`Cargando ${label}...`}
          </div>
        }
      >
        {children}
      </React.Suspense>
    </AppErrorBoundary>
  );
}

export {
  BibliographySearch,
  ImageSearch,
  ExpertImageAnalysis,
  ZipDicomExtractor,
  AsistenteMedidas,
  CreadorNotasPie,
  BiomechanicalRadarModule,
  ClinicalScorecardModule,
  ReasoningChainModule,
  NegativityChecklistModule,
  SecondReaderModule,
  ReportEnrichmentPanel,
  ReportQaGateModal,
  DifferentialTreeModule,
  SemioticsConductMatrixModule,
  FindingsInfographicModule,
  DominantLesionCardModule,
  FindingExplainerModule,
  DiagnosticPackModule,
  FindingsMapModule,
  DiagnosisAnchorBar,
  MeasurementsGaugeModule,
  CreadorCuadroSinoptico,
  CreadorSinopsisFracturas,
  ElastographyQUSPresentationModule,
  Atlas3DModule,
  Vascular3DModule,
  FocalLesion3DModule,
  UltrasoundPlaneSimulatorModule,
  Thyroid3DModule,
  Breast3DModule,
  Shoulder3DModule,
  Knee3DModule,
  Ankle3DModule,
  Kidney3DModule,
  Abdomen3DModule,
  AbdominalWall3DModule,
  Scrotum3DModule,
  MuscleTendon3DModule,
  Wrist3DModule,
};
