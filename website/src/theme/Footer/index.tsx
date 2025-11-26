import React from 'react';
import Footer from '@theme-original/Footer';
import type FooterType from '@theme/Footer';
import type { WrapperProps } from '@docusaurus/types';
import Sponsors from '@site/src/components/Sponsors';

type Props = WrapperProps<typeof FooterType>;

export default function FooterWrapper(props: Props): React.ReactNode {
  return (
    <>
      <Sponsors />
      <Footer {...props} />
    </>
  );
}
