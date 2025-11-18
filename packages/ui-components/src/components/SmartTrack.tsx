import React, { Fragment, FunctionComponent } from 'react';
import { SmartChannel } from './SmartChannel';
import { Track } from './Track';
import WaveformData from 'waveform-data';
import { useWaveformData } from './BBCExtractPeaks';
import { usePlaylistInfo } from '../contexts/PlaylistInfo';

function parseData(waveform: WaveformData, channel: number) {
  const peakLength = waveform.length;
  let data;

  if (waveform.bits === 8) {
    data = new Int8Array(peakLength * 2);
  } else {
    data = new Int16Array(peakLength * 2);
  }
  for (let i = 0; i < peakLength; i++) {
    data[i * 2] = waveform.channel(channel).min_sample(i);
    data[i * 2 + 1] = waveform.channel(channel).max_sample(i);
  }

  return data;
}

interface WaveformDataTrackProps {
  waveformData: WaveformData;
}

const WaveformDataTrack: FunctionComponent<WaveformDataTrackProps> = ({
  waveformData,
}) => {
  const { samplesPerPixel } = usePlaylistInfo();
  const waveform = waveformData.resample({ scale: samplesPerPixel });

  return (
    <Track numChannels={waveform.channels}>
      {Array(waveform.channels)
        .fill(0)
        .map((_, i) => {
          return (
            <SmartChannel
              data={parseData(waveform, i)}
              bits={waveform.bits as 8 | 16}
              length={waveform.length}
              index={i}
              key={i}
            />
          );
        })}
    </Track>
  );
};

export interface SmartTrackProps {
  dataUri: string;
  type: 'dat' | 'json';
}
export const SmartTrack: FunctionComponent<SmartTrackProps> = ({
  dataUri,
  type,
}) => {
  const { data: waveformData } = useWaveformData(dataUri, type);

  return (
    <Fragment>
      {!waveformData && <Track numChannels={0} />}
      {waveformData && <WaveformDataTrack waveformData={waveformData} />}
    </Fragment>
  );
};
