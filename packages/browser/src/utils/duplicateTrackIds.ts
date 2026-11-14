/** The ids used by more than one track, each once, in order of first repeat. */
export function duplicateTrackIds(tracks: readonly { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { id } of tracks) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}
