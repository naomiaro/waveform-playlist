/*
 * This script is provided to give an example how the playlist can be controlled using the event emitter.
 * This enables projects to create/control the useability of the project.
*/
var ee = playlist.getEventEmitter();
var $container = $("body");
var $timeFormat = $container.find('.time-format');
var $audioStart = $container.find('.audio-start');
var $audioEnd = $container.find('.audio-end');
var $time = $container.find('.audio-pos');

var format = "seconds";
var startTime = 0;
var endTime = 0;
var audioPos = 0;

function toggleActive(node) {
  var active = node.parentNode.querySelectorAll('.active');
  var i = 0, len = active.length;

  for (; i < len; i++) {
    active[i].classList.remove('active');
  }

  node.classList.toggle('active');
}

function cueFormatters(format) {

  function clockFormat(seconds, decimals) {
      var hours,
          minutes,
          secs,
          result;

      hours = parseInt(seconds / 3600, 10) % 24;
      minutes = parseInt(seconds / 60, 10) % 60;
      secs = seconds % 60;
      secs = secs.toFixed(decimals);

      result = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (secs < 10 ? "0" + secs : secs);

      return result;
  }

  var formats = {
      "seconds": function (seconds) {
          return seconds.toFixed(0);
      },
      "thousandths": function (seconds) {
          return seconds.toFixed(3);
      },
      "hh:mm:ss": function (seconds) {
          return clockFormat(seconds, 0);   
      },
      "hh:mm:ss.u": function (seconds) {
          return clockFormat(seconds, 1);   
      },
      "hh:mm:ss.uu": function (seconds) {
          return clockFormat(seconds, 2);   
      },
      "hh:mm:ss.uuu": function (seconds) {
          return clockFormat(seconds, 3);   
      }
  };

  return formats[format];
}

function updateSelect(start, end) {
  if (start < end) {
    $('.btn-trim-audio').removeClass('disabled');
  }
  else {
    $('.btn-trim-audio').addClass('disabled');
  }

  $audioStart.val(cueFormatters(format)(start));
  $audioEnd.val(cueFormatters(format)(end));

  startTime = start;
  endTime = end;
}

function updateTime(time) {
  $time.html(cueFormatters(format)(time));

  audioPos = time;
}

updateSelect(startTime, endTime);
updateTime(audioPos);



/*
* Code below sets up events to send messages to the playlist.
*/
$container.on("click", ".btn-playlist-state-group", function() {
  //reset these for now.
  $('.btn-fade-state-group').addClass('hidden');
  $('.btn-select-state-group').addClass('hidden');

  if ($('.btn-select').hasClass('active')) {
    $('.btn-select-state-group').removeClass('hidden');
  }

  if ($('.btn-fadein').hasClass('active') || $('.btn-fadeout').hasClass('active')) {
    $('.btn-fade-state-group').removeClass('hidden');
  }
});

$container.on("click", ".btn-play", function() {
  ee.emit("play");
});

$container.on("click", ".btn-pause", function() {
  ee.emit("pause");
});

$container.on("click", ".btn-stop", function() {
  ee.emit("stop");
});

$container.on("click", ".btn-rewind", function() {
  ee.emit("rewind");
});

$container.on("click", ".btn-fast-forward", function() {
  ee.emit("fastforward");
});

$container.on("click", ".btn-record", function() {
  ee.emit("record");
});

//track interaction states
$container.on("click", ".btn-cursor", function() {
  ee.emit("statechange", "cursor");
  toggleActive(this);
});

$container.on("click", ".btn-select", function() {
  ee.emit("statechange", "select");
  toggleActive(this);
});

$container.on("click", ".btn-shift", function() {
  ee.emit("statechange", "shift");
  toggleActive(this);
});

$container.on("click", ".btn-fadein", function() {
  ee.emit("statechange", "fadein");
  toggleActive(this);
});

$container.on("click", ".btn-fadeout", function() {
  ee.emit("statechange", "fadeout");
  toggleActive(this);
});

//fade types
$container.on("click", ".btn-logarithmic", function() {
  ee.emit("fadetype", "logarithmic");
  toggleActive(this);
});

$container.on("click", ".btn-linear", function() {
  ee.emit("fadetype", "linear");
  toggleActive(this);
});

$container.on("click", ".btn-scurve", function() {
  ee.emit("fadetype", "sCurve");
  toggleActive(this);
});

$container.on("click", ".btn-exponential", function() {
  ee.emit("fadetype", "exponential");
  toggleActive(this);
});

//zoom buttons
$container.on("click", ".btn-zoom-in", function() {
  ee.emit("zoomin");
});

$container.on("click", ".btn-zoom-out", function() {
  ee.emit("zoomout");
});

$container.on("click", ".btn-trim-audio", function() {
  ee.emit("trim");
});

$container.on("click", ".btn-info", function() {
  console.log(playlist.getInfo());
});

//track drop
$container.on("dragenter", ".track-drop", function(e) {
  e.preventDefault();
  e.target.classList.add("drag-enter");
});

$container.on("dragover", ".track-drop", function(e) {
  e.preventDefault();
});

$container.on("dragleave", ".track-drop", function(e) {
  e.preventDefault();
  e.target.classList.remove("drag-enter");
});

$container.on("drop", ".track-drop", function(e) {
  e.preventDefault();
  e.target.classList.remove("drag-enter");

  var dropEvent = e.originalEvent;

  for (var i = 0; i < dropEvent.dataTransfer.files.length; i++) {
    ee.emit("newtrack", dropEvent.dataTransfer.files[i]);
  }
});

$container.on("change", ".time-format", function(e) {
  format = $timeFormat.val();

  updateSelect(startTime, endTime);
  updateTime(audioPos);
});

$container.on("input change", ".master-gain", function(node){
  ee.emit("mastervolumechange", node.target.value);
});

function displaySoundStatus(status) {
  $(".sound-status").html(status);
}



/*
* Code below receives updates from the playlist.
*/
ee.on("select", updateSelect);

ee.on("timeupdate", updateTime);

ee.on("mute", function(track) {
  displaySoundStatus("Mute button pressed for " + track.name);
});

ee.on("solo", function(track) {
  displaySoundStatus("Solo button pressed for " + track.name);
});

ee.on("volumechange", function(volume, track) {
  displaySoundStatus(track.name + " now has volume " + volume + ".");
});

ee.on("mastervolumechange", function(volume) {
  displaySoundStatus("Master volume now has volume " + volume + ".");
});

