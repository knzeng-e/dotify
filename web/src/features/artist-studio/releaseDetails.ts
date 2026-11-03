/** Text shared by public metadata and on-chain registration. UTF-8 limits
 * mirror LibMusicBounds; JavaScript string length is not a byte count. */
export type ReleaseDetails = { title: string; artistName: string; description: string };

export function normalizeReleaseDetails(input: ReleaseDetails): ReleaseDetails {
  return { title: input.title.trim(), artistName: input.artistName.trim(), description: input.description.trim() };
}

export function releaseDetailsErrors(input: ReleaseDetails): Partial<Record<keyof ReleaseDetails, string>> {
  const details = normalizeReleaseDetails(input);
  const errors: Partial<Record<keyof ReleaseDetails, string>> = {};
  const fields = [
    ['title', 800, 'Add a title before publishing.', 'Shorten the title before publishing.'],
    ['artistName', 800, 'Add your artist name before publishing.', 'Shorten your artist name before publishing.'],
    ['description', 8000, 'Add a short note in About this track before publishing.', 'Shorten About this track before publishing.']
  ] as const;
  const encoder = new TextEncoder();
  for (const [field, limit, missing, tooLong] of fields) {
    if (!details[field]) errors[field] = missing;
    else if (encoder.encode(details[field]).byteLength > limit) errors[field] = tooLong;
  }
  return errors;
}

export function releaseDetailsPreflightError(input: ReleaseDetails): string | null {
  return Object.values(releaseDetailsErrors(input))[0] ?? null;
}
