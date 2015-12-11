module.exports = {
    entry: __dirname + "/src/Playlist.js",
    output: {
        path: __dirname + "/dist",
        filename: "waveform-playlist.js",
        chunkFilename: "[id].bundle.js",
        publicPath: "/assets/"
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