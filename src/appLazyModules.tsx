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
const MeasurementsGaugeModule = React.lazy(() => import("./components/MeasurementsGaugeModule").then(m => ({ default: m.MeasurementsGaugeModule })));
const CreadorCuadroSinoptico = React.lazy(() => import("./components/CreadorCuadroSinoptico").then(m => ({ default: m.CreadorCuadroSinoptico })));
const CreadorSinopsisFracturas = React.lazy(() => import("./components/CreadorSinopsisFracturas").then(m => ({ default: m.CreadorSinopsisFracturas })));
const ElastographyQUSPresentationModule = React.lazy(() => import("./components/ElastographyQUSPresentationModule").then(m => ({ default: m.ElastographyQUSPresentationModule })));

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
  MeasurementsGaugeModule,
  CreadorCuadroSinoptico,
  CreadorSinopsisFracturas,
  ElastographyQUSPresentationModule,
};
