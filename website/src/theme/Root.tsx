import React from 'react';

// Simple passthrough Root component - no global Radix Themes
// Radix is applied only to specific example components that need it
export default function Root({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
