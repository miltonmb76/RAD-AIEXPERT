/** Study type string helpers extracted from App.tsx */
// Helper to build gendered laterality
export const getGenderedLaterality = (lat: string, study: string) => {
  if (!lat || lat === "Bilateral") return lat;
  const masculineStudies = [
    "Hombro", "Tobillo", "Pie", "Doppler venoso de miembro inferior",
    "Doppler arterial de miembro inferior", "Cráneo", "Abdomen", "Pared abdominal",
    "Escroto", "Cuello", "Tórax", "Codo", "Muslo Anterior", "Muslo Posterior"
  ];

  if (masculineStudies.map(s => s.toLowerCase()).includes(study.toLowerCase())) {
    if (lat.toLowerCase() === "derecha") return "Derecho";
    if (lat.toLowerCase() === "izquierda") return "Izquierdo";
  }
  return lat;
};

// Helper to build projections string
export const getFormattedProjections = (projs: string[], customProj: string) => {
  if (!projs || projs.length === 0) return "";
  const mapped = projs.map(p => {
    if (p === "Otra") {
      return customProj.trim() ? customProj.trim() : "Otra";
    }
    return p === "Lateral" ? "Lateral" : p === "Oblicua" ? "Oblicua" : p === "Axial" ? "Axial" : p;
  });
  if (mapped.length === 1) return mapped[0];
  const last = mapped[mapped.length - 1];
  const rest = mapped.slice(0, -1).join(", ");
  return `${rest} y ${last}`;
};

// Helper to build the studyType string dynamically
export const buildStudyTypeString = (mod: string, spec: string, lat: string, custom: string, projs: string[], customProj: string) => {
  let mainStudy = spec === "Otro" ? (custom || "") : spec;
  if (!mainStudy) {
    return mod;
  }

  const mainStudyLower = mainStudy.toLowerCase();

  // Custom alignment for Mamografía/Momografía
  if (mod === "Mamografía" && (mainStudyLower === "mamas" || mainStudyLower === "momografia" || mainStudyLower === "mamografía")) {
    const gLat = getGenderedLaterality(lat, mainStudy);
    return gLat ? `Mamografía ${gLat}` : "Mamografía";
  }

  let preposition = "de";
  if (mainStudyLower.startsWith("doppler")) {
    preposition = "-";
  }

  let base = `${mod} ${preposition} ${mainStudy}`;
  base = base.replace(/\s+-\s+/, " - ").trim();

  if (lat) {
    const gLat = getGenderedLaterality(lat, mainStudy);
    base = `${base} ${gLat}`;
  }

  if (mod === "Radiografía" && projs && projs.length > 0) {
    const formattedProjs = getFormattedProjections(projs, customProj);
    base = `${base} ${formattedProjs}`;
  }

  return base;
};
