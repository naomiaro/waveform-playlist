import React, {useCallback, useState} from 'react';
import EventEmitter from 'events';
import WaveformPlaylist from 'waveform-playlist';
import { saveAs } from 'file-saver';

const Waveform = () => {
  const [ee] = useState(new EventEmitter());

  ee.on('audiorenderingfinished', function (type, data) {
    if (type === 'wav'){
      saveAs(data, 'test.wav');
    }
  });

  const container = useCallback(node => {
    if (node !== null) {
      const playlist = WaveformPlaylist({
        samplesPerPixel: 100,
        mono: true,
        waveHeight: 100,
        container: node,
        state: "cursor",
        colors: {
          waveOutlineColor: "#E0EFF1",
          timeColor: "grey",
          fadeColor: "black",
        },
        controls: {
          show: true,
          width: 150,
        },
        zoomLevels: [100, 300, 500],
      }, ee);
  
      playlist.load([
        {
          src: "hello.mp3",
          name: "Hello",
        }
      ]);

      //initialize the WAV exporter.
      playlist.initExporter();
    }
  }, []);


  return (
    <main>
      <div><button onClick={() => { ee.emit("play") }}>Play</button></div>
      <div><button onClick={() => { ee.emit('startaudiorendering', 'wav') }}>Download</button></div>
      <div ref={container}></div>
    </main>
  );
};

const Playlist = () => {
  return (<Waveform></Waveform>)
};

export default Playlist;
