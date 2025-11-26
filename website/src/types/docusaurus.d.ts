// Type declarations for Docusaurus virtual modules
// These modules are provided at build time by Docusaurus

declare module '@docusaurus/BrowserOnly' {
  import type { ReactNode } from 'react';

  interface BrowserOnlyProps {
    children: () => ReactNode;
    fallback?: ReactNode;
  }

  const BrowserOnly: React.FC<BrowserOnlyProps>;
  export default BrowserOnly;
}

declare module '@docusaurus/Link' {
  import type { ComponentProps, ReactNode } from 'react';

  interface LinkProps extends ComponentProps<'a'> {
    to: string;
    activeClassName?: string;
    children?: ReactNode;
    className?: string;
  }

  const Link: React.FC<LinkProps>;
  export default Link;
}

declare module '@docusaurus/useDocusaurusContext' {
  interface DocusaurusContext {
    siteConfig: {
      title: string;
      tagline: string;
      url: string;
      baseUrl: string;
      organizationName?: string;
      projectName?: string;
      customFields?: Record<string, unknown>;
    };
    siteMetadata: {
      docusaurusVersion: string;
    };
  }

  export default function useDocusaurusContext(): DocusaurusContext;
}

declare module '@docusaurus/useBaseUrl' {
  export default function useBaseUrl(url: string): string;
}

declare module '@theme/Layout' {
  import type { ReactNode } from 'react';

  interface LayoutProps {
    children: ReactNode;
    title?: string;
    description?: string;
  }

  const Layout: React.FC<LayoutProps>;
  export default Layout;
}

declare module '@theme/Heading' {
  import type { ComponentProps, ReactNode } from 'react';

  type HeadingType = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  interface HeadingProps extends ComponentProps<HeadingType> {
    as: HeadingType;
    children?: ReactNode;
    className?: string;
  }

  const Heading: React.FC<HeadingProps>;
  export default Heading;
}

// CSS modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
