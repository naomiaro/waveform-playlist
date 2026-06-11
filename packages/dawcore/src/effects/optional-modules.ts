const PREFIX = '[waveform-playlist] ';

/**
 * Dynamic-import an optional peer dep with an actionable error. The thrown
 * message carries BOTH the install hint and the underlying import error —
 * "not installed" is only one of the ways a dynamic import fails (dead dev
 * server, broken exports map, CSP, network), and hiding the cause behind a
 * generic hint sends people down the wrong path.
 */
async function loadOptionalModule<T>(
  importer: () => Promise<T>,
  packageName: string,
  feature: string
): Promise<T> {
  try {
    return await importer();
  } catch (originalErr) {
    console.warn(PREFIX + packageName + ' dynamic import failed: ' + String(originalErr));
    throw new Error(
      PREFIX +
        packageName +
        ' is required for ' +
        feature +
        '. Install with: npm install ' +
        packageName +
        ' (import failed: ' +
        String(originalErr) +
        ')'
    );
  }
}

export function loadWamModule(feature: string): Promise<typeof import('@dawcore/wam')> {
  return loadOptionalModule(() => import('@dawcore/wam'), '@dawcore/wam', feature);
}

export function loadFaustModule(feature: string): Promise<typeof import('@dawcore/faust')> {
  return loadOptionalModule(() => import('@dawcore/faust'), '@dawcore/faust', feature);
}
