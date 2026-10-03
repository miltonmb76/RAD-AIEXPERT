import React from "react";
import { Abdomen3DData, ClinicalScorecardData } from "../types";
import { abdomenSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Abdomen3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  abdomenData: Abdomen3DData | null;
  setAbdomenData: (data: Abdomen3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + abdomenSuiteConfig. */
export const Abdomen3DModule: React.FC<Abdomen3DModuleProps> = ({
  abdomenData,
  setAbdomenData,
  ...rest
}) => (
  <OrganSuiteShell
    config={abdomenSuiteConfig}
    data={abdomenData as OrganSuiteData | null}
    setData={(next) => setAbdomenData(next as Abdomen3DData | null)}
    {...rest}
  />
);
