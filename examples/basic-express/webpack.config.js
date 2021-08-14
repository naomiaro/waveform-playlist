const path = require("path");
module.exports = {
  entry: {
    index: "./public/javascripts/index.js",
    track: "./public/javascripts/track.js",
  },
  output: {
    path: path.resolve(__dirname, "public/javascripts"),
    filename: "[name].bundle.js",
  },
  mode: 'production'
};
