import React from "react";
import { AbdominalWall3DData, ClinicalScorecardData } from "../types";
import { abdominalWallSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface AbdominalWall3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  abdominalWallData: AbdominalWall3DData | null;
  setAbdominalWallData: (data: AbdominalWall3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + abdominalWallSuiteConfig. */
export const AbdominalWall3DModule: React.FC<AbdominalWall3DModuleProps> = ({
  abdominalWallData,
  setAbdominalWallData,
  ...rest
}) => (
  <OrganSuiteShell
    config={abdominalWallSuiteConfig}
    data={abdominalWallData as OrganSuiteData | null}
    setData={(next) => setAbdominalWallData(next as AbdominalWall3DData | null)}
    {...rest}
  />
);
