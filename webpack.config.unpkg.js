const createVariants = require("parallel-webpack").createVariants;
const TerserPlugin = require("terser-webpack-plugin");

function createConfig(options) {
  const config = {
    entry: __dirname + "/src/app.js",
    output: {
      path: __dirname + "/build",
      filename:
        "waveform-playlist." +
        options.target +
        (options.minified ? ".min" : "") +
        ".js",
      library: {
        name: "WaveformPlaylist",
        type: options.target,
      },
    },
    optimization: {
      minimize: options.minified,
      minimizer: [new TerserPlugin()],
    },
    mode: "production",
  };

  if (options.target === "umd") {
    config.output.umdNamedDefine = true;
    config.output.globalObject = "this";
  }

  return config;
}

module.exports = createVariants(
  {
    minified: [true, false],
    target: ["var", "commonjs2", "umd", "amd"],
  },
  createConfig
);
