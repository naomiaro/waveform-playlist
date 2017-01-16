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

import Annotation from '../Annotation';

export default function (aeneas) {
  const annotation = new Annotation();
  annotation.id = aeneas.id;
  annotation.start = Number(aeneas.begin);
  annotation.end = Number(aeneas.end);
  annotation.lines = aeneas.lines;
  annotation.lang = aeneas.language;

  return annotation;
}
