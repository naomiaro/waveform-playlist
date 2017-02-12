import h from 'virtual-dom/h';

import inputAeneas from './input/aeneas';
import outputAeneas from './output/aeneas';
import { secondsToPixels } from '../utils/conversions';
import DragInteraction from '../interaction/DragInteraction';
import ScrollTopHook from './render/ScrollTopHook';
import timeformat from '../utils/timeformat';

class AnnotationList {
  constructor(playlist, annotations) {
    this.playlist = playlist;
    this.annotations = annotations.map((a, i) => {
      // TODO support different formats later on.
      const note = inputAeneas(a);
      note.leftShift = new DragInteraction(playlist, {
        direction: 'left',
        index: i,
      });
      note.rightShift = new DragInteraction(playlist, {
        direction: 'right',
        index: i,
      });

      return note;
    });
    this.setupEE(playlist.ee);

    // TODO actually make a real plugin system that's not terrible.
    this.playlist.isContinuousPlay = false;
    this.playlist.linkEndpoints = false;
    this.length = this.annotations.length;
  }

  setupEE(ee) {
    ee.on('dragged', (deltaTime, data) => {
      const annotationIndex = data.index;
      const annotations = this.annotations;
      const note = annotations[annotationIndex];

      // resizing to the left
      if (data.direction === 'left') {
        const originalVal = note.start;
        note.start += deltaTime;

        if (note.start < 0) {
          note.start = 0;
        }

        if (annotationIndex &&
          (annotations[annotationIndex - 1].end > note.start)) {
          annotations[annotationIndex - 1].end = note.start;
        }

        if (this.playlist.linkEndpoints &&
          annotationIndex &&
          (annotations[annotationIndex - 1].end === originalVal)) {
          annotations[annotationIndex - 1].end = note.start;
        }
      } else {
        // resizing to the right
        const originalVal = note.end;
        note.end += deltaTime;

        if (note.end > this.playlist.duration) {
          note.end = this.playlist.duration;
        }

        if (annotationIndex < (annotations.length - 1) &&
          (annotations[annotationIndex + 1].start < note.end)) {
          annotations[annotationIndex + 1].start = note.end;
        }

        if (this.playlist.linkEndpoints &&
          (annotationIndex < (annotations.length - 1)) &&
          (annotations[annotationIndex + 1].start === originalVal)) {
          annotations[annotationIndex + 1].start = note.end;
        }
      }

      this.playlist.drawRequest();
    });

    ee.on('continuousplay', (val) => {
      this.playlist.isContinuousPlay = val;
    });

    ee.on('linkendpoints', (val) => {
      this.playlist.linkEndpoints = val;
    });

    ee.on('annotationsrequest', () => {
      this.export();
    });

    return ee;
  }

  export() {
    const output = this.annotations.map(a => outputAeneas(a));
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(output))}`;
    const a = document.createElement('a');

    document.body.appendChild(a);
    a.href = dataStr;
    a.download = 'annotations.json';
    a.click();
    document.body.removeChild(a);
  }

  static renderResizeLeft(note) {
    const events = DragInteraction.getEvents();
    const config = { attributes: {
      style: 'position: absolute; height: 30px; width: 10px; top: 0; left: -2px',
      draggable: true,
    } };

    events.forEach((event) => {
      config[`on${event}`] = note.leftShift[event].bind(note.leftShift);
    });

    return h('div.resize-handle.resize-w', config);
  }

  static renderResizeRight(note) {
    const events = DragInteraction.getEvents();
    const config = { attributes: {
      style: 'position: absolute; height: 30px; width: 10px; top: 0; right: -2px',
      draggable: true,
    } };

    events.forEach((event) => {
      config[`on${event}`] = note.rightShift[event].bind(note.rightShift);
    });

    return h('div.resize-handle.resize-e', config);
  }

  render() {
    const boxes = h('div.annotations-boxes',
      {
        attributes: {
          style: 'height: 30px;',
        },
      },
      this.annotations.map((note, i) => {
        const samplesPerPixel = this.playlist.samplesPerPixel;
        const sampleRate = this.playlist.sampleRate;
        const pixPerSec = sampleRate / samplesPerPixel;
        const pixOffset = secondsToPixels(this.playlist.scrollLeft, samplesPerPixel, sampleRate);
        const left = Math.floor((note.start * pixPerSec) - pixOffset);
        const width = Math.ceil((note.end * pixPerSec) - (note.start * pixPerSec));

        return h('div.annotation-box',
          {
            attributes: {
              style: `position: absolute; height: 30px; width: ${width}px; left: ${left}px`,
              'data-id': note.id,
            },
          },
          [
            AnnotationList.renderResizeLeft(note),
            h('span.id',
              {
                onclick: () => {
                  if (this.playlist.isContinuousPlay) {
                    this.playlist.ee.emit('play', this.annotations[i].start);
                  } else {
                    this.playlist.ee.emit('play', this.annotations[i].start, this.annotations[i].end);
                  }
                },
              },
              [
                note.id,
              ],
            ),
            AnnotationList.renderResizeRight(note),
          ],
        );
      }),
    );

    const boxesWrapper = h('div.annotations-boxes-wrapper',
      {
        attributes: {
          style: 'overflow: hidden;',
        },
      },
      [
        boxes,
      ],
    );

    const text = h('div.annotations-text',
      {
        hook: new ScrollTopHook(),
      },
      this.annotations.map((note) => {
        const format = timeformat(this.playlist.durationFormat);
        const start = format(note.start);
        const end = format(note.end);


        let segmentClass = '';
        if (this.playlist.isPlaying() &&
          (this.playlist.playbackSeconds >= note.start) &&
          (this.playlist.playbackSeconds <= note.end)) {
          segmentClass = '.current';
        }

        return h(`div.row${segmentClass}`,
          [
            h('span.annotation.id', [
              note.id,
            ]),
            h('span.annotation.start', [
              start,
            ]),
            h('span.annotation.end', [
              end,
            ]),
            h('span.annotation.text', [
              note.lines,
            ]),
          ],
        );
      }),
    );

    return h('div.annotations',
      [
        boxesWrapper,
        text,
      ],
    );
  }
}

export default AnnotationList;
