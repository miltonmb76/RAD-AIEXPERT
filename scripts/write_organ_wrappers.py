#!/usr/bin/env python3
WRAPPERS = [
    ("Shoulder", "Shoulder3DData", "shoulderData", "setShoulderData", "shoulderSuiteConfig"),
    ("Ankle", "Ankle3DData", "ankleData", "setAnkleData", "ankleSuiteConfig"),
    ("Kidney", "Kidney3DData", "kidneyData", "setKidneyData", "kidneySuiteConfig"),
    ("Thyroid", "Thyroid3DData", "thyroidData", "setThyroidData", "thyroidSuiteConfig"),
    ("Breast", "Breast3DData", "breastData", "setBreastData", "breastSuiteConfig"),
    ("AbdominalWall", "AbdominalWall3DData", "abdominalWallData", "setAbdominalWallData", "abdominalWallSuiteConfig"),
    ("Scrotum", "Scrotum3DData", "scrotumData", "setScrotumData", "scrotumSuiteConfig"),
    ("MuscleTendon", "MuscleTendon3DData", "muscleTendonData", "setMuscleTendonData", "muscleTendonSuiteConfig"),
    ("Wrist", "Wrist3DData", "wristData", "setWristData", "wristSuiteConfig"),
    ("Vascular", "Vascular3DData", "vascularData", "setVascularData", "vascularSuiteConfig"),
]

TEMPLATE = """import React from "react";
import { __DATA_TYPE__, ClinicalScorecardData } from "../types";
import { __CFG__, OrganSuiteData } from "../lib/organSuiteConfig";
import { OrganSuiteShell } from "./OrganSuiteShell";

interface __NAME__3DModuleProps {
  reportText: string;
  activeProtocol?: string;
  laterality?: string;
  selectedModel?: string;
  __PROP__: __DATA_TYPE__ | null;
  __SETTER__: (data: __DATA_TYPE__ | null) => void;
  includeInReport: boolean;
  setIncludeInReport: (include: boolean) => void;
  onClose?: () => void;
  scorecardData?: ClinicalScorecardData | null;
  externalDirectives?: string;
}

/** Thin wrapper — UI/logic lives in OrganSuiteShell + __CFG__. */
export const __NAME__3DModule: React.FC<__NAME__3DModuleProps> = ({
  __PROP__,
  __SETTER__,
  ...rest
}) => (
  <OrganSuiteShell
    config={__CFG__}
    data={__PROP__ as OrganSuiteData | null}
    setData={(next) => __SETTER__(next as __DATA_TYPE__ | null)}
    {...rest}
  />
);
"""

for name, data_type, prop, setter, cfg in WRAPPERS:
    content = (
        TEMPLATE.replace("__NAME__", name)
        .replace("__DATA_TYPE__", data_type)
        .replace("__PROP__", prop)
        .replace("__SETTER__", setter)
        .replace("__CFG__", cfg)
    )
    path = f"/workspace/src/components/{name}3DModule.tsx"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", path)
