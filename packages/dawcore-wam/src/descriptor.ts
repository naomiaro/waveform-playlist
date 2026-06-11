// WamManifestFetch is the package's shared structural fetch boundary
// (a (url) => Promise of a structural Response view) — same injectable shape
// as fetchWamLibrary, deliberately reused rather than redefined.
import { defaultFetch, type WamManifestFetch } from './library';

/**
 * Capability flags from a plugin's static `descriptor.json`. Fields present
 * only when the file provides them as booleans. An absent flag means the
 * file omitted it, NOT that the capability is missing — the WAM SDK defaults
 * `hasAudioInput`/`hasAudioOutput` to `true` at runtime, so gate on explicit
 * denial (`!== false`), never on presence (`=== true`).
 */
export interface WamDescriptorInfo {
  readonly hasAudioInput?: boolean;
  readonly hasAudioOutput?: boolean;
  readonly hasMidiInput?: boolean;
  readonly hasMidiOutput?: boolean;
  readonly isInstrument?: boolean;
}

export interface FetchWamDescriptorOptions {
  fetchFn?: WamManifestFetch;
}

/**
 * Best-effort probe of the static `descriptor.json` that WAM SDK builds ship
 * next to the plugin module (`.../plugin/index.js` → `.../plugin/descriptor.json`).
 *
 * Returns the descriptor's capability flags, or `null` when the plugin ships
 * no readable descriptor (unreachable, non-OK response, invalid JSON,
 * non-object payload — including arrays — or an unresolvable plugin URL).
 * Absence is an expected, non-error state for many registries — callers fall
 * back to other signals (e.g. manifest `category`). A descriptor that
 * declares no boolean flags resolves to `{}`, distinct from `null`: the
 * descriptor exists but defers entirely to the SDK's runtime defaults.
 * Authoritative validation still happens at load time in `createWamInstance`.
 */
export async function fetchWamDescriptor(
  pluginUrl: string,
  options: FetchWamDescriptorOptions = {}
): Promise<WamDescriptorInfo | null> {
  const fetchFn = options.fetchFn ?? defaultFetch;

  // Resolve descriptor URL; unresolvable pluginUrl returns null without calling fetchFn
  let descriptorUrl: string;
  try {
    descriptorUrl = new URL('descriptor.json', pluginUrl).href;
  } catch {
    return null;
  }

  // Fetch the descriptor; network error or non-OK response returns null
  let response: Awaited<ReturnType<WamManifestFetch>>;
  try {
    response = await fetchFn(descriptorUrl);
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  // Parse JSON; invalid JSON returns null
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  // Payload must be a non-null object (not an array or primitive); otherwise return null
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  // Extract boolean flags from the payload; only include fields whose value is strictly boolean
  const record = payload as Record<string, unknown>;

  return {
    ...(typeof record.hasAudioInput === 'boolean' && { hasAudioInput: record.hasAudioInput }),
    ...(typeof record.hasAudioOutput === 'boolean' && { hasAudioOutput: record.hasAudioOutput }),
    ...(typeof record.hasMidiInput === 'boolean' && { hasMidiInput: record.hasMidiInput }),
    ...(typeof record.hasMidiOutput === 'boolean' && { hasMidiOutput: record.hasMidiOutput }),
    ...(typeof record.isInstrument === 'boolean' && { isInstrument: record.isInstrument }),
  };
}
