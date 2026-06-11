const PREFIX = '[waveform-playlist] ';

/** Minimal structural view of a fetch Response — keeps tests free of the full Response type. */
export interface WamManifestResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

/** Injectable for tests — production uses global fetch. */
export type WamManifestFetch = (url: string) => Promise<WamManifestResponse>;

/** A plugin listed in a `library.json` manifest. `url` feeds straight into plugin loading. */
export interface WamLibraryEntry {
  name: string;
  /** Absolute URL of the plugin's ES module (resolved against the manifest URL). */
  url: string;
  description?: string;
  vendor?: string;
  /** Absolute URL of a screenshot/thumbnail (resolved against the manifest URL). */
  thumbnail?: string;
  keywords?: string[];
  /**
   * Registry categories (e.g. "Effect", "Instrument", "MIDI"). When present,
   * guaranteed a non-empty array of trimmed, non-empty strings — consumers
   * don't need empty-array or whitespace defenses.
   */
  category?: string[];
}

export interface WamLibraryResult {
  entries: WamLibraryEntry[];
  /** Per-entry messages for manifest entries that were skipped as invalid. */
  warnings: string[];
}

export interface FetchWamLibraryOptions {
  fetchFn?: WamManifestFetch;
  /**
   * Base for resolving relative plugin/thumbnail URLs. Defaults to the
   * manifest URL itself. Registries like webaudiomodules.com keep entry
   * paths relative to a directory next to the manifest — pass it here.
   */
  baseUrl?: string;
}

/** Internal default for injectable fetchFn options — shared with descriptor.ts, not part of the public API. */
export const defaultFetch: WamManifestFetch = (url) => fetch(url);

/** Path segments that name a build artifact directory, not the plugin itself. */
const GENERIC_URL_SEGMENTS = new Set([
  'index',
  'main',
  'dist',
  'build',
  'src',
  'plugin',
  'plugins',
  'published',
  'static',
  'public',
]);

/**
 * Fetch and parse a WAM `library.json` plugin manifest.
 *
 * Supported shapes (the common denominator of the public WAM collections —
 * see the package README for the schema):
 * - a top-level array of entries (webaudiomodules.com community registry), or
 * - an object with a `plugins` array (pedalboard2/wam-studio libraries).
 *
 * Entries are objects (`name` + `url`/`path` required) or bare URL strings
 * (name derived from the URL). Invalid entries are skipped with a warning in
 * `warnings` instead of failing the manifest; unreachable manifests, invalid
 * JSON, unrecognized shapes, and zero valid entries reject with clear errors.
 */
export async function fetchWamLibrary(
  manifestUrl: string,
  options: FetchWamLibraryOptions = {}
): Promise<WamLibraryResult> {
  const fetchFn = options.fetchFn ?? defaultFetch;
  const baseUrl = options.baseUrl ?? manifestUrl;

  const response = await fetchManifest(fetchFn, manifestUrl);
  const manifest = await parseManifestJson(response, manifestUrl);
  const rawEntries = extractRawEntries(manifest, manifestUrl);

  const entries: WamLibraryEntry[] = [];
  const warnings: string[] = [];
  rawEntries.forEach((raw, index) => {
    const result = parseEntry(raw, index, baseUrl);
    if ('entry' in result) {
      entries.push(result.entry);
    } else {
      warnings.push(result.warning);
    }
  });

  if (entries.length === 0) {
    throw new Error(
      PREFIX +
        'fetchWamLibrary: manifest at "' +
        manifestUrl +
        '" contains no valid plugin entries (' +
        String(warnings.length) +
        ' skipped).' +
        (warnings.length > 0 ? ' First problem: ' + warnings[0] : '')
    );
  }

  return { entries, warnings };
}

async function fetchManifest(
  fetchFn: WamManifestFetch,
  manifestUrl: string
): Promise<WamManifestResponse> {
  let response: WamManifestResponse;
  try {
    response = await fetchFn(manifestUrl);
  } catch (err) {
    throw new Error(
      PREFIX +
        'fetchWamLibrary: could not fetch manifest at "' +
        manifestUrl +
        '": ' +
        errorMessage(err)
    );
  }
  if (!response.ok) {
    throw new Error(
      PREFIX +
        'fetchWamLibrary: manifest request for "' +
        manifestUrl +
        '" failed with HTTP ' +
        String(response.status) +
        ' ' +
        response.statusText
    );
  }
  return response;
}

async function parseManifestJson(
  response: WamManifestResponse,
  manifestUrl: string
): Promise<unknown> {
  try {
    return await response.json();
  } catch (err) {
    throw new Error(
      PREFIX +
        'fetchWamLibrary: manifest at "' +
        manifestUrl +
        '" is not valid JSON: ' +
        errorMessage(err)
    );
  }
}

function extractRawEntries(manifest: unknown, manifestUrl: string): unknown[] {
  if (Array.isArray(manifest)) {
    return manifest;
  }
  if (manifest !== null && typeof manifest === 'object') {
    const plugins = (manifest as { plugins?: unknown }).plugins;
    if (Array.isArray(plugins)) {
      return plugins;
    }
  }
  throw new Error(
    PREFIX +
      'fetchWamLibrary: manifest at "' +
      manifestUrl +
      '" has an unrecognized shape. Expected a top-level array of entries or an object with a "plugins" array.'
  );
}

type EntryParseResult = { entry: WamLibraryEntry } | { warning: string };

function parseEntry(raw: unknown, index: number, baseUrl: string): EntryParseResult {
  if (typeof raw === 'string') {
    return parseStringEntry(raw, index, baseUrl);
  }
  if (raw !== null && typeof raw === 'object') {
    return parseObjectEntry(raw as Record<string, unknown>, index, baseUrl);
  }
  return skip(index, 'is neither a URL string nor an object');
}

function parseStringEntry(raw: string, index: number, baseUrl: string): EntryParseResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return skip(index, 'is an empty URL string');
  }
  const url = resolveUrl(trimmed, baseUrl);
  if (url === undefined) {
    return skip(index, 'has an unresolvable plugin URL "' + trimmed + '"');
  }
  return { entry: { name: deriveNameFromUrl(url), url } };
}

function parseObjectEntry(
  raw: Record<string, unknown>,
  index: number,
  baseUrl: string
): EntryParseResult {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name === '') {
    return skip(index, 'is missing a "name"');
  }

  const rawUrl =
    typeof raw.url === 'string' && raw.url.trim() !== ''
      ? raw.url.trim()
      : typeof raw.path === 'string' && raw.path.trim() !== ''
        ? raw.path.trim()
        : undefined;
  if (rawUrl === undefined) {
    return skip(index, '("' + name + '") is missing a plugin URL ("url" or "path")');
  }

  const url = resolveUrl(rawUrl, baseUrl);
  if (url === undefined) {
    return skip(index, '("' + name + '") has an unresolvable plugin URL "' + rawUrl + '"');
  }

  const entry: WamLibraryEntry = { name, url };
  if (typeof raw.description === 'string') {
    entry.description = raw.description;
  }
  if (typeof raw.vendor === 'string') {
    entry.vendor = raw.vendor;
  }
  if (typeof raw.thumbnail === 'string') {
    const thumbnail = resolveUrl(raw.thumbnail, baseUrl);
    if (thumbnail !== undefined) {
      entry.thumbnail = thumbnail;
    }
  }
  if (Array.isArray(raw.keywords)) {
    entry.keywords = raw.keywords.filter((k): k is string => typeof k === 'string');
  }
  if (Array.isArray(raw.category)) {
    const category = raw.category
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.trim())
      .filter((c) => c !== '');
    if (category.length > 0) {
      entry.category = category;
    }
  } else if (typeof raw.category === 'string' && raw.category.trim() !== '') {
    entry.category = [raw.category.trim()];
  }
  return { entry };
}

function skip(index: number, reason: string): { warning: string } {
  return {
    warning: PREFIX + 'fetchWamLibrary: skipping entry ' + String(index) + ': ' + reason,
  };
}

function resolveUrl(raw: string, baseUrl: string): string | undefined {
  try {
    const resolved = new URL(raw, baseUrl);
    // new URL('https://') parses on some runtimes with an empty host — treat as invalid.
    if (resolved.host === '') {
      return undefined;
    }
    return resolved.href;
  } catch {
    return undefined;
  }
}

/**
 * Derive a display name for a bare-URL entry: the last URL path segment that
 * is not a generic file or build-directory name (index.js, dist, src, ...).
 */
function deriveNameFromUrl(url: string): string {
  const segments = new URL(url).pathname.split('/').filter((s) => s !== '');
  for (let i = segments.length - 1; i >= 0; i--) {
    const base = decodeURIComponent(segments[i]).replace(/\.[a-z0-9]+$/i, '');
    // index-prefixed entry filenames (index.js, indexGUIStandard.js, …) are
    // build artifacts, not plugin names — fall through to the directory.
    const isGeneric =
      GENERIC_URL_SEGMENTS.has(base.toLowerCase()) || base.toLowerCase().startsWith('index');
    if (base !== '' && !isGeneric) {
      return base;
    }
  }
  return new URL(url).hostname;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
