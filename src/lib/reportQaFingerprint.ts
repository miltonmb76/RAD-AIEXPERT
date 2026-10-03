export function buildReportQaFingerprint(input: {
  generatedReport: string;
  laterality: string;
  studyType: string;
  clinicalScorecardData: { categoryAssigned?: string; recommendation?: string } | null | undefined;
  reportEnrichmentSession: { changes?: Array<{ status: string }> } | null | undefined;
}): string {
  const pending =
    input.reportEnrichmentSession?.changes?.filter((c) => c.status === "pending").length || 0;
  return [
    (input.generatedReport || "").length,
    input.laterality || "",
    input.studyType || "",
    input.clinicalScorecardData?.categoryAssigned || "",
    input.clinicalScorecardData?.recommendation?.slice(0, 40) || "",
    String(pending),
  ].join("|");
}
