const path = require("path");

module.exports = {
  context: path.resolve(__dirname, "src"),
  entry: {
    "waveform-playlist": "./app.js",
  },
  output: {
    path: __dirname + "/dist/waveform-playlist/js",
    publicPath: "/waveform-playlist/js/",
    filename: "[name].js",
    library: {
      name: "WaveformPlaylist",
      type: "var",
    },
  },
  mode: "production",
};
