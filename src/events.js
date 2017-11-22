export function automaticscroll(val) {
  this.isAutomaticScroll = val;
}

export function durationformat(format) {
  this.durationFormat = format;
  this.drawRequest();
}

export function select(start, end, track) {
  if (this.isPlaying()) {
    this.lastSeeked = start;
    this.pausedAt = undefined;
    this.restartPlayFrom(start);
  } else {
    // reset if it was paused.
    this.seek(start, end, track);
    this.ee.emit('timeupdate', start);
    this.drawRequest();
  }
}

export function startaudiorendering(type) {
  this.startOfflineRender(type);
}

export function statechange(state) {
  this.setState(state);
  this.drawRequest();
}

export function shift(deltaTime, track) {
  track.setStartTime(track.getStartTime() + deltaTime);
  this.adjustDuration();
  this.drawRequest();
}

export function record() {
  this.record();
}

export function play(start, end) {
  this.play(start, end);
}

export function pause() {
  this.pause();
}

export function stop() {
  this.stop();
}

export function rewind() {
  this.rewind();
}

export function fastforward() {
  this.fastForward();
}

export function clear() {
  this.clear().then(() => {
    this.drawRequest();
  });
}

export function solo(track) {
  this.soloTrack(track);
  this.adjustTrackPlayout();
  this.drawRequest();
}

export function mute(track) {
  this.muteTrack(track);
  this.adjustTrackPlayout();
  this.drawRequest();
}

export function volumechange(volume, track) {
  track.setGainLevel(volume / 100);
}

export function mastervolumechange(volume) {
  this.masterGain = volume / 100;
  this.tracks.forEach((track) => {
    track.setMasterGainLevel(this.masterGain);
  });
}

export function fadein(duration, track) {
  track.setFadeIn(duration, this.fadeType);
  this.drawRequest();
}

export function fadeout(duration, track) {
  track.setFadeOut(duration, this.fadeType);
  this.drawRequest();
}

export function fadetype(type) {
  this.fadeType = type;
}

export function newtrack(file) {
  this.load([{
    src: file,
    name: file.name,
  }]);
}

export function trim() {
  const track = this.getActiveTrack();
  const timeSelection = this.getTimeSelection();

  track.trim(timeSelection.start, timeSelection.end);
  track.calculatePeaks(this.samplesPerPixel, this.sampleRate);

  this.setTimeSelection(0, 0);
  this.drawRequest();
}

export function zoomin() {
  const zoomIndex = Math.max(0, this.zoomIndex - 1);
  const zoom = this.zoomLevels[zoomIndex];

  if (zoom !== this.samplesPerPixel) {
    this.setZoom(zoom);
    this.drawRequest();
  }
}

export function zoomout() {
  const zoomIndex = Math.min(this.zoomLevels.length - 1, this.zoomIndex + 1);
  const zoom = this.zoomLevels[zoomIndex];

  if (zoom !== this.samplesPerPixel) {
    this.setZoom(zoom);
    this.drawRequest();
  }
}

export function scroll() {
  this.isScrolling = true;
  this.drawRequest();
  clearTimeout(this.scrollTimer);
  this.scrollTimer = setTimeout(() => {
    this.isScrolling = false;
  }, 200);
}
