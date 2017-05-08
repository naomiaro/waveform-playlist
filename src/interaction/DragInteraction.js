import { pixelsToSeconds } from '../utils/conversions';

export default class {
  constructor(playlist, data = {}) {
    this.playlist = playlist;
    this.data = data;
    this.active = false;

    this.ondragover = (e) => {
      if (this.active) {
        e.preventDefault();
        this.emitDrag(e.clientX);
      }
    };
  }

  emitDrag(x) {
    const deltaX = x - this.prevX;

    // emit shift event if not 0
    if (deltaX) {
      const deltaTime = pixelsToSeconds(
        deltaX,
        this.playlist.samplesPerPixel,
        this.playlist.sampleRate,
      );
      this.prevX = x;
      this.playlist.ee.emit('dragged', deltaTime, this.data);
    }
  }

  complete() {
    this.active = false;
    document.removeEventListener('dragover', this.ondragover);
  }

  dragstart(e) {
    const ev = e;
    this.active = true;
    this.prevX = e.clientX;

    ev.dataTransfer.dropEffect = 'move';
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', '');
    document.addEventListener('dragover', this.ondragover);
  }

  dragend(e) {
    if (this.active) {
      e.preventDefault();
      this.complete();
    }
  }

  static getClass() {
    return '.shift';
  }

  static getEvents() {
    return ['dragstart', 'dragend'];
  }
}
