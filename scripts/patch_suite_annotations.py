#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "src" / "components"

MODULES = [
    dict(file="Thyroid3DModule.tsx", data="thyroidData", set="setThyroidData", typ="Thyroid3DData",
         table="noduleTable", textKeys='["location", "composition", "echogenicity"]', sizeKeys='["size"]', btn="teal"),
    dict(file="Breast3DModule.tsx", data="breastData", set="setBreastData", typ="Breast3DData",
         table="lesionTable", textKeys='["location", "shape", "echogenicity"]', sizeKeys='["size"]', btn="pink"),
    dict(file="Shoulder3DModule.tsx", data="shoulderData", set="setShoulderData", typ="Shoulder3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrThickness", "size"]', btn="indigo"),
    dict(file="Knee3DModule.tsx", data="kneeData", set="setKneeData", typ="Knee3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrThickness", "size"]', btn="cyan"),
    dict(file="Ankle3DModule.tsx", data="ankleData", set="setAnkleData", typ="Ankle3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrThickness", "size"]', btn="emerald"),
    dict(file="Kidney3DModule.tsx", data="kidneyData", set="setKidneyData", typ="Kidney3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrThickness", "size"]', btn="sky"),
    dict(file="AbdominalWall3DModule.tsx", data="abdominalWallData", set="setAbdominalWallData", typ="AbdominalWall3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrGap", "size"]', btn="amber"),
    dict(file="Scrotum3DModule.tsx", data="scrotumData", set="setScrotumData", typ="Scrotum3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrThickness", "size"]', btn="violet"),
    dict(file="MuscleTendon3DModule.tsx", data="muscleTendonData", set="setMuscleTendonData", typ="MuscleTendon3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrThickness", "size"]', btn="orange"),
    dict(file="Wrist3DModule.tsx", data="wristData", set="setWristData", typ="Wrist3DData",
         table="findingTable", textKeys='["structure", "location"]', sizeKeys='["sizeOrThickness", "size"]', btn="lime"),
    dict(file="Vascular3DModule.tsx", data="vascularData", set="setVascularData", typ="Vascular3DData",
         table="hemodynamicTable", textKeys='["vessel", "plaqueOrThrombus"]', sizeKeys='["stenosisPercent", "patternOrVelocity"]', btn="rose"),
]

EXTRA_IMPORTS = """
import {
  remapAnnotationsPanelLetters,
  suggestFromTableRows,
  withSuggestedImageAnnotations,
} from "../lib/suiteImageAnnotations";
import { SuiteImageAnnotationLayer } from "./SuiteImageAnnotationLayer";
"""


def layer_jsx(data: str) -> str:
    return (
        "                    {panel.imageUrl && (\n"
        "                      <SuiteImageAnnotationLayer\n"
        "                        panelLetter={panel.panelLetter}\n"
        f"                        annotations={{{data}.imageAnnotations || []}}\n"
        "                        onChange={setImageAnnotations}\n"
        '                        mode="layer"\n'
        "                        editable\n"
        "                        selectedId={selectedAnnotationId}\n"
        "                        onSelectId={setSelectedAnnotationId}\n"
        "                      />\n"
        "                    )}\n"
    )


def toolbar_jsx(data: str) -> str:
    return (
        "                    {panel.imageUrl && (\n"
        "                      <SuiteImageAnnotationLayer\n"
        "                        panelLetter={panel.panelLetter}\n"
        f"                        annotations={{{data}.imageAnnotations || []}}\n"
        "                        onChange={setImageAnnotations}\n"
        '                        mode="toolbar"\n'
        "                        editable\n"
        "                        selectedId={selectedAnnotationId}\n"
        "                        onSelectId={setSelectedAnnotationId}\n"
        "                      />\n"
        "                    )}\n"
    )


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


def main() -> None:
    for cfg in MODULES:
        path = ROOT / cfg["file"]
        text = path.read_bytes().decode("latin-1")
        if "SuiteImageAnnotationLayer" in text and "withSuggestedImageAnnotations" in text:
            print("SKIP already", cfg["file"])
            continue

        m = re.search(r'from "\.\./types";', text)
        if not m:
            print("NO TYPES", cfg["file"])
            continue
        insert_at = m.end()
        types_chunk = text[max(0, m.start() - 800) : m.end()]
        if "SuiteImageAnnotation" not in types_chunk:
            brace = text.rfind("}", 0, m.start())
            text = text[:brace] + ",\n  SuiteImageAnnotation\n" + text[brace:]
            m = re.search(r'from "\.\./types";', text)
            insert_at = m.end()
        if "suiteImageAnnotations" not in text:
            text = text[:insert_at] + EXTRA_IMPORTS + text[insert_at:]

        data, sett, typ = cfg["data"], cfg["set"], cfg["typ"]

        if "selectedAnnotationId" not in text:
            pat = r"const \[regeneratingPanelLetter, setRegeneratingPanelLetter\] = useState<string \| null>\(null\);"
            if re.search(pat, text):
                text = re.sub(
                    pat,
                    r"\g<0>\n  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);",
                    text,
                    count=1,
                )
            else:
                pat2 = r"const \[panelDirectives, setPanelDirectives\] = useState[^;]+;"
                if re.search(pat2, text):
                    text = re.sub(
                        pat2,
                        r"\g<0>\n  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);",
                        text,
                        count=1,
                    )
                else:
                    print("NO STATE SLOT", cfg["file"])

        old_gen = f"{sett}(resData.data);"
        new_gen = (
            f"const data = resData.data as {typ};\n"
            "        const letters = (data.panels || []).map((p) => p.panelLetter).filter(Boolean);\n"
            "        const suggested = suggestFromTableRows(\n"
            f"          (data as any).{cfg['table']} || [],\n"
            "          letters,\n"
            f"          {cfg['textKeys']},\n"
            f"          {cfg['sizeKeys']},\n"
            "          3\n"
            "        );\n"
            f"        {sett}(withSuggestedImageAnnotations(data, suggested));"
        )
        if old_gen in text:
            text = text.replace(old_gen, new_gen, 1)
        elif "withSuggestedImageAnnotations" not in text:
            print("GEN MISS", cfg["file"])

        helper = (
            f"\n  const setImageAnnotations = (next: SuiteImageAnnotation[]) => {{\n"
            f"    if (!{data}) return;\n"
            f"    {sett}({{ ...{data}, imageAnnotations: next }});\n"
            "  };\n"
        )
        if "const setImageAnnotations" not in text:
            if "const handleRegenerateSinglePanel" in text:
                text = text.replace(
                    "const handleRegenerateSinglePanel",
                    helper + "\n  const handleRegenerateSinglePanel",
                    1,
                )
            else:
                print("NO REGEN SLOT", cfg["file"])

        pat_del = (
            rf"{re.escape(sett)}\({{\s*\.\.\.{re.escape(data)},\s*"
            rf"figureTitle: updatedTitle,\s*panels: updatedPanels\s*}}\);"
        )
        repl_del = (
            f"{sett}({{\n"
            f"      ...{data},\n"
            "      figureTitle: updatedTitle,\n"
            "      panels: updatedPanels,\n"
            "      imageAnnotations: remapAnnotationsPanelLetters(\n"
            f"        {data}.imageAnnotations,\n"
            "        letterMap,\n"
            "        panelLetter\n"
            "      ),\n"
            "    }});"
        )
        if re.search(pat_del, text, re.S):
            text = re.sub(pat_del, repl_del, text, count=1, flags=re.S)
        elif "remapAnnotationsPanelLetters" not in text:
            print("NO DELETE REMAP", cfg["file"])

        if 'mode="layer"' not in text:
            inserted = False
            for mk in [
                "                    {/* Badge */}\n",
                '                    <div className="absolute top-2 left-2 bg-',
                '                    <div className="absolute top-2 left-2 z-10 bg-',
            ]:
                if mk in text:
                    text = text.replace(mk, layer_jsx(data) + mk, 1)
                    inserted = True
                    break
            if not inserted:
                print("NO LAYER SLOT", cfg["file"])

        if 'mode="toolbar"' not in text:
            inserted = False
            for mk in [
                "                  {/* Panel Details */}\n                  <div className=\"p-3 space-y-2\">\n",
                '                  <div className="p-3 space-y-2">\n                    <div>\n',
                '                  <div className="p-3 space-y-2">\n',
            ]:
                if mk in text:
                    text = text.replace(mk, mk + toolbar_jsx(data), 1)
                    inserted = True
                    break
            if not inserted:
                print("NO TOOLBAR SLOT", cfg["file"])

        text = text.replace("absolute top-2 left-2 bg-", "absolute top-2 left-2 z-10 bg-", 1)
        text = text.replace(
            "absolute top-2 right-2 flex items-center gap-1 opacity-0",
            "absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0",
            1,
        )

        if "Sugerir anotaciones desde tabla" not in text:
            h4pat = r'(<h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1\.5">[\s\S]*?</h4>)'
            hm = re.search(h4pat, text)
            if hm and "Reconstrucción" in hm.group(1):
                inner = hm.group(1).replace(" mb-3 ", " ")
                wrapped = (
                    '<div className="mb-3 flex flex-wrap items-center justify-between gap-2">\n'
                    f"              {inner}\n"
                    f"{suggest_button(cfg)}"
                    "            </div>"
                )
                text = text[: hm.start()] + wrapped + text[hm.end() :]
            else:
                print("NO SUGGEST BTN", cfg["file"])

        path.write_bytes(text.encode("latin-1"))
        print("OK", cfg["file"])


if __name__ == "__main__":
    main()
