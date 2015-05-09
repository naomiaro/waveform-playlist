/*
    Test script to display a meter in dBFS (dB)
*/
var ctx = new AudioContext(), 
    url = '../media/Drink.mp3',
    audio = new Audio(url),  
    processor = ctx.createScriptProcessor(256, 2, 2),
    meter = document.getElementById('meter'),
    db = document.getElementById('db'),
    max = document.getElementById('max'),
    source;

    audio.addEventListener('canplaythrough', function(){
        source = ctx.createMediaElementSource(audio);
        source.connect(processor);
        processor.connect(ctx.destination);
        audio.play();
    }, false);

//calculate average volume for a buffer.
processor.onaudioprocess = function(evt){
    var input,
        output,
        len,   
        total,
        channel,
        rms,
        decibel,
        percent,
        slice = Array.prototype.slice;

    for (channel = 0, len = evt.outputBuffer.numberOfChannels; channel < len; channel++) {
        input = evt.inputBuffer.getChannelData(channel);
        output = evt.outputBuffer.getChannelData(channel);
        output.set(input);
    }

    maxPeak = Math.max.apply(Math, input);

    rms = Math.sqrt(maxPeak);
    decibel = 20 * Math.log(rms) / Math.LN10;

    //scale is from -96db to 0db
    //percent = (1/96) * decibel + 1.0
    //percent = percent < 0 ? 0 : percent * 100;

    db.innerHTML = decibel;
    //max.innerHTML = maxPeak;
    //meter.style.width = (percent) + '%';
};