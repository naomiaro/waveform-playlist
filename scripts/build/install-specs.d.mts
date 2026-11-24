export function publishedRange(range: string, workspaceVersion: string | undefined): string;
export function installSpecs(dir: string, extra?: readonly string[]): Record<string, string>;
export function installSpecsDefine(
  dir: string,
  extra?: readonly string[]
): { __INSTALL_SPECS__: string };
