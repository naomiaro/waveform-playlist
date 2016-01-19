// Karma configuration
// Generated on Fri Nov 27 2015 15:02:29 GMT-0800 (PST)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'requirejs', 'chai-as-promised', 'chai'],


    // list of files / patterns to load in the browser
    files: [
      'test-main.js',
      {pattern: 'test/index.test.js', included: false},
      {pattern: 'test/media/**', watched: false, included: false, served: true}
    ],


    // list of files to exclude
    exclude: [
      '**/*.swp'
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'src/**/*.js': ['webpack', 'coverage', 'sourcemap'],
      'test/index.test.js': ['webpack', 'sourcemap']
    },

    webpack: {
      output: {
        path: __dirname + "/dist",
        filename: "[name].bundle.js",
        chunkFilename: "[id].bundle.js"
      },
      module: {
        loaders: [
          {
            test: /\.js?$/,
            exclude: /(node_modules|bower_components)/,
            loader: 'babel',
            query: {
              presets: ['es2015'],
              cacheDirectory: true
            }
          }
        ]
      },
      watch: true
    },

    webpackMiddleware: {
      noInfo: true
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['coverage', 'nyan'],

    coverageReporter: {
      reporters: [
        { type: 'text' },
        { type: 'lcov', subdir: 'report-lcov' }
      ]
    },

    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_DEBUG,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    //browsers: ['Chrome', 'Firefox'],
    browsers: ['Chrome'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultanous
    concurrency: Infinity
  });
}
