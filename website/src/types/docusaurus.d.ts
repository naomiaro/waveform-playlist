// Type declarations for Docusaurus virtual modules
// These modules are provided at build time by Docusaurus

declare module '@docusaurus/Head' {
  import type { ReactNode } from 'react';
  import type { HelmetProps } from 'react-helmet-async';

  export default function Head(
    props: HelmetProps & { children?: ReactNode },
  ): ReactNode;
}

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
  import type { CSSProperties, ComponentProps, ReactNode } from 'react';

  export type Props = ComponentProps<'a'> & {
    readonly to?: string;
    readonly href?: string;
    readonly activeClassName?: string;
    readonly children?: ReactNode;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly autoAddBaseUrl?: boolean;
    readonly isNavLink?: boolean;
  };

  export default function Link(props: Props): ReactNode;
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
