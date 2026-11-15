/**
 * The one definition of "development build" in this package: true unless
 * this is a production build. Bundlers replace `process.env.NODE_ENV` with a
 * literal; where there is no `process` at all (a page that loads the module
 * without a bundler) this is false, so nothing development-only runs and
 * nothing throws. Not exported from the package entry.
 */
export function isDevelopmentBuild(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}
