// Test helper (#812). The status value of `useSourceLoading` has no context
// yet (a later step adds the hook), so tests read what the provider's own
// call of the hook returned: a test file mocks the hook's module with
// `capturing(actual)`, which wraps the real hook and keeps its latest status.
// This module imports no provider, so a mock factory can import it.
import type * as SourceLoading from '../providerInternals/useSourceLoading';

export const captured: { status: SourceLoading.SourceLoadingStatus | null } = { status: null };

export function capturing(actual: typeof SourceLoading): typeof SourceLoading {
  return {
    ...actual,
    useSourceLoading: (options) => {
      const value = actual.useSourceLoading(options);
      captured.status = value.status;
      return value;
    },
  };
}
