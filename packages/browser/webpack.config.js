const path = require('path');

module.exports = [
  // Main library bundle
  {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, '../../ghpages/js'),
      filename: 'waveform-playlist.js',
      library: {
        name: 'WaveformPlaylist',
        type: 'umd',
        export: 'default',
      },
      globalObject: 'this',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json'),
              transpileOnly: true,
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    devtool: 'source-map',
  },
  // Annotations app bundle
  {
    entry: './src/annotations-app.tsx',
    output: {
      path: path.resolve(__dirname, '../../ghpages/js'),
      filename: 'annotations-bundle.js',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json'),
              transpileOnly: true,
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    devtool: 'source-map',
  },
];
