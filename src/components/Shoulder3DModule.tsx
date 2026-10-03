import React from "react";
import { Shoulder3DData, ClinicalScorecardData } from "../types";
import { shoulderSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Shoulder3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  shoulderData: Shoulder3DData | null;
  setShoulderData: (data: Shoulder3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + shoulderSuiteConfig. */
export const Shoulder3DModule: React.FC<Shoulder3DModuleProps> = ({
  shoulderData,
  setShoulderData,
  ...rest
}) => (
  <OrganSuiteShell
    config={shoulderSuiteConfig}
    data={shoulderData as OrganSuiteData | null}
    setData={(next) => setShoulderData(next as Shoulder3DData | null)}
    {...rest}
  />
);
