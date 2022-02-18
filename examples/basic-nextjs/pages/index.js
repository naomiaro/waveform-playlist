import React, {useCallback, useState} from 'react';

import WaveformPlaylist from 'waveform-playlist';

const Waveform = () => {
  const [playlist, setPlaylist] = useState(null);

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
      });
  
      playlist.load([
        {
          src: "hello.mp3",
          name: "Hello",
        }
      ])
      .then(function () {
        // can do stuff with the playlist.
      });

      setPlaylist(playlist);
    }
  }, []);


  return (
    <main>
      <div><button onClick={() => { playlist.getEventEmitter().emit("play") }}>Play</button></div>
      <div ref={container}></div>
    </main>
  );
};

const Playlist = () => {
  return (<Waveform></Waveform>)
};

export default Playlist;
