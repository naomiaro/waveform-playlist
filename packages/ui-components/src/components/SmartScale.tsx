import React, { FunctionComponent, useContext } from 'react';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { StyledTimeScale } from './TimeScale';

const timeinfo = new Map([
  [
    700,
    {
      marker: 1000,
      bigStep: 500,
      smallStep: 100,
    },
  ],
  [
    1500,
    {
      marker: 2000,
      bigStep: 1000,
      smallStep: 200,
    },
  ],
  [
    2500,
    {
      marker: 2000,
      bigStep: 1000,
      smallStep: 500,
    },
  ],
  [
    5000,
    {
      marker: 5000,
      bigStep: 1000,
      smallStep: 500,
    },
  ],
  [
    10000,
    {
      marker: 10000,
      bigStep: 5000,
      smallStep: 1000,
    },
  ],
  [
    12000,
    {
      marker: 15000,
      bigStep: 5000,
      smallStep: 1000,
    },
  ],
  [
    Infinity,
    {
      marker: 30000,
      bigStep: 10000,
      smallStep: 5000,
    },
  ],
]);

function getScaleInfo(samplesPerPixel: number) {
  const keys = timeinfo.keys();
  let config;

  for (const resolution of keys) {
    if (samplesPerPixel < resolution) {
      config = timeinfo.get(resolution);
      break;
    }
  }

  if (config === undefined) {
    config = { marker: 30000, bigStep: 10000, smallStep: 5000 };
  }
  return config;
}

export const SmartScale: FunctionComponent = () => {
  const { samplesPerPixel, duration } = useContext(PlaylistInfoContext);
  let config = getScaleInfo(samplesPerPixel);

  return (
    <StyledTimeScale
      marker={config.marker}
      bigStep={config.bigStep}
      secondStep={config.smallStep}
      duration={duration}
    />
  );
};
