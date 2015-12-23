var ee = playlist.getEventEmitter();
var $container = $("body");

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

function toggleActive(node) {
  var active = node.parentNode.querySelectorAll('.active');
  var i = 0, len = active.length;

  for (; i < len; i++) {
    active[i].classList.remove('active');
  }

  node.classList.toggle('active');
}

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
  updateSelect(startTime, endTime);
  updateTime(audioPos);
  format = $timeFormat.val();
});

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

var $timeFormat = $container.find('.time-format');
var $audioStart = $container.find('.audio-start');
var $audioEnd = $container.find('.audio-end');
var $time = $container.find('.audio-pos');

var format = "seconds";
var startTime = 0;
var endTime = 0;
var audioPos = 0;

function updateSelect(startTime, endTime) {
  $audioStart.val(cueFormatters(format)(startTime));
  $audioEnd.val(cueFormatters(format)(endTime));

  startTime = startTime;
  endTime = endTime;
}

ee.on("select", updateSelect);

function updateTime(time) {
  $time.html(cueFormatters(format)(time));

  audioPos = time;
}

ee.on("timeupdate", updateTime);