/**
 * Shared "onTouched" error reducer for the multi-step onboarding forms
 * (artist + venue). Given the latest parse of a step's values, it recomputes
 * the errors map so that:
 *
 *   - a field's error only ever shows once that field has been touched, and
 *   - an error clears the instant its field becomes valid — including mid-type,
 *     not only on blur or the next Next-press (Asana 1215419495293496).
 *
 * Every field belonging to the step is cleared from the previous errors first,
 * then re-populated from this parse, so other steps' errors are left intact.
 */
export interface StepParseResult {
  success: boolean;
  error?: {
    issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
  };
}

export function computeStepErrors({
  result,
  stepFields,
  touched,
  prevErrors,
}: {
  result: StepParseResult;
  stepFields: readonly string[];
  touched: ReadonlySet<string>;
  prevErrors: Record<string, string>;
}): Record<string, string> {
  const next = { ...prevErrors };
  for (const field of stepFields) delete next[field];

  if (!result.success && result.error) {
    for (const issue of result.error.issues) {
      const field = issue.path.join('.');
      if (touched.has(field)) next[field] = issue.message;
    }
  }

  return next;
}
