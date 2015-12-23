var ee = playlist.getEventEmitter();

document.querySelector(".btn-play").addEventListener("click", function() {
  ee.emit("play");
});

document.querySelector(".btn-pause").addEventListener("click", function() {
  ee.emit("pause");
});

document.querySelector(".btn-stop").addEventListener("click", function() {
  ee.emit("stop");
});

document.querySelector(".btn-rewind").addEventListener("click", function() {
  ee.emit("rewind");
});

document.querySelector(".btn-fast-forward").addEventListener("click", function() {
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

document.querySelector(".btn-cursor").addEventListener("click", function(e) {
  ee.emit("statechange", "cursor");
  toggleActive(this);
});

document.querySelector(".btn-select").addEventListener("click", function(e) {
  ee.emit("statechange", "select");
  toggleActive(this);
});

document.querySelector(".btn-shift").addEventListener("click", function(e) {
  ee.emit("statechange", "shift");
  toggleActive(this);
});

document.querySelector(".btn-fadein").addEventListener("click", function(e) {
  ee.emit("statechange", "fadein");
  toggleActive(this);
});

document.querySelector(".btn-fadeout").addEventListener("click", function(e) {
  ee.emit("statechange", "fadeout");
  toggleActive(this);
});