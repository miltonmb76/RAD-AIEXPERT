import React from "react";
import { Vascular3DData, ClinicalScorecardData } from "../types";
import { vascularSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Vascular3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  vascularData: Vascular3DData | null;
  setVascularData: (data: Vascular3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + vascularSuiteConfig. */
export const Vascular3DModule: React.FC<Vascular3DModuleProps> = ({
  vascularData,
  setVascularData,
  ...rest
}) => (
  <OrganSuiteShell
    config={vascularSuiteConfig}
    data={vascularData as OrganSuiteData | null}
    setData={(next) => setVascularData(next as Vascular3DData | null)}
    {...rest}
  />
);
