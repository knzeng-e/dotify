import type { ReleaseCreditRole, ReleaseEditorialMetadata, ReleaseKind } from '../../shared/types';

export const RELEASE_KIND_OPTIONS: Array<{ value: ReleaseKind; label: string }> = [
  { value: 'single', label: 'Single' },
  { value: 'album-track', label: 'Album track' },
  { value: 'ep-track', label: 'EP track' },
  { value: 'live', label: 'Live recording' },
  { value: 'remix', label: 'Remix' },
  { value: 'other', label: 'Other' }
];

export const RELEASE_CREDIT_ROLE_OPTIONS: Array<{ value: ReleaseCreditRole; label: string }> = [
  { value: 'performer', label: 'Performer' },
  { value: 'writer', label: 'Writer / lyricist' },
  { value: 'composer', label: 'Composer' },
  { value: 'producer', label: 'Producer' },
  { value: 'featured-artist', label: 'Featured artist' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'other', label: 'Other' }
];

export function createEmptyReleaseMetadata(): ReleaseEditorialMetadata {
  return {
    releaseKind: 'single',
    projectTitle: '',
    version: '',
    releaseDate: '',
    genres: [],
    languages: [],
    credits: [],
    label: '',
    productionLocation: '',
    explicitContent: false,
    isrc: '',
    copyrightNotice: '',
    masterNotice: ''
  };
}

export function parseMetadataList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(',')
    .map(item => item.trim())
    .filter(item => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export function normalizeReleaseMetadata(metadata: ReleaseEditorialMetadata): ReleaseEditorialMetadata {
  return {
    releaseKind: metadata.releaseKind,
    projectTitle: metadata.projectTitle.trim(),
    version: metadata.version.trim(),
    releaseDate: metadata.releaseDate.trim(),
    genres: parseMetadataList(metadata.genres.join(',')),
    languages: parseMetadataList(metadata.languages.join(',')),
    credits: metadata.credits
      .map(credit => ({ name: credit.name.trim(), role: credit.role }))
      .filter(credit => credit.name)
      .slice(0, 20),
    label: metadata.label.trim(),
    productionLocation: metadata.productionLocation.trim(),
    explicitContent: metadata.explicitContent,
    isrc: metadata.isrc.trim().toUpperCase(),
    copyrightNotice: metadata.copyrightNotice.trim(),
    masterNotice: metadata.masterNotice.trim()
  };
}

export function parseReleaseEditorialMetadata(value: unknown): ReleaseEditorialMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ReleaseEditorialMetadata>;
  const kinds = RELEASE_KIND_OPTIONS.map(option => option.value);
  const roles = RELEASE_CREDIT_ROLE_OPTIONS.map(option => option.value);
  if (!candidate.releaseKind || !kinds.includes(candidate.releaseKind)) return null;
  if (!Array.isArray(candidate.genres) || !Array.isArray(candidate.languages) || !Array.isArray(candidate.credits)) return null;
  const strings = [
    candidate.projectTitle,
    candidate.version,
    candidate.releaseDate,
    candidate.label,
    candidate.productionLocation,
    candidate.isrc,
    candidate.copyrightNotice,
    candidate.masterNotice
  ];
  if (strings.some(field => typeof field !== 'string') || typeof candidate.explicitContent !== 'boolean') return null;
  if (candidate.genres.some(item => typeof item !== 'string') || candidate.languages.some(item => typeof item !== 'string')) return null;
  if (
    candidate.credits.some(
      credit => !credit || typeof credit !== 'object' || typeof credit.name !== 'string' || !roles.includes(credit.role as ReleaseCreditRole)
    )
  ) {
    return null;
  }
  return normalizeReleaseMetadata(candidate as ReleaseEditorialMetadata);
}

export function releaseKindLabel(kind: ReleaseKind): string {
  return RELEASE_KIND_OPTIONS.find(option => option.value === kind)?.label ?? 'Release';
}

export function releaseCreditRoleLabel(role: ReleaseCreditRole): string {
  return RELEASE_CREDIT_ROLE_OPTIONS.find(option => option.value === role)?.label ?? 'Contributor';
}

export function releaseDateLabel(value: string): string {
  if (/^\d{4}$/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
}
