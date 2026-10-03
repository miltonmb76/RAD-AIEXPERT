/** Maps physician-selected study to dedicated organ suite */
export type SpecificSuiteShortcut = { id: string; label: string };

/**
 * Maps the study explicitly selected by the physician to its dedicated suite.
 * This intentionally does not inspect the generated report: protocol selection stays manual.
 */
export const getSpecificSuiteShortcut = (
  specificStudy: string,
  modality: string
): SpecificSuiteShortcut | null => {
  const selected = `${specificStudy || ""} ${modality || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (selected.includes("doppler") || selected.includes("carotid")) {
    return { id: "vascular3d", label: "Suite Vascular 3D" };
  }
  if (selected.includes("mama") || selected.includes("momografia")) {
    return { id: "breast3d", label: "Suite Mama 3D" };
  }
  if (selected.includes("cuello") || selected.includes("tiroid")) {
    return { id: "thyroid3d", label: "Suite Tiroides 3D" };
  }
  if (selected.includes("hombro")) {
    return { id: "shoulder3d", label: "Suite Hombro 3D" };
  }
  if (selected.includes("rodilla")) {
    return { id: "knee3d", label: "Suite Rodilla 3D" };
  }
  if (selected.includes("tobillo")) {
    return { id: "ankle3d", label: "Suite Tobillo 3D" };
  }
  if (
    selected.includes("muslo") ||
    selected.includes("pantorrilla") ||
    selected.includes("aquiles")
  ) {
    return { id: "muscleTendon3d", label: "Suite Músculo-Tendón 3D" };
  }
  if (selected.includes("muneca") || selected.includes("carpo")) {
    return { id: "wrist3d", label: "Suite Muñeca 3D" };
  }
  if (selected.includes("vias urinarias") || selected.includes("renal") || selected.includes("rinon")) {
    return { id: "kidney3d", label: "Suite Riñón 3D" };
  }
  if (selected.includes("pared abdominal")) {
    return { id: "abdominalWall3d", label: "Suite Pared Abdominal 3D" };
  }
  if (selected.includes("escroto") || selected.includes("testicul")) {
    return { id: "scrotum3d", label: "Suite Escroto 3D" };
  }
  if (selected.includes("abdomen")) {
    return { id: "abdomen3d", label: "Suite Abdomen 3D" };
  }
  return null;
};
