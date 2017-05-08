/*
{
  "begin": "5.759",
  "end": "9.155",
  "id": "002",
  "language": "en",
  "lines": [
    "I just wanted to hold"
  ]
},
 */

import uuid from 'uuid';

export default function (aeneas) {
  const annotation = {
    id: aeneas.id || uuid.v4(),
    start: Number(aeneas.begin) || 0,
    end: Number(aeneas.end) || 0,
    lines: aeneas.lines || [''],
    lang: aeneas.language || 'en',
  };

  return annotation;
}
