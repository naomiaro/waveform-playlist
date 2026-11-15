import React from 'react';

const errorContainerStyle: React.CSSProperties = {
  padding: '16px',
  background: '#1a1a2e',
  color: '#e0e0e0',
  border: '1px solid #d08070',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '13px',
  minHeight: '60px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export interface PlaylistErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback UI to show when an error occurs */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for waveform playlist components.
 *
 * Catches render errors in child components (canvas failures, audio
 * processing errors) and displays a fallback UI instead of crashing
 * the entire application.
 *
 * It catches errors of the components BELOW it only. An arrangement
 * initializer that throws is a render error of the component that calls
 * `useCreateArrangement`, so the boundary goes around that component:
 *
 * @example
 * ```tsx
 * function Editor() {
 *   const arrangement = useCreateArrangement(() => [audioTrack({ src: '/vocals.mp3' })]);
 *   return (
 *     <WaveformPlaylistProvider arrangement={arrangement}>
 *       <Waveform />
 *     </WaveformPlaylistProvider>
 *   );
 * }
 *
 * <PlaylistErrorBoundary>
 *   <Editor />
 * </PlaylistErrorBoundary>
 * ```
 */
export class PlaylistErrorBoundary extends React.Component<
  PlaylistErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: PlaylistErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[waveform-playlist] Render error:', error, errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={errorContainerStyle}>
          Waveform playlist encountered an error. Check console for details.
        </div>
      );
    }
    return this.props.children;
  }
}
