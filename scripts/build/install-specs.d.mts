export function workspaceVersions(root?: string): Map<string, string>;
export function publishedRange(
  range: string,
  workspaceVersion: string | undefined,
  name?: string
): string;
export function installSpecs(dir: string, extra?: readonly string[]): Record<string, string>;
export function installSpecsDefine(
  dir: string,
  extra?: readonly string[]
): { __INSTALL_SPECS__: string };
export function satisfiesFloors(version: string, range: string): boolean | undefined;
export function hintRange(
  range: string,
  workspaceVersion: string | undefined,
  name: string
): string;
