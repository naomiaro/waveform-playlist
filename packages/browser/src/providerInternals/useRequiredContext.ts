import { use } from 'react';

/** The value of a provider's context, or a throw that names the hook and the provider. */
export function useRequiredContext<T>(
  context: React.Context<T | null>,
  hookName: string,
  providerName: string
): T {
  const value = use(context);
  if (!value) {
    throw new Error(`${hookName} must be used within ${providerName}`);
  }
  return value;
}
