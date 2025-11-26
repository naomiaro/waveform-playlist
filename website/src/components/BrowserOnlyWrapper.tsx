import React, { lazy, Suspense } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

interface BrowserOnlyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper component to prevent SSG errors with browser-only components.
 * Waveform components require browser APIs (AudioContext, Canvas, etc.)
 * and cannot be rendered during static site generation.
 */
export function BrowserOnlyWrapper({
  children,
  fallback = <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
}: BrowserOnlyWrapperProps): React.ReactElement {
  return (
    <BrowserOnly fallback={fallback}>
      {() => <>{children}</>}
    </BrowserOnly>
  );
}

/**
 * Higher-order component for lazy loading browser-only example components.
 * Use this when the component module itself accesses browser APIs at import time.
 */
export function createLazyExample<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  fallback: React.ReactNode = <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
): React.FC<P> {
  const LazyComponent = lazy(importFn);

  return function LazyExample(props: P) {
    return (
      <BrowserOnly fallback={fallback}>
        {() => (
          <Suspense fallback={fallback}>
            <LazyComponent {...props} />
          </Suspense>
        )}
      </BrowserOnly>
    );
  };
}
