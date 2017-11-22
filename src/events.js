export automaticscroll(val) => {
  this.isAutomaticScroll = val;
};

export durationformat(format) => {
  this.durationFormat = format;
  this.drawRequest();
};

export select(start, end, track) => {
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
};

export startaudiorendering(type) => {
  this.startOfflineRender(type);
};

export statechange(state) => {
  this.setState(state);
  this.drawRequest();
};

export shift(deltaTime, track) => {
  track.setStartTime(track.getStartTime() + deltaTime);
  this.adjustDuration();
  this.drawRequest();
};

export record() => {
  this.record();
};

export play(start, end) => {
  this.play(start, end);
};

export pause() => {
  this.pause();
};

export stop() => {
  this.stop();
};

export rewind() => {
  this.rewind();
};

export fastforward() => {
  this.fastForward();
};

export clear() => {
  this.clear().then(() => {
    this.drawRequest();
  });
};

export solo(track) => {
  this.soloTrack(track);
  this.adjustTrackPlayout();
  this.drawRequest();
};

export mute(track) => {
  this.muteTrack(track);
  this.adjustTrackPlayout();
  this.drawRequest();
};

export volumechange(volume, track) => {
  track.setGainLevel(volume / 100);
};

export mastervolumechange(volume) => {
  this.masterGain = volume / 100;
  this.tracks.forEach((track) => {
    track.setMasterGainLevel(this.masterGain);
  });
};

export fadein(duration, track) => {
  track.setFadeIn(duration, this.fadeType);
  this.drawRequest();
};

export fadeout(duration, track) => {
  track.setFadeOut(duration, this.fadeType);
  this.drawRequest();
};

export fadetype(type) => {
  this.fadeType = type;
};

export newtrack(file) => {
  this.load([{
    src: file,
    name: file.name,
  }]);
};

export trim() => {
  const track = this.getActiveTrack();
  const timeSelection = this.getTimeSelection();

  track.trim(timeSelection.start, timeSelection.end);
  track.calculatePeaks(this.samplesPerPixel, this.sampleRate);

  this.setTimeSelection(0, 0);
  this.drawRequest();
};

export zoomin() => {
  const zoomIndex = Math.max(0, this.zoomIndex - 1);
  const zoom = this.zoomLevels[zoomIndex];

  if (zoom !== this.samplesPerPixel) {
    this.setZoom(zoom);
    this.drawRequest();
  }
};

export zoomout() => {
  const zoomIndex = Math.min(this.zoomLevels.length - 1, this.zoomIndex + 1);
  const zoom = this.zoomLevels[zoomIndex];

  if (zoom !== this.samplesPerPixel) {
    this.setZoom(zoom);
    this.drawRequest();
  }
};

export scroll() => {
  this.isScrolling = true;
  this.drawRequest();
  clearTimeout(this.scrollTimer);
  this.scrollTimer = setTimeout(() => {
    this.isScrolling = false;
  }, 200);
};
