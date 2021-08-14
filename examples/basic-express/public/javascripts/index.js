import WaveformPlaylist from "waveform-playlist";

const actions = [
  {
    class: "fas.fa-minus",
    title: "Reduce annotation end by 0.010s",
    action: (annotation, i, annotations, opts) => {
      var next;
      var delta = 0.01;
      annotation.end -= delta;

      if (opts.linkEndpoints) {
        next = annotations[i + 1];
        next && (next.start -= delta);
      }
    },
  },
  {
    class: "fas.fa-plus",
    title: "Increase annotation end by 0.010s",
    action: (annotation, i, annotations, opts) => {
      var next;
      var delta = 0.01;
      annotation.end += delta;

      if (opts.linkEndpoints) {
        next = annotations[i + 1];
        next && (next.start += delta);
      }
    },
  },
  {
    class: "fas.fa-cut",
    title: "Split annotation in half",
    action: (annotation, i, annotations) => {
      const halfDuration = (annotation.end - annotation.start) / 2;

      annotations.splice(i + 1, 0, {
        id: "test",
        start: annotation.end - halfDuration,
        end: annotation.end,
        lines: ["----"],
        lang: "en",
      });

      annotation.end = annotation.start + halfDuration;
    },
  },
  {
    class: "fas.fa-trash",
    title: "Delete annotation",
    action: (annotation, i, annotations) => {
      annotations.splice(i, 1);
    },
  },
];

async function getNotes() {
  const response = await fetch("/media/annotations");
  return response.json();
}

async function main() {
  const annotations = await getNotes();

  const playlist = WaveformPlaylist({
    container: document.getElementById("playlist"),
    timescale: true,
    state: "select",
    samplesPerPixel: 1024,
    colors: {
      waveOutlineColor: "#E0EFF1",
      timeColor: "grey",
      fadeColor: "black",
    },
    annotationList: {
      annotations,
      controls: actions,
      editable: true,
      isContinuousPlay: false,
      linkEndpoints: true,
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
      src: "/media/audio/sonnet.mp3",
    },
  ]);
}

main();
