import { Group, Line, Rect } from 'react-konva';
import type { Opening } from '../types/openings';

export type Side = 'N' | 'E' | 'S' | 'W';

function openingRect(side: Side, offset: number, length: number, thickness: number, roomW: number, roomH: number) {
  switch (side) {
    case 'N': return { x: offset, y: 0, width: length, height: thickness };
    case 'S': return { x: offset, y: roomH - thickness, width: length, height: thickness };
    case 'W': return { x: 0, y: offset, width: thickness, height: length };
    case 'E': return { x: roomW - thickness, y: offset, width: thickness, height: length };
  }
}

type Props = {
  roomW: number;
  roomH: number;
  wallThickness?: number;
  openings: Opening[];
};

export default function OpeningsLayer({ roomW, roomH, wallThickness = 12, openings }: Props) {
  const wallColor = '#333';

  return (
    <Group>
      {/* Walls */}
      <Line points={[0,0, roomW,0]} stroke={wallColor} strokeWidth={wallThickness} />
      <Line points={[roomW,0, roomW,roomH]} stroke={wallColor} strokeWidth={wallThickness} />
      <Line points={[roomW,roomH, 0,roomH]} stroke={wallColor} strokeWidth={wallThickness} />
      <Line points={[0,roomH, 0,0]} stroke={wallColor} strokeWidth={wallThickness} />

      {/* Openings */}
      {openings.map(o => {
        const r = openingRect(o.side, o.offset_px, o.length_px, o.thickness_px, roomW, roomH)!;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;

        return (
          <Group key={o.id}>
            {/* erase wall gap */}
            <Rect x={r.x} y={r.y} width={r.width} height={r.height} fill="#fff" />

            {/* crisp edges */}
            {o.side === 'N' || o.side === 'S' ? (
              <>
                <Line points={[r.x, r.y, r.x, r.y + r.height]} stroke={wallColor} strokeWidth={1} />
                <Line points={[r.x + r.width, r.y, r.x + r.width, r.y + r.height]} stroke={wallColor} strokeWidth={1} />
              </>
            ) : (
              <>
                <Line points={[r.x, r.y, r.x + r.width, r.y]} stroke={wallColor} strokeWidth={1} />
                <Line points={[r.x, r.y + r.height, r.x + r.width, r.y + r.height]} stroke={wallColor} strokeWidth={1} />
              </>
            )}

            {/* marker: door = inward line; window = cyan strip */}
            {o.opening_type === 'door' ? (
              <Line
                points={
                  o.side === 'N' ? [cx, r.y + r.height, cx, r.y + r.height + 18] :
                  o.side === 'S' ? [cx, r.y, cx, r.y - 18] :
                  o.side === 'W' ? [r.x + r.width, cy, r.x + r.width + 18, cy] :
                                   [r.x, cy, r.x - 18, cy]
                }
                stroke={wallColor}
                strokeWidth={2}
              />
            ) : (
              <Rect
                x={r.x} y={r.y}
                width={r.width} height={r.height}
                fill="rgba(0,180,255,0.25)"
                stroke="rgba(0,180,255,0.9)"
                strokeWidth={1}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
