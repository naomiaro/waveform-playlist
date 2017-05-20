import h from 'virtual-dom/h';

import inputAeneas from './input/aeneas';
import outputAeneas from './output/aeneas';
import { secondsToPixels } from '../utils/conversions';
import DragInteraction from '../interaction/DragInteraction';
import ScrollTopHook from './render/ScrollTopHook';
import timeformat from '../utils/timeformat';

class AnnotationList {
  constructor(playlist, annotations, controls = [], editable = false,
    linkEndpoints = false, isContinuousPlay = false) {
    this.playlist = playlist;
    this.resizeHandlers = [];
    this.editable = editable;
    this.annotations = annotations.map(a =>
      // TODO support different formats later on.
      inputAeneas(a),
    );
    this.setupInteractions();

    this.controls = controls;
    this.setupEE(playlist.ee);

    // TODO actually make a real plugin system that's not terrible.
    this.playlist.isContinuousPlay = isContinuousPlay;
    this.playlist.linkEndpoints = linkEndpoints;
    this.length = this.annotations.length;
  }

  setupInteractions() {
    this.annotations.forEach((a, i) => {
      const leftShift = new DragInteraction(this.playlist, {
        direction: 'left',
        index: i,
      });
      const rightShift = new DragInteraction(this.playlist, {
        direction: 'right',
        index: i,
      });

      this.resizeHandlers.push(leftShift);
      this.resizeHandlers.push(rightShift);
    });
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

  renderResizeLeft(i) {
    const events = DragInteraction.getEvents();
    const config = { attributes: {
      style: 'position: absolute; height: 30px; width: 10px; top: 0; left: -2px',
      draggable: true,
    } };
    const handler = this.resizeHandlers[i * 2];

    events.forEach((event) => {
      config[`on${event}`] = handler[event].bind(handler);
    });

    return h('div.resize-handle.resize-w', config);
  }

  renderResizeRight(i) {
    const events = DragInteraction.getEvents();
    const config = { attributes: {
      style: 'position: absolute; height: 30px; width: 10px; top: 0; right: -2px',
      draggable: true,
    } };
    const handler = this.resizeHandlers[(i * 2) + 1];

    events.forEach((event) => {
      config[`on${event}`] = handler[event].bind(handler);
    });

    return h('div.resize-handle.resize-e', config);
  }

  renderControls(note, i) {
    // seems to be a bug with references, or I'm missing something.
    const that = this;
    return this.controls.map(ctrl =>
      h(`i.${ctrl.class}`, {
        attributes: {
          title: ctrl.title,
        },
        onclick: () => {
          ctrl.action(note, i, that.annotations, {
            linkEndpoints: that.playlist.linkEndpoints,
          });
          this.setupInteractions();
          that.playlist.drawRequest();
        },
      }),
    );
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
            this.renderResizeLeft(i),
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
            this.renderResizeRight(i),
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
      this.annotations.map((note, i) => {
        const format = timeformat(this.playlist.durationFormat);
        const start = format(note.start);
        const end = format(note.end);


        let segmentClass = '';
        if (this.playlist.isPlaying() &&
          (this.playlist.playbackSeconds >= note.start) &&
          (this.playlist.playbackSeconds <= note.end)) {
          segmentClass = '.current';
        }

        const editableConfig = {
          attributes: {
            contenteditable: true,
          },
          oninput: (e) => {
            // needed currently for references
            // eslint-disable-next-line no-param-reassign
            note.lines = [e.target.innerText];
          },
          onkeypress: (e) => {
            if (e.which === 13 || e.keyCode === 13) {
              e.target.blur();
              e.preventDefault();
            }
          },
        };

        const linesConfig = this.editable ? editableConfig : {};

        return h(`div.annotation${segmentClass}`,
          [
            h('span.annotation-id', [
              note.id,
            ]),
            h('span.annotation-start', [
              start,
            ]),
            h('span.annotation-end', [
              end,
            ]),
            h('span.annotation-lines',
              linesConfig,
              [
                note.lines,
              ],
            ),
            h('span.annotation-actions',
              this.renderControls(note, i),
            ),
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
