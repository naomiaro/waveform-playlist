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