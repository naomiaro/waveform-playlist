export const drawCorner = (cc, x1, y1, x2, y2, width) => {
  cc.beginPath();
  cc.moveTo(x1, y1);
  cc.arcTo(x1, y2, x2, y1, width / 2);
  cc.lineTo(x1, y1);
  cc.closePath();
  cc.fill();
};
