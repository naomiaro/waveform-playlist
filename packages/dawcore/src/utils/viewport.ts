/**
 * Compute which canvas chunk indices are visible within a viewport range.
 *
 * @param totalWidth - Total pixel width of the content
 * @param chunkWidth - Width of each canvas chunk (e.g. 1000px)
 * @param visibleStart - Viewport start in pixels (relative to timeline origin)
 * @param visibleEnd - Viewport end in pixels (relative to timeline origin)
 * @param originX - Content's left offset on the timeline
 */
export function getVisibleChunkIndices(
  totalWidth: number,
  chunkWidth: number,
  visibleStart: number,
  visibleEnd: number,
  originX = 0
): number[] {
  const totalChunks = Math.ceil(totalWidth / chunkWidth);
  const indices: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkStart = originX + i * chunkWidth;
    const chunkEnd = chunkStart + chunkWidth;
    if (chunkEnd > visibleStart && chunkStart < visibleEnd) {
      indices.push(i);
    }
  }
  return indices;
}
