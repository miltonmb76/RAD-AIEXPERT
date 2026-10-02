#!/usr/bin/env python3
"""Finish annotation rollout: suggest buttons + Focal + Atlas UI/PDF."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
COMP = ROOT / "src" / "components"
UTILS = ROOT / "src" / "utils"

SUITE_BTNS = [
    dict(file="Thyroid3DModule.tsx", data="thyroidData", set="setThyroidData",
         table="noduleTable", textKeys='["location", "composition", "echogenicity"]',
         sizeKeys='["size"]', btn="teal"),
    dict(file="Breast3DModule.tsx", data="breastData", set="setBreastData",
         table="lesionTable", textKeys='["location", "shape", "echogenicity"]',
         sizeKeys='["size"]', btn="pink"),
    dict(file="Shoulder3DModule.tsx", data="shoulderData", set="setShoulderData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrThickness", "size"]', btn="indigo"),
    dict(file="Knee3DModule.tsx", data="kneeData", set="setKneeData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrThickness", "size"]', btn="cyan"),
    dict(file="Ankle3DModule.tsx", data="ankleData", set="setAnkleData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrThickness", "size"]', btn="emerald"),
    dict(file="Kidney3DModule.tsx", data="kidneyData", set="setKidneyData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrThickness", "size"]', btn="sky"),
    dict(file="AbdominalWall3DModule.tsx", data="abdominalWallData", set="setAbdominalWallData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrGap", "size"]', btn="amber"),
    dict(file="Scrotum3DModule.tsx", data="scrotumData", set="setScrotumData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrThickness", "size"]', btn="violet"),
    dict(file="MuscleTendon3DModule.tsx", data="muscleTendonData", set="setMuscleTendonData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrThickness", "size"]', btn="orange"),
    dict(file="Wrist3DModule.tsx", data="wristData", set="setWristData",
         table="findingTable", textKeys='["structure", "location"]',
         sizeKeys='["sizeOrThickness", "size"]', btn="lime"),
    dict(file="Vascular3DModule.tsx", data="vascularData", set="setVascularData",
         table="hemodynamicTable", textKeys='["vessel", "plaqueOrThrombus"]',
         sizeKeys='["stenosisPercent", "patternOrVelocity"]', btn="rose"),
]


def read(path: Path) -> str:
    return path.read_bytes().decode("utf-8")


def write(path: Path, text: str) -> None:
    path.write_bytes(text.encode("utf-8"))


def suggest_button(cfg: dict) -> str:
    data, sett, btn = cfg["data"], cfg["set"], cfg["btn"]
    return (
        '              <button\n'
        '                type="button"\n'
        "                onClick={() => {\n"
        f"                  if (!{data}) return;\n"
        f"                  const letters = ({data}.panels || []).map((p) => p.panelLetter);\n"
        "                  const suggested = suggestFromTableRows(\n"
        f"                    (({data} as any).{cfg['table']}) || [],\n"
        "                    letters,\n"
        f"                    {cfg['textKeys']},\n"
        f"                    {cfg['sizeKeys']},\n"
        "                    3\n"
        "                  );\n"
        "                  if (!suggested.length) return;\n"
        f"                  {sett}({{\n"
        f"                    ...{data},\n"
        "                    imageAnnotations: [\n"
        f"                      ...({data}.imageAnnotations || []),\n"
        "                      ...suggested,\n"
        "                    ],\n"
        "                  });\n"
        "                }}\n"
        f'                className="text-[10px] font-bold text-{btn}-800 bg-{btn}-50 hover:bg-{btn}-100 border border-{btn}-200 rounded-lg px-2.5 py-1"\n'
        "              >\n"
        "                Sugerir anotaciones desde tabla\n"
        "              </button>\n"
    )


def add_suite_suggest_buttons() -> None:
    for cfg in SUITE_BTNS:
        path = COMP / cfg["file"]
        text = read(path)
        if "Sugerir anotaciones desde tabla" in text:
            print("BTN SKIP", cfg["file"])
            continue
        # Match h4 with mb-3 near volumetric reconstruction header (accent-safe)
        h4pat = (
            r'(<h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 '
            r'flex items-center gap-1\.5">[\s\S]{0,400}?</h4>)'
        )
        hm = re.search(h4pat, text)
        if not hm or "Paneles" not in hm.group(1):
            print("BTN MISS", cfg["file"])
            continue
        inner = hm.group(1).replace(" mb-3 ", " ")
        wrapped = (
            '<div className="mb-3 flex flex-wrap items-center justify-between gap-2">\n'
            f"              {inner}\n"
            f"{suggest_button(cfg)}"
            "            </div>"
        )
        text = text[: hm.start()] + wrapped + text[hm.end() :]
        write(path, text)
        print("BTN OK", cfg["file"])


def patch_focal() -> None:
    path = COMP / "FocalLesion3DModule.tsx"
    text = read(path)
    if "SuiteImageAnnotationLayer" in text and "suggestFocalImageAnnotations" in text:
        print("FOCAL SKIP already")
        return

    # Imports
    if "SuiteImageAnnotation" not in text.split("from \"../types\"")[0][-200:]:
        text = text.replace(
            "import { FocalLesion3DData, FocalLesion3DPanel, ClinicalScorecardData } from \"../types\";",
            "import { FocalLesion3DData, FocalLesion3DPanel, ClinicalScorecardData, SuiteImageAnnotation } from \"../types\";",
        )
    if "suiteImageAnnotations" not in text:
        text = text.replace(
            "import { sanitizeFocalClinicalProse } from \"../utils/sanitizeFocalClinicalProse\";",
            "import { sanitizeFocalClinicalProse } from \"../utils/sanitizeFocalClinicalProse\";\n"
            "import {\n"
            "  remapAnnotationsPanelLetters,\n"
            "  suggestFocalImageAnnotations,\n"
            "  withSuggestedImageAnnotations,\n"
            "} from \"../lib/suiteImageAnnotations\";\n"
            "import { SuiteImageAnnotationLayer } from \"./SuiteImageAnnotationLayer\";",
        )

    if "selectedAnnotationId" not in text:
        text = text.replace(
            "const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);",
            "const [regeneratingPanelLetter, setRegeneratingPanelLetter] = useState<string | null>(null);\n"
            "  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);",
            1,
        )

    # On generate
    if "withSuggestedImageAnnotations" not in text:
        text = text.replace(
            "setFocalData(resData.data);",
            "const data = resData.data as FocalLesion3DData;\n"
            "        const letters = (data.panels || []).map((p) => p.panelLetter).filter(Boolean);\n"
            "        const suggested = suggestFocalImageAnnotations({\n"
            "          panelLetters: letters,\n"
            "          lesionLabel: data.lesionLabel,\n"
            "          lesionSite: data.lesionSite,\n"
            "          lesionSize: data.lesionSize,\n"
            "        });\n"
            "        setFocalData(withSuggestedImageAnnotations(data, suggested));",
            1,
        )

    # Delete remap
    if "remapAnnotationsPanelLetters" not in text:
        text = text.replace(
            "setFocalData({\n"
            "      ...focalData,\n"
            "      figureTitle: updatedTitle,\n"
            "      panels: updatedPanels,\n"
            "    });",
            "setFocalData({\n"
            "      ...focalData,\n"
            "      figureTitle: updatedTitle,\n"
            "      panels: updatedPanels,\n"
            "      imageAnnotations: remapAnnotationsPanelLetters(\n"
            "        focalData.imageAnnotations,\n"
            "        letterMap,\n"
            "        panelLetter\n"
            "      ),\n"
            "    });",
            1,
        )

    # Helper
    if "const setImageAnnotations" not in text:
        text = text.replace(
            "const handleRegeneratePanel = async",
            "const setImageAnnotations = (next: SuiteImageAnnotation[]) => {\n"
            "    if (!focalData) return;\n"
            "    setFocalData({ ...focalData, imageAnnotations: next });\n"
            "  };\n\n"
            "  const handleRegeneratePanel = async",
            1,
        )

    # Layer over image
    if 'mode="layer"' not in text:
        layer = (
            "                  {panel.imageUrl && (\n"
            "                    <SuiteImageAnnotationLayer\n"
            "                      panelLetter={panel.panelLetter}\n"
            "                      annotations={focalData.imageAnnotations || []}\n"
            "                      onChange={setImageAnnotations}\n"
            '                      mode="layer"\n'
            "                      editable\n"
            "                      selectedId={selectedAnnotationId}\n"
            "                      onSelectId={setSelectedAnnotationId}\n"
            "                    />\n"
            "                  )}\n"
        )
        marker = '                  <div className="absolute top-2 left-2 flex gap-1.5'
        if marker in text:
            text = text.replace(marker, layer + marker, 1)
        else:
            print("FOCAL NO LAYER SLOT")

        # z-index badges
        text = text.replace(
            'className="absolute top-2 left-2 flex gap-1.5',
            'className="absolute top-2 left-2 z-10 flex gap-1.5',
            1,
        )
        text = text.replace(
            'className="absolute top-2 right-2 flex gap-1 opacity-0',
            'className="absolute top-2 right-2 z-10 flex gap-1 opacity-0',
            1,
        )

    # Toolbar under image
    if 'mode="toolbar"' not in text:
        toolbar = (
            "                  {panel.imageUrl && (\n"
            "                    <SuiteImageAnnotationLayer\n"
            "                      panelLetter={panel.panelLetter}\n"
            "                      annotations={focalData.imageAnnotations || []}\n"
            "                      onChange={setImageAnnotations}\n"
            '                      mode="toolbar"\n'
            "                      editable\n"
            "                      selectedId={selectedAnnotationId}\n"
            "                      onSelectId={setSelectedAnnotationId}\n"
            "                    />\n"
            "                  )}\n"
        )
        marker = '                <div className="px-3.5 pt-4 pb-3 space-y-2 border-t border-slate-800">\n'
        if marker in text:
            text = text.replace(
                marker,
                marker + toolbar,
                1,
            )
        else:
            print("FOCAL NO TOOLBAR SLOT")

    # Suggest button near panels grid
    if "Sugerir anotaciones" not in text:
        btn = (
            '          <div className="mb-3 flex justify-end">\n'
            '            <button\n'
            '              type="button"\n'
            "              onClick={() => {\n"
            "                if (!focalData) return;\n"
            "                const letters = (focalData.panels || []).map((p) => p.panelLetter);\n"
            "                const suggested = suggestFocalImageAnnotations({\n"
            "                  panelLetters: letters,\n"
            "                  lesionLabel: focalData.lesionLabel,\n"
            "                  lesionSite: focalData.lesionSite,\n"
            "                  lesionSize: focalData.lesionSize,\n"
            "                });\n"
            "                if (!suggested.length) return;\n"
            "                setFocalData({\n"
            "                  ...focalData,\n"
            "                  imageAnnotations: [\n"
            "                    ...(focalData.imageAnnotations || []),\n"
            "                    ...suggested,\n"
            "                  ],\n"
            "                });\n"
            "              }}\n"
            '              className="text-[10px] font-bold text-teal-200 bg-teal-950/60 hover:bg-teal-900/80 border border-teal-500/40 rounded-lg px-2.5 py-1"\n'
            "            >\n"
            "              Sugerir anotaciones desde lesión\n"
            "            </button>\n"
            "          </div>\n"
        )
        grid = (
            '          <div\n'
            '            className={`grid gap-4 ${\n'
            '              focalData.panels.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-xl mx-auto"\n'
            "            }`}\n"
            "          >"
        )
        if grid in text:
            text = text.replace(grid, btn + grid, 1)
        else:
            print("FOCAL NO SUGGEST SLOT")

    write(path, text)
    print("FOCAL OK")


def patch_atlas() -> None:
    path = COMP / "Atlas3DModule.tsx"
    text = read(path)
    if "SuiteImageAnnotationLayer" in text and "suggestAtlasImageAnnotations" in text:
        print("ATLAS SKIP already")
        return

    text = text.replace(
        "import { Atlas3DData, Atlas3DPanel, Atlas3DSynopticItem, AtlasPanelFindingAssignment, ClinicalScorecardData, AtlasPathologyOverlay } from \"../types\";",
        "import { Atlas3DData, Atlas3DPanel, Atlas3DSynopticItem, AtlasPanelFindingAssignment, ClinicalScorecardData, AtlasPathologyOverlay, SuiteImageAnnotation } from \"../types\";",
    )
    if "suiteImageAnnotations" not in text:
        text = text.replace(
            "import { flipImageDataUrl, swapLateralityLabel } from \"../lib/imageFlip\";",
            "import { flipImageDataUrl, swapLateralityLabel } from \"../lib/imageFlip\";\n"
            "import {\n"
            "  remapAnnotationsPanelLetters,\n"
            "  suggestAtlasImageAnnotations,\n"
            "  withSuggestedImageAnnotations,\n"
            "} from \"../lib/suiteImageAnnotations\";\n"
            "import { SuiteImageAnnotationLayer } from \"./SuiteImageAnnotationLayer\";",
        )

    # State after regeneratingPanelLetter
    if "selectedAnnotationId" not in text:
        # Find a regenerating state line
        m = re.search(
            r"const \[regeneratingPanelLetter, setRegeneratingPanelLetter\] = useState<string \| null>\(null\);",
            text,
        )
        if m:
            text = text[: m.end()] + "\n  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);" + text[m.end() :]
        else:
            print("ATLAS NO STATE")

    # On generate
    if "withSuggestedImageAnnotations" not in text:
        old = (
            "let nextData = json.data as Atlas3DData;\n"
            "        if (scorecardData?.atlasOverlays?.length) {\n"
            "          nextData = mergeOverlaysOntoAtlas(nextData, scorecardData.atlasOverlays, \"shared\") || nextData;\n"
            "        }\n"
            "        setAtlasData(nextData);"
        )
        new = (
            "let nextData = json.data as Atlas3DData;\n"
            "        if (scorecardData?.atlasOverlays?.length) {\n"
            "          nextData = mergeOverlaysOntoAtlas(nextData, scorecardData.atlasOverlays, \"shared\") || nextData;\n"
            "        }\n"
            "        const letters = (nextData.panels || []).map((p) => p.panelLetter).filter(Boolean);\n"
            "        const suggested = suggestAtlasImageAnnotations(\n"
            "          (nextData.synopticExplanation as any) || nextData.pathologyOverlays || [],\n"
            "          letters,\n"
            "          3\n"
            "        );\n"
            "        setAtlasData(withSuggestedImageAnnotations(nextData, suggested));"
        )
        if old in text:
            text = text.replace(old, new, 1)
        else:
            print("ATLAS GEN MISS")

    # Delete remap
    if "remapAnnotationsPanelLetters" not in text:
        old = (
            "setAtlasData({\n"
            "      ...atlasData,\n"
            "      figureTitle: updatedTitle,\n"
            "      panels: updatedPanels,\n"
            "      synopticExplanation: updatedSynoptic,\n"
            "      pathologyOverlays: updatedOverlays,\n"
            "      panelFindingAssignments: updatedAssignments,\n"
            "    });"
        )
        new = (
            "setAtlasData({\n"
            "      ...atlasData,\n"
            "      figureTitle: updatedTitle,\n"
            "      panels: updatedPanels,\n"
            "      synopticExplanation: updatedSynoptic,\n"
            "      pathologyOverlays: updatedOverlays,\n"
            "      panelFindingAssignments: updatedAssignments,\n"
            "      imageAnnotations: remapAnnotationsPanelLetters(\n"
            "        atlasData.imageAnnotations,\n"
            "        letterMap,\n"
            "        panelLetter\n"
            "      ),\n"
            "    });"
        )
        if old in text:
            text = text.replace(old, new, 1)
        else:
            print("ATLAS DELETE MISS")

    if "const setImageAnnotations" not in text:
        # Insert before handleUpdateFigureTitle
        helper = (
            "  const setImageAnnotations = (next: SuiteImageAnnotation[]) => {\n"
            "    if (!atlasData) return;\n"
            "    setAtlasData({ ...atlasData, imageAnnotations: next });\n"
            "  };\n\n"
        )
        if "const handleUpdateFigureTitle" in text:
            text = text.replace("const handleUpdateFigureTitle", helper + "  const handleUpdateFigureTitle", 1)
        else:
            print("ATLAS HELPER MISS")

    # Layer on image
    if 'mode="layer"' not in text:
        layer = (
            "                    {panel.imageUrl && (\n"
            "                      <SuiteImageAnnotationLayer\n"
            "                        panelLetter={panel.panelLetter}\n"
            "                        annotations={atlasData.imageAnnotations || []}\n"
            "                        onChange={setImageAnnotations}\n"
            '                        mode="layer"\n'
            "                        editable\n"
            "                        selectedId={selectedAnnotationId}\n"
            "                        onSelectId={setSelectedAnnotationId}\n"
            "                      />\n"
            "                    )}\n\n"
        )
        marker = "                    {/* On-image pathology pins intentionally disabled:"
        if marker in text:
            text = text.replace(marker, layer + marker, 1)
        else:
            print("ATLAS NO LAYER")

    # Toolbar after image container (before adjustment drawer)
    if 'mode="toolbar"' not in text:
        toolbar = (
            "                  {panel.imageUrl && (\n"
            "                    <div className=\"px-3 py-2 border-t border-slate-800 bg-slate-950/40\">\n"
            "                      <SuiteImageAnnotationLayer\n"
            "                        panelLetter={panel.panelLetter}\n"
            "                        annotations={atlasData.imageAnnotations || []}\n"
            "                        onChange={setImageAnnotations}\n"
            '                        mode="toolbar"\n'
            "                        editable\n"
            "                        selectedId={selectedAnnotationId}\n"
            "                        onSelectId={setSelectedAnnotationId}\n"
            "                      />\n"
            "                    </div>\n"
            "                  )}\n\n"
        )
        marker = "                  {/* Inline Single-Panel Adjustment Drawer */}"
        if marker in text:
            text = text.replace(marker, toolbar + marker, 1)
        else:
            print("ATLAS NO TOOLBAR")

    # Suggest button near panels section header
    if "Sugerir anotaciones" not in text:
        # Find a simple insertion point: before the panels grid map container
        # Look for className with grid and atlasData.panels
        btn = (
            '          <div className="mb-3 flex justify-end">\n'
            '            <button\n'
            '              type="button"\n'
            "              onClick={() => {\n"
            "                if (!atlasData) return;\n"
            "                const letters = (atlasData.panels || []).map((p) => p.panelLetter);\n"
            "                const suggested = suggestAtlasImageAnnotations(\n"
            "                  (atlasData.synopticExplanation as any) || atlasData.pathologyOverlays || [],\n"
            "                  letters,\n"
            "                  3\n"
            "                );\n"
            "                if (!suggested.length) return;\n"
            "                setAtlasData({\n"
            "                  ...atlasData,\n"
            "                  imageAnnotations: [\n"
            "                    ...(atlasData.imageAnnotations || []),\n"
            "                    ...suggested,\n"
            "                  ],\n"
            "                });\n"
            "              }}\n"
            '              className="text-[10px] font-bold text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 rounded-lg px-2.5 py-1"\n'
            "            >\n"
            "              Sugerir anotaciones desde sinopsis\n"
            "            </button>\n"
            "          </div>\n"
        )
        # Insert before grid that contains atlasData.panels.length === 1
        m = re.search(
            r'<div\s+className=\{`grid[\s\S]{0,200}?atlasData\.panels\.length === 1',
            text,
        )
        if m:
            text = text[: m.start()] + btn + text[m.start() :]
        else:
            print("ATLAS NO SUGGEST SLOT")

    write(path, text)
    print("ATLAS OK")


def patch_focal_pdf() -> None:
    path = UTILS / "focalLesion3dPdfRenderer.ts"
    text = read(path)
    if "drawSuiteImageAnnotationsOnPdf" in text:
        print("FOCAL PDF SKIP")
        return
    # Add import after first import block line with sanitize or similar
    if 'from "./suiteImageAnnotationsPdf"' not in text:
        # Insert after last relative import near top
        m = re.search(r'^import .+;$', text, re.M)
        # Find last import
        imports = list(re.finditer(r'^import .+;\n', text, re.M))
        if imports:
            last = imports[-1]
            text = (
                text[: last.end()]
                + 'import { drawSuiteImageAnnotationsOnPdf } from "./suiteImageAnnotationsPdf";\n'
                + text[last.end() :]
            )
    # Draw after image, before badge
    needle = (
        "    const roleTag = p.panelRole === \"macro\" ? \"MACRO\" : \"CTX\";"
    )
    insert = (
        "    drawSuiteImageAnnotationsOnPdf(\n"
        "      doc,\n"
        "      data.imageAnnotations || [],\n"
        "      p.panelLetter,\n"
        "      imgX,\n"
        "      imgY,\n"
        "      imgW,\n"
        "      imgH,\n"
        "      factor\n"
        "    );\n\n"
    )
    if needle in text:
        text = text.replace(needle, insert + needle, 1)
        write(path, text)
        print("FOCAL PDF OK")
    else:
        print("FOCAL PDF MISS")


def patch_atlas_pdf() -> None:
    path = UTILS / "atlas3dPdfRenderer.ts"
    text = read(path)
    if "drawSuiteImageAnnotationsOnPdf" in text:
        print("ATLAS PDF SKIP")
        return
    imports = list(re.finditer(r'^import .+;\n', text, re.M))
    if imports:
        last = imports[-1]
        text = (
            text[: last.end()]
            + 'import { drawSuiteImageAnnotationsOnPdf } from "./suiteImageAnnotationsPdf";\n'
            + text[last.end() :]
        )
    # After addImage try/catch block, before caption footer
    needle = "    // Caption Footer (Dark bottom box with Foco: description)"
    insert = (
        "    {\n"
        "      const imgInset = 0.4 * factor;\n"
        "      drawSuiteImageAnnotationsOnPdf(\n"
        "        doc,\n"
        "        atlasData.imageAnnotations || [],\n"
        "        panel.panelLetter,\n"
        "        panelX + imgInset,\n"
        "        imgY + imgInset,\n"
        "        panelWidth - imgInset * 2,\n"
        "        imgBoxH - imgInset * 2,\n"
        "        factor\n"
        "      );\n"
        "    }\n\n"
    )
    if needle in text:
        text = text.replace(needle, insert + needle, 1)
        write(path, text)
        print("ATLAS PDF OK")
    else:
        print("ATLAS PDF MISS")


def main() -> None:
    add_suite_suggest_buttons()
    patch_focal()
    patch_atlas()
    patch_focal_pdf()
    patch_atlas_pdf()


if __name__ == "__main__":
    main()
