export type InfographicReview = { sourceKey: string; reasons: string[] };

const labels: Record<string, string> = {
  correction_unverified: "corrección automática pendiente de revisión",
  source_changed: "el informe fue actualizado después de iniciar esta ilustración",
  laterality: "lado del paciente", orientation: "vista y referencias anatómicas",
  clinical_site: "ubicación del hallazgo", clinical_text: "texto y medidas del informe",
  spelling: "escritura y legibilidad", instructions: "texto ajeno al estudio",
  review_unavailable: "revisión automática no disponible", review_incomplete: "revisión automática incompleta",
};

/** The existing attachment checkbox remains the sole inclusion control. */
export function InfographicReviewNotice({ review }: { review?: InfographicReview }) {
  const reasons = [...new Set((review?.reasons || []).map(reason => labels[reason]).filter(Boolean))];
  const sourceChanged = review?.reasons.includes("source_changed");
  return <div role="status" className="mb-3 rounded-xl border border-amber-500/50 bg-amber-950/30 p-3 text-sm text-amber-100">
    <p className="font-bold">{sourceChanged ? "Imagen disponible · compara con el informe actualizado" : review ? "Imagen disponible · revisión automática inconclusa o con posibles errores" : "Ilustración generada con IA"}</p>
    <p className="mt-1">{reasons.length ? `Revisa: ${reasons.join(", ")}. ` : ""}
      Comprueba la ilustración antes de marcar la casilla para incluirla en el PDF. Puedes regenerarla con los controles habituales.
    </p>
  </div>;
}
