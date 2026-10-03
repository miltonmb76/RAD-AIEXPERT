import React from "react";
import { Breast3DData, ClinicalScorecardData } from "../types";
import { breastSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Breast3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  breastData: Breast3DData | null;
  setBreastData: (data: Breast3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + breastSuiteConfig. */
export const Breast3DModule: React.FC<Breast3DModuleProps> = ({
  breastData,
  setBreastData,
  ...rest
}) => (
  <OrganSuiteShell
    config={breastSuiteConfig}
    data={breastData as OrganSuiteData | null}
    setData={(next) => setBreastData(next as Breast3DData | null)}
    {...rest}
  />
);
