var createVariants = require('parallel-webpack').createVariants;

function createConfig(options) {
  return {
    entry: __dirname + "/src/app.js",
    output: {
      path:  __dirname + "/dist/js",
      filename: 'waveform-playlist.' + options.target + '.js',
      library: 'WaveformPlaylist',
      libraryTarget: options.target
    },
    module: {
      loaders: [
        { test: /\.css$/, loader: "style!css" },
        {
          test: /\.js?$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel',
          query: {
            presets: ['es2015', 'stage-0']
          }
        }
      ]
    }
  };
}

module.exports = createVariants({
  target: ['var', 'commonjs2', 'umd', 'amd']
}, createConfig);