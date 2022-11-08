export function getXOffsetOnTouchEvent(e) {
  const bcr = e.target.getBoundingClientRect();
  return e.targetTouches[0].clientX - bcr.x;
}
