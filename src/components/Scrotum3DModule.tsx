import React from "react";
import { Scrotum3DData, ClinicalScorecardData } from "../types";
import { scrotumSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Scrotum3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  scrotumData: Scrotum3DData | null;
  setScrotumData: (data: Scrotum3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + scrotumSuiteConfig. */
export const Scrotum3DModule: React.FC<Scrotum3DModuleProps> = ({
  scrotumData,
  setScrotumData,
  ...rest
}) => (
  <OrganSuiteShell
    config={scrotumSuiteConfig}
    data={scrotumData as OrganSuiteData | null}
    setData={(next) => setScrotumData(next as Scrotum3DData | null)}
    {...rest}
  />
);
