//openingUtils
import type { Side } from './OpeningsLayer';

export function nearestSide(x: number, y: number, roomW: number, roomH: number): Side {
  const d = { N: Math.abs(y - 0), S: Math.abs(y - roomH), W: Math.abs(x - 0), E: Math.abs(x - roomW) };
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0] as Side;
}

export function clampOpening(side: Side, posAlong: number, length: number, roomW: number, roomH: number) {
  const wallLen = (side === 'N' || side === 'S') ? roomW : roomH;
  const offset = Math.max(0, Math.min(posAlong, wallLen - length));
  return { offset, wallLen };
}

export function openingRect(side: Side, offset: number, length: number, thickness: number, roomW: number, roomH: number) {
  switch (side) {
    case 'N': return { x: offset, y: 0, width: length, height: thickness };
    case 'S': return { x: offset, y: roomH - thickness, width: length, height: thickness };
    case 'W': return { x: 0, y: offset, width: thickness, height: length };
    case 'E': return { x: roomW - thickness, y: offset, width: thickness, height: length };
  }
}
