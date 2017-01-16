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

export default function (annotation) {
  return {
    begin: String(annotation.start.toFixed(3)),
    end: String(annotation.end.toFixed(3)),
    id: String(annotation.id),
    language: annotation.lang,
    lines: annotation.lines,
  };
}
