module.exports = {
    entry: __dirname + "/src/app.js",
    output: {
        path: __dirname + "/dist",
        filename: "waveform-playlist.js",
        chunkFilename: "[id].bundle.js",
        publicPath: "",

        // export itself to a global var
        libraryTarget: "var",
        // name of the global var: "Foo"
        library: "WaveformPlaylist"
    },
    externals: {
        // require("jquery") is external and available
        //  on the global var jQuery
        //"jquery": "jQuery"
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