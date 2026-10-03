import React from "react";
import { MuscleTendon3DData, ClinicalScorecardData } from "../types";
import { muscleTendonSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface MuscleTendon3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  muscleTendonData: MuscleTendon3DData | null;
  setMuscleTendonData: (data: MuscleTendon3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + muscleTendonSuiteConfig. */
export const MuscleTendon3DModule: React.FC<MuscleTendon3DModuleProps> = ({
  muscleTendonData,
  setMuscleTendonData,
  ...rest
}) => (
  <OrganSuiteShell
    config={muscleTendonSuiteConfig}
    data={muscleTendonData as OrganSuiteData | null}
    setData={(next) => setMuscleTendonData(next as MuscleTendon3DData | null)}
    {...rest}
  />
);
