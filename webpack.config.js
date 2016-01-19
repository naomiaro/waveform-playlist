var webpack = require("webpack");
var createVariants = require('parallel-webpack').createVariants;

function createConfig(options) {
  var plugins = [
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin()
  ];
  if (options.minified) {
    plugins.push(new webpack.optimize.UglifyJsPlugin({
      sourceMap: false,
      compress: {
        warnings: false
      }
    }));
  }

  return {
    entry: __dirname + "/src/app.js",
    output: {
      path:  __dirname + "/dist/js",
      filename: 'waveform-playlist.' +
        options.target +
        (options.minified ? '.min' : '')
        + '.js',
      library: 'WaveformPlaylist',
      libraryTarget: options.target
    },
    module: {
      loaders: [
        {
          test: /\.js?$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel',
          query: {
            presets: ['es2015', 'stage-0']
          }
        }
      ]
    },
    plugins: plugins
  };
}

module.exports = createVariants({
  minified: [true, false],
  target: ['var', 'commonjs2', 'umd', 'amd']
}, createConfig);