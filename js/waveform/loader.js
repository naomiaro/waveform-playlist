'use strict';

var BufferLoader = function() {

}

BufferLoader.prototype.init = function(params) {

    var loader = this;
    loader.context = params.context;
    loader.bufferList = [];
    loader.loadCount = 0;

    loader.defaultParams = {
        
    };

    loader.params = Object.create(params);
    Object.keys(loader.defaultParams).forEach(function (key) {
        if (!(key in params)) { params[key] = loader.defaultParams[key]; }
    });
}

BufferLoader.prototype.requestBuffer = function(url, name) {
    var loader = this,
        request = new XMLHttpRequest();

    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    
    request.onload = function() {
        loader.context.decodeAudioData(request.response, function(buffer) {
            if (!buffer) {
                alert('error decoding file data: '+url);
                return;
            }

            loader.loadCount++;
            loader.onAudioFileLoad(name, buffer);

            if (loader.loadCount === loader.urlList.length) {
                loader.onAudioFilesDone(loader.bufferList);
            }
        },
        function(error) {
            console.error('decodeAudioData error',error);
        });
    }

    request.onerror = function(){
        alert('BufferLoader: XHR error');
    };

    request.send();
};

BufferLoader.prototype.loadAudio = function(aUrls, callback) {

    var names=[];
    var paths=[];

    for (var name in aUrls) {
        var path = aUrls[name];
        names.push(name);
        paths.push(path);
    }

    this.urlList = paths;

    var i, 
        length;

    for (i = 0, length = paths.length; i < length; i++) {
        this.requestBuffer(paths[i], names[i]);
    }  
}

BufferLoader.prototype.onAudioFileLoad = function(name, buffer) {

    this.bufferList[name] = buffer;
}

BufferLoader.prototype.onAudioFilesDone = function(bufferList) {
    var fn = this.params.onComplete;
    fn(bufferList);
}
