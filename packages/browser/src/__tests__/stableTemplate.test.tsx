// @vitest-environment jsdom
//
// #687: `sameTemplate` decides whether the children of
// `<WaveformTrackControls>` written on this render say the same as the ones
// of the previous render, so the previous elements can be rendered again.
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { sameTemplate, useStableTemplate } from '../utils/stableTemplate';

const A: React.FC<{ onDo?: () => void; label?: string; children?: React.ReactNode }> = () => null;
const B: React.FC = () => null;

describe('sameTemplate', () => {
  it('is true for elements of the same type with no props', () => {
    expect(sameTemplate(<A />, <A />)).toBe(true);
    expect(sameTemplate(<A />, <B />)).toBe(false);
  });

  it('compares props by identity', () => {
    const fn = () => {};
    expect(sameTemplate(<A onDo={fn} />, <A onDo={fn} />)).toBe(true);
    expect(sameTemplate(<A onDo={() => {}} />, <A onDo={() => {}} />)).toBe(false);
    expect(sameTemplate(<A label="x" />, <A label="x" />)).toBe(true);
    expect(sameTemplate(<A label="x" />, <A label="y" />)).toBe(false);
  });

  it('sees a prop that came or went', () => {
    expect(sameTemplate(<A label="x" />, <A />)).toBe(false);
    expect(sameTemplate(<A />, <A label="x" />)).toBe(false);
    // The same number of props, under other names.
    expect(sameTemplate(<A label={undefined} />, <A onDo={undefined} />)).toBe(false);
  });

  it('compares keys', () => {
    expect(sameTemplate(<A key="1" />, <A key="1" />)).toBe(true);
    expect(sameTemplate(<A key="1" />, <A key="2" />)).toBe(false);
  });

  it('compares children recursively: one child, several, text, nothing', () => {
    const one = (label: string) => (
      <div>
        <A label={label} />
      </div>
    );
    expect(sameTemplate(one('x'), one('x'))).toBe(true);
    expect(sameTemplate(one('x'), one('y'))).toBe(false);
    const many = (last: React.ReactNode) => (
      <div>
        <A />
        text
        {null}
        {last}
      </div>
    );
    expect(sameTemplate(many(<B />), many(<B />))).toBe(true);
    expect(sameTemplate(many(<B />), many(<A />))).toBe(false);
    expect(sameTemplate(many(<B />), many(null))).toBe(false);
    expect(sameTemplate(many('a'), many('b'))).toBe(false);
  });

  it('compares a fragment or an array of top-level children', () => {
    const list = (n: number) => [<A key="a" />, <B key="b" />].slice(0, n);
    expect(sameTemplate(list(2), list(2))).toBe(true);
    expect(sameTemplate(list(2), list(1))).toBe(false);
    expect(
      sameTemplate(
        <>
          <A />
          <B />
        </>,
        <>
          <A />
          <B />
        </>
      )
    ).toBe(true);
  });

  it('compares a style object one level deep, and no other object', () => {
    expect(sameTemplate(<div style={{ height: '100%' }} />, <div style={{ height: '100%' }} />)).toBe(
      true
    );
    expect(sameTemplate(<div style={{ height: '100%' }} />, <div style={{ height: '50%' }} />)).toBe(
      false
    );
    expect(sameTemplate(<div style={{ height: 1 }} />, <div style={{ height: 1, width: 1 }} />)).toBe(
      false
    );
    expect(sameTemplate(<div style={{ height: 1 }} />, <div style={{ width: 1 }} />)).toBe(false);
    expect(sameTemplate(<div style={{ height: 1 }} />, <div />)).toBe(false);
    const Data: React.FC<{ data: object }> = () => null;
    expect(sameTemplate(<Data data={{ a: 1 }} />, <Data data={{ a: 1 }} />)).toBe(false);
  });

  it('is false for things that are not elements unless they are identical', () => {
    expect(sameTemplate('a', 'a')).toBe(true);
    expect(sameTemplate(undefined, undefined)).toBe(true);
    expect(sameTemplate(<A />, 'a')).toBe(false);
    expect(sameTemplate(null, <A />)).toBe(false);
    expect(sameTemplate([<A key="a" />], <A key="a" />)).toBe(false);
  });
});

describe('useStableTemplate', () => {
  it('hands back the first of equal templates, and a different one as it is', () => {
    const first = <A label="x" />;
    const { result, rerender } = renderHook(({ t }) => useStableTemplate(t), {
      initialProps: { t: first as React.ReactNode },
    });
    expect(result.current).toBe(first);
    rerender({ t: <A label="x" /> });
    expect(result.current).toBe(first);
    const other = <A label="y" />;
    rerender({ t: other });
    expect(result.current).toBe(other);
    rerender({ t: <A label="y" /> });
    expect(result.current).toBe(other);
  });
});
