/**
 * Clamp a raw transport byte-ratio into a 0–1 display fraction. React Native's
 * XHR upload layer can report `loaded > total` for blob/file PUTs (native byte
 * accounting overshoots the declared body), which surfaced as ">100%" — e.g.
 * "118%" — in the upload overlay (Asana 1215484454792689). A non-finite or
 * zero total (no Content-Length) collapses to 0 instead of NaN/Infinity.
 *
 * Shared by both upload hooks (video → Mux, image → S3) since both feed the
 * same MediaPickerField percentage readout.
 */
export function toProgressFraction(loaded: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const fraction = loaded / total;
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  return fraction;
}
