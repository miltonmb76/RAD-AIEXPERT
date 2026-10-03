import React from "react";
import { Kidney3DData, ClinicalScorecardData } from "../types";
import { kidneySuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Kidney3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  kidneyData: Kidney3DData | null;
  setKidneyData: (data: Kidney3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + kidneySuiteConfig. */
export const Kidney3DModule: React.FC<Kidney3DModuleProps> = ({
  kidneyData,
  setKidneyData,
  ...rest
}) => (
  <OrganSuiteShell
    config={kidneySuiteConfig}
    data={kidneyData as OrganSuiteData | null}
    setData={(next) => setKidneyData(next as Kidney3DData | null)}
    {...rest}
  />
);
