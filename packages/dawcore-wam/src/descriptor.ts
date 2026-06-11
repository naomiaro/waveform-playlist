// WamManifestFetch is the package's shared structural fetch boundary
// ((url) => Promise of an ok/status/json view) — same injectable shape as
// fetchWamLibrary, deliberately reused rather than redefined.
import { defaultFetch, type WamManifestFetch } from './library';

/** Capability flags from a plugin's static `descriptor.json`. Fields present only when the file provides them as booleans. */
export interface WamDescriptorInfo {
  hasAudioInput?: boolean;
  hasAudioOutput?: boolean;
  hasMidiInput?: boolean;
  hasMidiOutput?: boolean;
  isInstrument?: boolean;
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
 * non-object payload, or an unresolvable plugin URL). Absence is an expected,
 * non-error state for many registries — callers fall back to other signals
 * (e.g. manifest `category`). Authoritative validation still happens at load
 * time in `createWamInstance`.
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
  const result: WamDescriptorInfo = {};
  const record = payload as Record<string, unknown>;

  if (typeof record.hasAudioInput === 'boolean') {
    result.hasAudioInput = record.hasAudioInput;
  }
  if (typeof record.hasAudioOutput === 'boolean') {
    result.hasAudioOutput = record.hasAudioOutput;
  }
  if (typeof record.hasMidiInput === 'boolean') {
    result.hasMidiInput = record.hasMidiInput;
  }
  if (typeof record.hasMidiOutput === 'boolean') {
    result.hasMidiOutput = record.hasMidiOutput;
  }
  if (typeof record.isInstrument === 'boolean') {
    result.isInstrument = record.isInstrument;
  }

  return result;
}
