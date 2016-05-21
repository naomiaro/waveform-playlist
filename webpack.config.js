var webpack = require("webpack");
var createVariants = require('parallel-webpack').createVariants;

function createConfig(options) {
  var plugins = [
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.DedupePlugin()
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
      publicPath: "js/",
      filename: 'waveform-playlist.' +
        options.target +
        (options.minified ? '.min' : '')
        + '.js',
      library: 'WaveformPlaylist',
      libraryTarget: options.target
    },
    module: {
      loaders: [{
        test: /\.js?$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      }]
    },
    plugins: plugins
  };
}

module.exports = createVariants({
  minified: [true, false],
  target: ['var']
}, createConfig);