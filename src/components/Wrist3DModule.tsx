import React from "react";
import { Wrist3DData, ClinicalScorecardData } from "../types";
import { wristSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Wrist3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  wristData: Wrist3DData | null;
  setWristData: (data: Wrist3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + wristSuiteConfig. */
export const Wrist3DModule: React.FC<Wrist3DModuleProps> = ({
  wristData,
  setWristData,
  ...rest
}) => (
  <OrganSuiteShell
    config={wristSuiteConfig}
    data={wristData as OrganSuiteData | null}
    setData={(next) => setWristData(next as Wrist3DData | null)}
    {...rest}
  />
);
