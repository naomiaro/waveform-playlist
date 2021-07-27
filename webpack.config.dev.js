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
  mode: "development",
  devtool: "eval-source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [["@babel/preset-env", { targets: "defaults" }]],
          },
        },
      },
    ],
  },
};
