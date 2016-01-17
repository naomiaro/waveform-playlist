var gulp = require("gulp");
var gutil = require("gulp-util");
var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var Server = require('karma').Server;

var webpackConfig = {
  entry: __dirname + "/src/app.js",
  output: {
    path:  __dirname + "/dist/js",
    filename: 'waveform-playlist.var.js',
    library: 'WaveformPlaylist',
    libraryTarget: 'var'
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

gulp.task("webpack-dev-server", function(callback) {
  // modify some webpack config options
  var myConfig = Object.create(webpackConfig);
  //http://webpack.github.io/docs/configuration.html#devtool
  myConfig.devtool = "cheap-module-eval-source-map";
  myConfig.debug = true;

  // Start a webpack-dev-server
  new WebpackDevServer(webpack(myConfig), {
    contentBase: "dist/",
    publicPath: "/" + myConfig.output.publicPath,
    stats: {
      colors: true
    },
    https: true
  }).listen(8080, "localhost", function(err) {
    if(err) throw new gutil.PluginError("webpack-dev-server", err);
    gutil.log("[webpack-dev-server]", "https://localhost:8080/webpack-dev-server/index.html");
  });
});

/**
 * Run test once and exit
 */
gulp.task('test', function (done) {
  new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
});
