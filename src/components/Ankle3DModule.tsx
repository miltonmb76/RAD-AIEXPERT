import React from "react";
import { Ankle3DData, ClinicalScorecardData } from "../types";
import { ankleSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Ankle3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  ankleData: Ankle3DData | null;
  setAnkleData: (data: Ankle3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + ankleSuiteConfig. */
export const Ankle3DModule: React.FC<Ankle3DModuleProps> = ({
  ankleData,
  setAnkleData,
  ...rest
}) => (
  <OrganSuiteShell
    config={ankleSuiteConfig}
    data={ankleData as OrganSuiteData | null}
    setData={(next) => setAnkleData(next as Ankle3DData | null)}
    {...rest}
  />
);
