import WaveformPlaylist from "waveform-playlist";

async function main() {
  const playlist = WaveformPlaylist({
    container: document.getElementById("playlist"),
    timescale: true,
    state: "cursor",
    samplesPerPixel: 1024,
    controls: {
      show: true,
      width: 200,
    },
    colors: {
      waveOutlineColor: "#E0EFF1",
      timeColor: "grey",
      fadeColor: "black",
    },
  });

  const ee = playlist.getEventEmitter();

  document.querySelector(".btn-play").addEventListener("click", () => {
    ee.emit("play");
  });

  document.querySelector(".btn-pause").addEventListener("click", () => {
    ee.emit("pause");
  });

  document.querySelector(".btn-stop").addEventListener("click", () => {
    ee.emit("stop");
  });

  document.querySelector(".btn-rewind").addEventListener("click", () => {
    ee.emit("rewind");
  });

  document.querySelector(".btn-fast-forward").addEventListener("click", () => {
    ee.emit("fastforward");
  });

  playlist.load([
    {
      name: "Sonnet",
      src: "/media/123",
    },
  ]);
}

main();
