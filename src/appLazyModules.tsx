import React from "react";

const BibliographySearch = React.lazy(() => import("./components/BibliographySearch"));
const ImageSearch = React.lazy(() => import("./components/ImageSearch"));
const ExpertImageAnalysis = React.lazy(() => import("./components/ExpertImageAnalysis"));
const ZipDicomExtractor = React.lazy(() => import("./components/ZipDicomExtractor"));
const AsistenteMedidas = React.lazy(() => import("./components/AsistenteMedidas").then(m => ({ default: m.AsistenteMedidas })));
const CreadorNotasPie = React.lazy(() => import("./components/CreadorNotasPie").then(m => ({ default: m.CreadorNotasPie })));
const BiomechanicalRadarModule = React.lazy(() => import("./components/BiomechanicalRadarModule").then(m => ({ default: m.BiomechanicalRadarModule })));
const ClinicalScorecardModule = React.lazy(() => import("./components/ClinicalScorecardModule").then(m => ({ default: m.ClinicalScorecardModule })));
const ReasoningChainModule = React.lazy(() => import("./components/ReasoningChainModule").then(m => ({ default: m.ReasoningChainModule })));
const NegativityChecklistModule = React.lazy(() => import("./components/NegativityChecklistModule").then(m => ({ default: m.NegativityChecklistModule })));
const SecondReaderModule = React.lazy(() => import("./components/SecondReaderModule").then(m => ({ default: m.SecondReaderModule })));
const ReportEnrichmentPanel = React.lazy(() => import("./components/ReportEnrichmentPanel").then(m => ({ default: m.ReportEnrichmentPanel })));
const ReportQaGateModal = React.lazy(() => import("./components/ReportQaGateModal").then(m => ({ default: m.ReportQaGateModal })));
const DifferentialTreeModule = React.lazy(() => import("./components/DifferentialTreeModule").then(m => ({ default: m.DifferentialTreeModule })));
const SemioticsConductMatrixModule = React.lazy(() => import("./components/SemioticsConductMatrixModule").then(m => ({ default: m.SemioticsConductMatrixModule })));
const FindingsInfographicModule = React.lazy(() => import("./components/FindingsInfographicModule").then(m => ({ default: m.FindingsInfographicModule })));
const DominantLesionCardModule = React.lazy(() => import("./components/DominantLesionCardModule").then(m => ({ default: m.DominantLesionCardModule })));
const MeasurementsGaugeModule = React.lazy(() => import("./components/MeasurementsGaugeModule").then(m => ({ default: m.MeasurementsGaugeModule })));
const CreadorCuadroSinoptico = React.lazy(() => import("./components/CreadorCuadroSinoptico").then(m => ({ default: m.CreadorCuadroSinoptico })));
const CreadorSinopsisFracturas = React.lazy(() => import("./components/CreadorSinopsisFracturas").then(m => ({ default: m.CreadorSinopsisFracturas })));
const ElastographyQUSPresentationModule = React.lazy(() => import("./components/ElastographyQUSPresentationModule").then(m => ({ default: m.ElastographyQUSPresentationModule })));

// 3D suites / spatial modules — load only when first opened
const Atlas3DModule = React.lazy(() => import("./components/Atlas3DModule").then(m => ({ default: m.Atlas3DModule })));
const Vascular3DModule = React.lazy(() => import("./components/Vascular3DModule").then(m => ({ default: m.Vascular3DModule })));
const FocalLesion3DModule = React.lazy(() => import("./components/FocalLesion3DModule").then(m => ({ default: m.FocalLesion3DModule })));
const UltrasoundPlaneSimulatorModule = React.lazy(() => import("./components/UltrasoundPlaneSimulatorModule").then(m => ({ default: m.UltrasoundPlaneSimulatorModule })));
const Thyroid3DModule = React.lazy(() => import("./components/Thyroid3DModule").then(m => ({ default: m.Thyroid3DModule })));
const Breast3DModule = React.lazy(() => import("./components/Breast3DModule").then(m => ({ default: m.Breast3DModule })));
const Shoulder3DModule = React.lazy(() => import("./components/Shoulder3DModule").then(m => ({ default: m.Shoulder3DModule })));
const Knee3DModule = React.lazy(() => import("./components/Knee3DModule").then(m => ({ default: m.Knee3DModule })));
const Ankle3DModule = React.lazy(() => import("./components/Ankle3DModule").then(m => ({ default: m.Ankle3DModule })));
const Kidney3DModule = React.lazy(() => import("./components/Kidney3DModule").then(m => ({ default: m.Kidney3DModule })));
const Abdomen3DModule = React.lazy(() => import("./components/Abdomen3DModule").then(m => ({ default: m.Abdomen3DModule })));
const AbdominalWall3DModule = React.lazy(() => import("./components/AbdominalWall3DModule").then(m => ({ default: m.AbdominalWall3DModule })));
const Scrotum3DModule = React.lazy(() => import("./components/Scrotum3DModule").then(m => ({ default: m.Scrotum3DModule })));
const MuscleTendon3DModule = React.lazy(() => import("./components/MuscleTendon3DModule").then(m => ({ default: m.MuscleTendon3DModule })));
const Wrist3DModule = React.lazy(() => import("./components/Wrist3DModule").then(m => ({ default: m.Wrist3DModule })));

export function Suite3DSuspense({
  children,
  label = "suite 3D",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="p-4 text-xs font-mono text-cyan-400 bg-slate-900/60 rounded-xl border border-cyan-900/40 animate-pulse">
          {`Cargando ${label}...`}
        </div>
      }
    >
      {children}
    </React.Suspense>
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
