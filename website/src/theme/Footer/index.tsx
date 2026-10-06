import React from 'react';
import Footer from '@theme-original/Footer';
import type FooterType from '@theme/Footer';
import type { WrapperProps } from '@docusaurus/types';
import Partners from '@site/src/components/Partners';

type Props = WrapperProps<typeof FooterType>;

export default function FooterWrapper(props: Props): React.ReactNode {
  return (
    <>
      <Partners />
      <Footer {...props} />
    </>
  );
}
