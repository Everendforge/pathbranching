/** Persistent non-canon speaker used when the author intentionally hides the identity. */
export const UNKNOWN_SPEAKER_REF = "__pathbranching_unknown_speaker__";

export function isGenericSpeakerRef(value: string | undefined): boolean {
  return value === UNKNOWN_SPEAKER_REF;
}

export function speakerLabel(value: string | undefined, fallback?: string): string {
  if (!value) return "Narrator";
  if (value === UNKNOWN_SPEAKER_REF) return "???";
  return fallback ?? value;
}
