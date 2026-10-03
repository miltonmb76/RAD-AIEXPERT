import React from "react";
import { Knee3DData, ClinicalScorecardData } from "../types";
import { kneeSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Knee3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  kneeData: Knee3DData | null;
  setKneeData: (data: Knee3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + kneeSuiteConfig. */
export const Knee3DModule: React.FC<Knee3DModuleProps> = ({
  kneeData,
  setKneeData,
  ...rest
}) => (
  <OrganSuiteShell
    config={kneeSuiteConfig}
    data={kneeData as OrganSuiteData | null}
    setData={(next) => setKneeData(next as Knee3DData | null)}
    {...rest}
  />
);
