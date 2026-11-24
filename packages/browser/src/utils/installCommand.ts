/**
 * The `npm install` command an error message gives for a missing optional
 * package (#884). A bare name installs npm `latest`, which can fail the peer
 * range of this build (a `next` prerelease, or a stable build of an older
 * major), so each name carries the range this package was published with (for
 * spectrogram, which browser does not peer on, a caret on its version).
 *
 * The ranges are written in at build time (`__INSTALL_SPECS__`, from
 * `scripts/build/install-specs.mjs` through `tsup.config.ts`). Code compiled
 * from source without that define (the website and the React examples alias
 * this source) prints the bare name, quoted.
 */
declare const __INSTALL_SPECS__: Readonly<Record<string, string>> | undefined;

const BUILT_SPECS: Readonly<Record<string, string>> =
  typeof __INSTALL_SPECS__ === 'undefined' ? {} : __INSTALL_SPECS__;

/** `npm install "<name>@<range>" …`, quoted: a range can hold `>`, `^` and `||`. */
export function formatInstallCommand(
  specs: Readonly<Record<string, string>>,
  names: readonly string[]
): string {
  return 'npm install ' + names.map((name) => `"${specs[name] ?? name}"`).join(' ');
}

/** The install command for `names`, with the ranges of this build. */
export function installCommand(...names: string[]): string {
  return formatInstallCommand(BUILT_SPECS, names);
}
