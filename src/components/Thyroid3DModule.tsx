import React from "react";
import { Thyroid3DData, ClinicalScorecardData } from "../types";
import { thyroidSuiteConfig, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface Thyroid3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  thyroidData: Thyroid3DData | null;
  setThyroidData: (data: Thyroid3DData | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + thyroidSuiteConfig. */
export const Thyroid3DModule: React.FC<Thyroid3DModuleProps> = ({
  thyroidData,
  setThyroidData,
  ...rest
}) => (
  <OrganSuiteShell
    config={thyroidSuiteConfig}
    data={thyroidData as OrganSuiteData | null}
    setData={(next) => setThyroidData(next as Thyroid3DData | null)}
    {...rest}
  />
);
