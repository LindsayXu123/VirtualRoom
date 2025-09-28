// client/src/pages/RoomBuilder.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import { Stage, Layer, Rect, Line, Circle, Shape, Ellipse, Image as KImage, Transformer, Group } from 'react-konva';
import OpeningsLayer from './OpeningsLayer';
import { nearestSide, clampOpening, openingRect } from './openingUtils';
import type { Opening, OpeningKind } from '../types/openings';
import useImage from 'use-image';
import { Label, Tag, Text, Arrow } from 'react-konva';

type URLImageProps = { url: string } & Omit<React.ComponentProps<typeof KImage>, 'image'>;

function URLImage({ url, ...props }: URLImageProps) {
  const [img, status] = useImage(url, 'anonymous');

  if (status === 'failed') {
    return <Rect {...props} fill="#eee" stroke="#999" dash={[4, 4]} />;
  }
  return <KImage {...props} image={img ?? undefined} />;
}

type InventoryListProps = {
  items: InventoryItem[];
  onPlace?: (item: InventoryItem) => void;
};

function InventoryList({ items, onPlace }: InventoryListProps) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="border rounded p-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold truncate">{it.name}</div>
              <div className="text-xs text-gray-500">
                {it.width} × {it.height} ({it.shape})
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onPlace && (
                <button
                  onClick={() => onPlace(it)}
                  className="text-sm bg-indigo-600 text-white px-2 py-1 rounded"
                >
                  Place
                </button>
              )}

              {/* the toggle */}
              <details className="relative">
                <summary className="cursor-pointer select-none text-sm underline decoration-dotted">
                  View details
                </summary>
                <div className="mt-2 p-2 bg-gray-50 border rounded shadow-sm text-sm">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <div>
                      <span className="text-gray-500">Width:</span> {it.width}
                    </div>
                    <div>
                      <span className="text-gray-500">Height:</span> {it.height}
                    </div>
                    <div>
                      <span className="text-gray-500">Shape:</span> {it.shape}
                    </div>
                    <div>
                      <span className="text-gray-500">Rotation:</span> {it.rotation ?? 0}°
                    </div>
                    {it.imageUrl && (
                      <div className="col-span-2 mt-2">
                        <div className="text-gray-500 mb-1">Preview:</div>
                        <img
                          src={it.imageUrl}
                          alt={`${it.name} preview`}
                          className="w-24 h-24 object-contain border rounded bg-white"
                        />
                      </div>
                    )}
                    {it.notes && (
                      <div className="col-span-2 text-gray-600 mt-1">
                        <span className="text-gray-500">Notes:</span> {it.notes}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


function doorFlapLinePoints(
  side: 'N' | 'E' | 'S' | 'W',
  hingeAtStart: boolean,
  r: { x: number; y: number; width: number; height: number },
  lengthScale = 1
) {
  let hx = 0, hy = 0;
  if (side === 'N') {
    hx = hingeAtStart ? r.x : r.x + r.width;
    hy = r.y + r.height;
  } else if (side === 'S') {
    hx = hingeAtStart ? r.x : r.x + r.width;
    hy = r.y;
  } else if (side === 'W') {
    hx = r.x + r.width;
    hy = hingeAtStart ? r.y : r.y + r.height;
  } else { // 'E'
    hx = r.x;
    hy = hingeAtStart ? r.y : r.y + r.height;
  }

  let tx = 0, ty = 0, nx = 0, ny = 0;
  if (side === 'N') { tx = 1; ty = 0; nx = 0; ny = 1; }
  if (side === 'S') { tx = 1; ty = 0; nx = 0; ny = -1; }
  if (side === 'W') { tx = 0; ty = 1; nx = 1; ny = 0; }
  if (side === 'E') { tx = 0; ty = 1; nx = -1; ny = 0; }

  const s = hingeAtStart ? 1 : -1;
  const dx = nx + s * tx;
  const dy = ny + s * ty;
  const mag = Math.hypot(dx, dy) || 1;
  const ux = dx / mag;
  const uy = dy / mag;

  const span = ((side === 'N' || side === 'S') ? r.width : r.height) * lengthScale;

  const x2 = hx + ux * span;
  const y2 = hy + uy * span;

  return [hx, hy, x2, y2] as const;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function buildLOutline(
  W: number,
  H: number,
  notchW: number,
  notchH: number,
  corner: 'tl' | 'tr' | 'bl' | 'br' = 'tl'
): [number, number][] {
  switch (corner) {
    case 'tl': return [[0, 0], [W, 0], [W, H], [notchW, H], [notchW, notchH], [0, notchH]];
    case 'tr': return [[0, 0], [W, 0], [W, notchH], [W, H], [0, H], [0, notchH]];
    case 'bl': return [[0, 0], [W, 0], [W, H], [0, H], [0, H - notchH], [notchW, H - notchH]];
    case 'br': return [[0, 0], [W, 0], [W, H - notchH], [W - notchW, H - notchH], [W - notchW, H], [0, H]];
  }
}

async function saveTemplateViaNotes(opts: {
  name: string;
  width: number;
  height: number;
  type: 'rectangle' | 'lshape';
  cutW?: number;
  cutH?: number;
  corner?: 'tl' | 'tr' | 'bl' | 'br';
}) {
  const { name, width, height, type, cutW, cutH, corner = 'tl' } = opts;
  const isL = type === 'lshape';

  const outline = isL
    ? buildLOutline(
      width,
      height,
      clamp(cutW ?? Math.floor(width / 2), 1, width - 1),
      clamp(cutH ?? Math.floor(height / 2), 1, height - 1),
      corner
    )
    : null;

  const notes = isL
    ? JSON.stringify({ shape_type: 'l', outline })
    : JSON.stringify({ shape_type: 'rectangle' });

  // Post to your existing /templates endpoint
  const res = await api.post('/templates', { name, width, height, notes });
  return res.data; // { id, name, width, height, notes }
}

function aabbSizeForRotation(wPx: number, hPx: number, rotationDeg: number) {
  const r = ((rotationDeg % 360) * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: wPx * c + hPx * s, h: wPx * s + hPx * c };
}

function itemFitsRoom(inv: { width: number; height: number }, tpl: Template) {
  if (tpl.type === 'rectangle') {
    return inv.width <= tpl.width && inv.height <= tpl.height;
  }
  return inv.width <= tpl.width && inv.height <= tpl.height;
}

function Modal({
  open, onClose, children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-4">
        {children}
        <div className="mt-4 text-right">
          <button onClick={onClose} className="px-3 py-1 rounded bg-blue-600 text-white">OK</button>
        </div>
      </div>
    </div>
  );
}

function makeDragBound(item: PlacedItem, stageWidth: number, stageHeight: number, scale: number) {
  const wPx = item.width * scale;
  const hPx = item.height * scale;
  const { w: aabbW, h: aabbH } = aabbSizeForRotation(wPx, hPx, item.rotation);

  const minX = 0;
  const minY = 0;
  const maxX = stageWidth - aabbW;
  const maxY = stageHeight - aabbH;

  return (pos: { x: number; y: number }) => ({
    x: clamp(pos.x, minX, Math.max(minX, maxX)),
    y: clamp(pos.y, minY, Math.max(minY, maxY)),
  });
}

function DimensionsOverlay({
  scale,
  visible,
  rect,
  polygon,
  unitsPerPixel = 1,
  unitLabel = 'units',
}: {
  scale: number;
  visible: boolean;
  rect?: { width: number; height: number } | null;
  polygon?: [number, number][] | null;
  unitsPerPixel?: number;
  unitLabel?: string;
}) {
  if (!visible) return null;

  // Helpers
  const dist = (a: [number, number], b: [number, number]) =>
    Math.hypot(b[0] - a[0], b[1] - a[1]);

  // format labels (distance is in template units; convert + round)
  const fmt = (d: number) => {
    const v = d * unitsPerPixel;
    return Number.isInteger(v) ? `${v} ${unitLabel}` : `${v.toFixed(1)} ${unitLabel}`;
  };

  // Compute a centroid for polygon to determine “outside” direction
  const centroid = (pts: [number, number][]) => {
    let x = 0, y = 0;
    for (const [px, py] of pts) { x += px; y += py; }
    return [x / pts.length, y / pts.length] as [number, number];
  };

  // Draw one dimension (offset from a wall segment)
  const DimForSegment = ({
    a, b, offset = 20, label,
  }: {
    a: [number, number];
    b: [number, number];
    offset?: number;
    label: string;
  }) => {
    // direction
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len, uy = vy / len;

    // 2D normal (perp)
    let nx = -uy, ny = ux;

    // Decide which normal points “outside” (away from centroid if polygon provided)
    if (polygon && polygon.length >= 3) {
      const C = centroid(polygon);
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const toC: [number, number] = [C[0] - mid[0], C[1] - mid[1]];
      const dot = toC[0] * nx + toC[1] * ny;
      if (dot > 0) { nx = -nx; ny = -ny; } // flip to point away from interior
    }

    // Offset line (in template units), then scale to screen
    const off = offset / scale; // keep a fixed screen-space gap
    const a2: [number, number] = [a[0] + nx * off, a[1] + ny * off];
    const b2: [number, number] = [b[0] + nx * off, b[1] + ny * off];

    // Extension ticks (short lines from wall to dimension line)
    const tickLen = 8 / scale;
    const at1: [number, number] = [a2[0] + (-ux) * tickLen, a2[1] + (-uy) * tickLen];
    const at2: [number, number] = [a2[0] + (ux) * tickLen, a2[1] + (uy) * tickLen];
    const bt1: [number, number] = [b2[0] + (-ux) * tickLen, b2[1] + (-uy) * tickLen];
    const bt2: [number, number] = [b2[0] + (ux) * tickLen, b2[1] + (uy) * tickLen];

    // mid point for label (screen coords)
    const mid: [number, number] = [
      (a2[0] + b2[0]) / 2,
      (a2[1] + b2[1]) / 2,
    ];

    // Render (scaled)
    return (
      <>
        {/* extension ticks */}
        <Line
          listening={false}
          points={[a2[0] * scale, a2[1] * scale, at1[0] * scale, at1[1] * scale, at2[0] * scale, at2[1] * scale]}
          stroke="#444"
          strokeWidth={1}
        />
        <Line
          listening={false}
          points={[b2[0] * scale, b2[1] * scale, bt1[0] * scale, bt1[1] * scale, bt2[0] * scale, bt2[1] * scale]}
          stroke="#444"
          strokeWidth={1}
        />

        {/* dimension arrowed line */}
        <Arrow
          listening={false}
          points={[a2[0] * scale, a2[1] * scale, b2[0] * scale, b2[1] * scale]}
          stroke="#222"
          fill="#222"
          strokeWidth={1}
          pointerLength={8}
          pointerWidth={8}
        />

        {/* label */}
        <Label listening={false} x={mid[0] * scale} y={mid[1] * scale}>
          <Tag fill="white" stroke="#222" strokeWidth={1} cornerRadius={4} />
          <Text
            text={label}
            padding={4}
            fontSize={12}
            fill="#222"
          />
        </Label>
      </>
    );
  };

  const elements: React.ReactNode[] = [];

  if (polygon && polygon.length >= 3) {
    // L-shape
    const pts = polygon;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const L = dist(a, b);
      elements.push(
        <DimForSegment key={`seg-${i}`} a={a} b={b} offset={20} label={fmt(L)} />
      );
    }
  } else if (rect) {
    // Rectangle: top + right walls (enough to show W×H cleanly)
    const W = rect.width, H = rect.height;
    const topA: [number, number] = [0, 0];
    const topB: [number, number] = [W, 0];
    const rightA: [number, number] = [W, 0];
    const rightB: [number, number] = [W, H];

    elements.push(<DimForSegment key="w" a={topA} b={topB} offset={20} label={fmt(W)} />);
    elements.push(<DimForSegment key="h" a={rightA} b={rightB} offset={20} label={fmt(H)} />);
  }

  return <Layer listening={false}>{elements}</Layer>;
}

interface InventoryItem {
  id: number;
  name: string;
  width: number;
  height: number;
  notes?: string;
  imageUrl?: string;
  rotation: number;
  shape: 'rectangle' | 'circle' | 'triangle' | 'image';
}
interface PlacedItem {
  id: number;
  name: string;
  width: number;
  height: number;
  pos_x: number;
  pos_y: number;
  notes?: string;
  rotation: number;
  color: string;
  imageUrl?: string;
  shape: 'rectangle' | 'circle' | 'triangle' | 'image';
}

type RectangleTemplate = { type: 'rectangle'; width: number; height: number };
type LShapeTemplate = { type: 'lshape'; width: number; height: number; cutWidth: number; cutHeight: number };
type CircleTemplate = { type: 'circle'; radius: number };
type TriangleTemplate = { type: 'triangle'; width: number; height: number };
type Template = RectangleTemplate | LShapeTemplate;

export default function RoomBuilder() {
  const { id } = useParams<{ id: string }>();
  const roomId = Number(id);

  // Main state
  const [room, setRoom] = useState<{ name: string; width: number; height: number } | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Inventory form
  const [invName, setInvName] = useState('');
  const [invWidth, setInvWidth] = useState(1);
  const [invHeight, setInvHeight] = useState(1);
  const [invShape, setInvShape] = useState<'rectangle' | 'circle' | 'triangle' | 'image'>('rectangle');
  const [invColor, setInvColor] = useState('#888888');
  const [invImageUrl, setInvImageUrl] = useState('');
  const [invRotation, setInvRotation] = useState(0);
  // Template form
  const [template, setTemplate] = useState<Template>({ type: 'rectangle', width: 10, height: 10 });

  // Canvas sizing
  const scale = 20;
  const stageWidth = template.width * scale;
  const stageHeight = template.height * scale;
  const [showDims, setShowDims] = useState(false);

  const isL = template.type === 'lshape';
  const poly =
    isL
      ? buildLOutline(
        template.width,
        template.height,
        (template as any).cutWidth,
        (template as any).cutHeight,
        'tl'
      )
      : null;


  //openings
  type OpeningTool = 'select' | 'door' | 'window';
  type Side = 'N' | 'E' | 'S' | 'W';
  const WALL_THICK = 12;
  const [selectedOpeningId, setSelectedOpeningId] = useState<number | null>(null);

  const handleToolClick = (next: OpeningTool) => {
    setTool(prev => (prev === next ? 'select' : next)); // toggle off if clicked again
    setGhost(null);
  }

  const roomW = stageWidth;
  const roomH = stageHeight;
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [tool, setTool] = useState<'select' | 'door' | 'window'>('select');
  const [ghost, setGhost] = useState<{ type: OpeningKind, side: Side, offset: number, length: number } | null>(null);
  const [placeMultiple, setPlaceMultiple] = useState(false);
  const [oversize, setOversize] = useState<{ name: string; width: number; height: number } | null>(null);

  // Fetch everything at once
  const fetchRoomData = async () => {
    setLoading(true);
    try {
      const roomRes = await api.get(`/rooms/${roomId}`);
      setRoom(roomRes.data);
      setTemplate({ type: 'rectangle', width: roomRes.data.width, height: roomRes.data.height });

      const invRes = await api.get<InventoryItem[]>('/inventory');
      setInventory(invRes.data);

      const placedRes = await api.get<PlacedItem[]>(`/items/room/${roomId}`);
      setPlacedItems(placedRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoomData(); }, [roomId]);

  //openings
  useEffect(() => {
    api.get(`/rooms/${roomId}/openings`)
      .then(res => setOpenings(res.data))
      .catch(console.error);
  }, [roomId]);

  // Konva refs for selection transformer
  const layerRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  // Attach transformer to the selected shape
  useEffect(() => {
    if (selectedId !== null && trRef.current && layerRef.current) {
      const node = layerRef.current.findOne(`#item-${selectedId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedId, placedItems]);

  // Delete placed item on Backspace
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && selectedId !== null) {
        api.delete(`/items/${selectedId}`)
          .then(() => {
            setPlacedItems(prev => prev.filter(i => i.id !== selectedId));
            setSelectedId(null);
          })
          .catch(console.error);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const tag = ae?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (ae as any)?.isContentEditable) return;

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedOpeningId != null) {
        e.preventDefault();
        api.delete(`/openings/${selectedOpeningId}`)
          .then(() => {
            setOpenings(prev => prev.filter(op => op.id !== selectedOpeningId));
            setSelectedOpeningId(null);
          })
          .catch((err: any) => alert(err?.response?.data?.error || 'Failed to delete opening'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedOpeningId]);


  // Update position on drag end
  const handleDragEnd = (e: any, item: PlacedItem) => {
    const { x, y } = e.target.position();
    const newX = x / scale, newY = y / scale;
    api.put(`/items/${item.id}`, { ...item, pos_x: newX, pos_y: newY })
      .then(() => {
        setPlacedItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, pos_x: newX, pos_y: newY } : i)
        );
      })
      .catch(console.error);
  };

  const handleTransformEnd = () => {
    if (selectedId == null) return;
    const node = trRef.current.nodes()[0];
    const newRot = node.rotation();
    api.put(`/items/${selectedId}/rotation`, { rotation: newRot })
      .then(res => {
        const updated = res.data as PlacedItem;
        setPlacedItems(p => p.map(i => i.id === selectedId ? updated : i));
      })
      .catch(console.error);
  };

  // Clone inventory into room
  const addToRoom = (inv: InventoryItem) => {
    api.post<PlacedItem>('/items', {
      room_id: roomId,
      name: inv.name,
      type: 'Generic',
      pos_x: 0, pos_y: 0,
      width: inv.width, height: inv.height,
      shape: inv.shape,
      image_url: inv.imageUrl || null,
      notes: inv.notes || ''
    })
      .then(res => setPlacedItems(prev => [...prev, res.data]))
      .catch(console.error);
  };

  // Create new inventory item
  const createInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    api.post<InventoryItem>('/inventory', {
      name: invName, width: invWidth, height: invHeight, notes: ''
    })
      .then(res => setInventory(prev => [...prev, res.data]))
      .catch(console.error);
    setInvName(''); setInvWidth(1); setInvHeight(1);
  };

  // Delete inventory item
  const deleteInventoryItem = (invId: number) => {
    if (!window.confirm('Really delete this inventory item?')) return;
    api.delete(`/inventory/${invId}`)
      .then(() => setInventory(prev => prev.filter(i => i.id !== invId)))
      .catch(console.error);
  };

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    api.put(`/rooms/${roomId}`, { width: template.width, height: template.height })
      .then(res => setRoom(res.data))
      .catch(err => {
        console.error('Save failed', err);
        alert('Failed to save room shape');
      });
  };

  // Compute L-shape points
  const computeLShape = () => {
    if (template.type !== 'lshape') return [];
    const { width, height, cutWidth, cutHeight } = template;
    return [
      0, 0,
      (width - cutWidth) * scale, 0,
      (width - cutWidth) * scale, cutHeight * scale,
      width * scale, cutHeight * scale,
      width * scale, height * scale,
      0, height * scale,
    ];
  };

  const defaultLen = (t: 'door' | 'window') => (t === 'door' ? 80 : 100);

  const handleStageMouseMove = (e: any) => {
    if (tool === 'select') return;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;

    const side = nearestSide(pos.x, pos.y, roomW, roomH);
    const len = defaultLen(tool);
    const posAlong = (side === 'N' || side === 'S') ? pos.x : pos.y;
    const { offset } = clampOpening(side, posAlong - len / 2, len, roomW, roomH);

    setGhost({ type: tool, side, offset, length: len });
  };

  const handleStageMouseDown = async () => {
    if (!ghost) return;
    try {
      const payload = {
        opening_type: ghost.type,
        side: ghost.side,
        offset_px: Math.round(ghost.offset),
        length_px: Math.round(ghost.length),
        thickness_px: WALL_THICK,
        swing: null,
        roomWidth: roomW,
        roomHeight: roomH,
      };
      const res = await api.post(`/rooms/${roomId}/openings`, payload);
      setOpenings(prev => [...prev, res.data]);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to add opening';
      alert(`Add opening failed: ${msg}`);
    }
    if (!placeMultiple) {
      setTool('select');
      setGhost(null);
    }
  };

  const handleInventoryEdit = async (
    e: React.FormEvent<HTMLFormElement>,
    inv: InventoryItem
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const width = Number(fd.get('width'));
    const height = Number(fd.get('height'));
    const notes = String(fd.get('notes') ?? '');

    try {
      await api.put(`/inventory/${inv.id}`, { width, height, notes });

      setInventory(prev =>
        prev.map(i => i.id === inv.id ? { ...i, width, height, notes } : i)
      );

      form.closest('details')?.removeAttribute('open');
    } catch (err) {
      console.error('Edit inventory failed:', err);
    }
  };


  if (loading) return <p className="p-4">Loading...</p>;
  if (!room) return <p className="p-4">Room not found.</p>;

  return (
    <div className="flex fixed inset-0 overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/4 pr-4 flex flex-col min-h-0">
        {/* Room Template Form */}
        <form onSubmit={handleTemplateSubmit} className="mb-4 border p-3 rounded space-y-2">
          <h3 className="font-semibold">Floor Plan</h3>
          <div>
            <label className="mr-2">Shape:</label>
            <select
              value={template.type}
              onChange={e => {
                const t = e.target.value as Template['type'];
                if (t === 'rectangle') {
                  setTemplate({ type: 'rectangle', width: template.width, height: template.height });
                } else {
                  setTemplate({
                    type: 'lshape',
                    width: template.width,
                    height: template.height,
                    cutWidth: Math.floor(template.width / 2),
                    cutHeight: Math.floor(template.height / 2),
                  });
                }
              }}
              className="border px-2 py-1 rounded"
            >
              <option value="rectangle">Rectangle</option>
              <option value="lshape">L-Shape</option>
            </select>
          </div>
          <div className="flex space-x-2">
            <label>
              W: <input
                type="number"
                value={template.width}
                onChange={e => setTemplate(prev => ({ ...prev, width: +e.target.value } as Template))}
                className="w-16 border px-1 py-1 rounded"
                required
              />
            </label>
            <label>
              H: <input
                type="number"
                value={template.height}
                onChange={e => setTemplate(prev => ({ ...prev, height: +e.target.value } as Template))}
                className="w-16 border px-1 py-1 rounded"
                required
              />
            </label>
          </div>
          {template.type === 'lshape' && (
            <div className="flex space-x-2">
              <label>
                Cut W: <input
                  type="number"
                  value={(template as LShapeTemplate).cutWidth}
                  onChange={e => setTemplate(prev => ({ ...prev, cutWidth: +e.target.value } as Template))}
                  className="w-16 border px-1 py-1 rounded"
                  required
                />
              </label>
              <label>
                Cut H: <input
                  type="number"
                  value={(template as LShapeTemplate).cutHeight}
                  onChange={e => setTemplate(prev => ({ ...prev, cutHeight: +e.target.value } as Template))}
                  className="w-16 border px-1 py-1 rounded"
                  required
                />
              </label>
            </div>
          )}
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">
            Save
          </button>
          <div className="mt-4 mb-2 flex items-center gap-3">
            <span className="text-sm text-gray-600">Add:</span>

            {/* Door */}
            <button
              type="button"
              onClick={() => handleToolClick('door')}
              aria-pressed={tool === 'door'}
              className={`px-3 py-1 rounded-full text-sm font-medium transition
      ${tool === 'door'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              Door
            </button>

            {/* Window */}
            <button
              type="button"
              onClick={() => handleToolClick('window')}
              aria-pressed={tool === 'window'}
              className={`px-3 py-1 rounded-full text-sm font-medium transition
      ${tool === 'window'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              Window
            </button>

            <span className="ml-2 text-xs text-gray-500"></span>
          </div>
        </form>

        {/* Inventory Form */}

        <h3 className="text-lg mb-2">Create Furniture</h3>
        <form onSubmit={createInventoryItem} className="mb-4 flex space-x-2 items-center">
          <div className="flex space-x-2">
            <input
              type="text" placeholder="Name" value={invName}
              onChange={e => setInvName(e.target.value)}
              className="w-24 border px-1 py-1 rounded" required
            />
            W: <input
              type="number" placeholder="W" value={invWidth}
              onChange={e => setInvWidth(+e.target.value)}
              className="w-12 border px-1 py-1 rounded" min={1} max={100} required
            />
            H: <input
              type="number" placeholder="H" value={invHeight}
              onChange={e => setInvHeight(+e.target.value)}
              className="w-12 border px-1 py-1 rounded" min={1} max={100} required
            />
          </div>

          <div>
            <label className="mr-2">Shape:</label>
            <select
              value={invShape}
              onChange={e => setInvShape(e.target.value as InventoryItem['shape'])}
              className="border px-2 py-1 rounded"
            >
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="triangle">Triangle</option>
              <option value="image">Image</option>
            </select>
          </div>

          {/* File picker + preview when shape=image */}
          {invShape === 'image' && (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setInvImageUrl(reader.result as string);
                  reader.readAsDataURL(file);
                }}
                className="w-full border px-1 py-1 rounded"
                required
              />
              {invImageUrl && (
                <div className="mt-2 w-20 h-20 overflow-hidden rounded border">
                  <img
                    src={invImageUrl}
                    alt="Preview"
                    className="mt-2 rounded shadow-sm w-full h-full"
                    style={{ maxWidth: '100%' }}
                  />
                </div>
              )}
            </>
          )}

          <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded">
            Add to Inventory
          </button>
        </form>

        {/* Inventory List */}

        <div className="mt-4 flex-1 min-h-0 basis-0 overflow-y-auto pr-2 rounded border">
          <h2 className="text-lg sticky top-0 z-10 bg-white py-2 px-2 border-b">Inventory</h2>
          <ul className="space-y-2">
            {inventory.map(inv => (
              <li key={inv.id} className="p-3 border rounded flex justify-between items-start">
                <div className="flex flex-col min-w-0">
                  <span className="font-medium">{inv.name}</span>

                  <button
                    onClick={() => {
                      if (!itemFitsRoom(inv, template)) {
                        setOversize({ name: inv.name, width: inv.width, height: inv.height });
                        return;
                      }
                      addToRoom(inv);
                    }}
                    className="mt-2 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Add to Room
                  </button>

                  {/* View details toggle */}
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-sm underline decoration-dotted">
                      View details
                    </summary>
                    <div className="mt-2 p-2 bg-gray-50 border rounded shadow-sm text-sm">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <div>
                          <span className="text-gray-500">Width:</span> {inv.width}
                        </div>
                        <div>
                          <span className="text-gray-500">Height:</span> {inv.height}
                        </div>
                        <div>
                          <span className="text-gray-500">Shape:</span> {inv.shape}
                        </div>

                      </div>

                      {inv.imageUrl && (
                        <div className="mt-2">
                          <div className="text-gray-500 mb-1">Preview:</div>
                          <img
                            src={inv.imageUrl}
                            alt={`${inv.name} preview`}
                            className="w-24 h-24 object-contain border rounded bg-white"
                          />
                        </div>
                      )}

                      {inv.notes && (
                        <div className="mt-2 text-gray-600">
                          <span className="text-gray-500">Notes:</span> {inv.notes}
                        </div>
                      )}
                    </div>
                  </details>
                </div>

                <button
                  onClick={() => deleteInventoryItem(inv.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

        </div>

        {selectedId != null && (() => {
          const sel = placedItems.find(i => i.id === selectedId);
          if (!sel) return null;
          return (
            <div className="mt-4 p-2 border rounded">
              <h3 className="font-semibold">Selected Item</h3>
              <div className="flex items-center space-x-2">
                <label>Color:</label>
                <input
                  type="color"
                  value={sel.color}
                  onChange={e => {
                    const newColor = e.target.value;
                    api.put(`/items/${sel.id}/color`, { color: newColor })
                      .then(res => {
                        const updated = res.data as PlacedItem;
                        setPlacedItems(ps =>
                          ps.map(i => i.id === sel.id ? updated : i)
                        );
                      })
                      .catch(console.error);
                  }}
                  className="w-8 h-8 p-0 border-0"
                />
              </div>
            </div>
          );
        })()}

      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 min-w-0 overflow-auto">
        <h1 className="text-2xl mb-4">{room.name}</h1>

        <Stage
          width={stageWidth}
          height={stageHeight}
          style={{ border: '1px solid #ccc' }}
          onMouseMove={handleStageMouseMove}
          onMouseDown={handleStageMouseDown}
        >
          <Layer ref={layerRef}>
            {/* walls */}
            {template.type === 'rectangle' ? (
              <Rect x={0} y={0} width={stageWidth} height={stageHeight} stroke="#333" strokeWidth={2} />
            ) : (
              <Line points={computeLShape()} closed stroke="#333" strokeWidth={2} />
            )}

            {/* openings overlay (rectangle only) — draw AFTER walls, BEFORE items */}
            {template.type === 'rectangle' && openings.map(o => {
              const r = openingRect(o.side, o.offset_px, o.length_px, o.thickness_px, roomW, roomH)!;

              const swing = (o.swing || 'in-left') as 'in-left' | 'in-right';
              const hingeAtStart = swing.includes('left');

              return (
                <Group
                  key={o.id}
                  // select when in "select" mode
                  onMouseDown={(evt) => {
                    if (tool === 'select') {
                      evt.cancelBubble = true;            // don't bubble to Stage (prevents placing)
                      setSelectedOpeningId(o.id);
                      setGhost(null);
                    }
                  }}
                  onMouseEnter={(e) => { e.target.getStage()?.container().style.setProperty('cursor', 'pointer'); }}
                  onMouseLeave={(e) => { e.target.getStage()?.container().style.removeProperty('cursor'); }}
                >
                  {/* erase the wall gap */}
                  <Rect x={r.x} y={r.y} width={r.width} height={r.height} fill="#fff" />

                  {/* crisp opening edges */}
                  {(o.side === 'N' || o.side === 'S') ? (
                    <>
                      <Line points={[r.x, r.y, r.x, r.y + r.height]} stroke="#333" strokeWidth={1} />
                      <Line points={[r.x + r.width, r.y, r.x + r.width, r.y + r.height]} stroke="#333" strokeWidth={1} />
                    </>
                  ) : (
                    <>
                      <Line points={[r.x, r.y, r.x + r.width, r.y]} stroke="#333" strokeWidth={1} />
                      <Line points={[r.x, r.y + r.height, r.x + r.width, r.y + r.height]} stroke="#333" strokeWidth={1} />
                    </>
                  )}

                  {/* HIGHLIGHT when selected */}
                  {selectedOpeningId === o.id && (
                    <Rect
                      x={r.x - 2}
                      y={r.y - 2}
                      width={r.width + 4}
                      height={r.height + 4}
                      stroke="#3b82f6"
                      dash={[6, 4]}
                      strokeWidth={2}
                      listening={false}
                    />
                  )}

                  {/* door = straight flap; window = cyan strip */}
                  {o.opening_type === 'door' ? (
                    (() => {
                      const [x1, y1, x2, y2] = doorFlapLinePoints(o.side, hingeAtStart, r);
                      return (
                        <Line points={[x1, y1, x2, y2]} stroke="#333" strokeWidth={2} lineCap="round" />
                      );
                    })()
                  ) : (
                    (() => {
                      const len = 0.35;
                      const [a1, a2, a3, a4] = doorFlapLinePoints(o.side, true, r, len);
                      const [b1, b2, b3, b4] = doorFlapLinePoints(o.side, false, r, len);
                      return (
                        <>
                          {/* faint glass fill so it still reads as a window */}
                          <Rect
                            x={r.x} y={r.y}
                            width={r.width} height={r.height}
                            fill="rgba(14,165,233,0.18)"
                            stroke="rgba(14,165,233,0.6)"
                            strokeWidth={1}
                          />
                          {/* two small inward flaps */}
                          <Line points={[a1, a2, a3, a4]} stroke="#333" strokeWidth={1.5} lineCap="round" />
                          <Line points={[b1, b2, b3, b4]} stroke="#333" strokeWidth={1.5} lineCap="round" />
                        </>
                      );
                    })()
                  )}
                </Group>
              );
            })}


            {/* existing items */}
            {placedItems.map(item => {
              const x = item.pos_x * scale;
              const y = item.pos_y * scale;
              const rot = item.rotation ?? 0;

              const W = Math.max(1, Math.round(item.width * scale));
              const H = Math.max(1, Math.round(item.height * scale));
              const color = item.color ?? '#ccc';
              const imgUrl = item.imageUrl ?? (item as any).image_url;

              // normalize shape so 'Rectangle', 'rectangle', 'RECTANGLE' all work
              const shape = (item.shape ?? 'rectangle').toString().toLowerCase();

              const common = {
                id: `item-${item.id}`,
                x, y,
                rotation: rot,
                draggable: true,
                dragBoundFunc: makeDragBound(item, stageWidth, stageHeight, scale),
                onClick: () => setSelectedId(item.id),
                onDragEnd: (e: any) => handleDragEnd(e, item),
              } as const;

              // IMAGE
              if (shape === 'image' && imgUrl) {
                return (
                  <URLImage
                    key={item.id}
                    {...common}
                    url={imgUrl}
                    width={W}
                    height={H}
                  />
                );
              }

              // RECTANGLE
              if (shape === 'rectangle') {
                return (
                  <Rect
                    key={item.id}
                    {...common}
                    width={W}
                    height={H}
                    fill={color}
                    stroke="#444"
                  />
                );
              }

              // CIRCLE
              if (shape === 'circle') {
                return (
                  <Ellipse
                    key={item.id}
                    {...common}
                    x={x + W / 2}
                    y={y + H / 2}
                    radiusX={W / 2}
                    radiusY={H / 2}
                    fill={color}
                    stroke="#444"
                  />
                );
              }

              if (shape === 'triangle') {
                return (
                  <Line
                    key={item.id}
                    {...common}
                    points={[0, H, W / 2, 0, W, H]}
                    closed
                    fill={color}
                    stroke="#444"
                  />
                );
              }

              return (
                <Rect
                  key={item.id}
                  {...common}
                  width={W}
                  height={H}
                  fill="hotpink"
                  stroke="#444"
                />
              );
            })}

            <Transformer ref={trRef} rotateEnabled={true} onTransformEnd={handleTransformEnd} />
          </Layer>

          {/* ghost preview (non-interactive layer) */}
          {ghost && (
            <Layer listening={false}>
              {(() => {
                const r = openingRect(ghost.side, ghost.offset, ghost.length, WALL_THICK, roomW, roomH)!;
                return ghost.type === 'window'
                  ? <Rect x={r.x} y={r.y} width={r.width} height={r.height} fill="rgba(0,180,255,0.2)" stroke="rgba(0,180,255,0.7)" />
                  : <Rect x={r.x} y={r.y} width={r.width} height={r.height} fill="rgba(0,0,0,0.15)" />;
              })()}
            </Layer>
          )}
          <DimensionsOverlay
            scale={scale}
            visible={showDims}                    
            rect={!isL ? { width: template.width, height: template.height } : null}
            polygon={isL ? poly : null}
            unitsPerPixel={1}
            unitLabel="units"
          />
        </Stage>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showDims}
            onChange={(e) => setShowDims(e.target.checked)}
          />
          Show measurements
        </label>
      </div>
      <Modal open={!!oversize} onClose={() => setOversize(null)}>
        <h3 className="text-lg font-semibold">Item is too big</h3>
        <p className="mt-2 text-sm text-gray-700">
          “{oversize?.name}” ({oversize?.width}×{oversize?.height}) doesn’t fit in this room.
          Resize the item or enlarge the room, then try again.
        </p>
      </Modal>
    </div>
  );
}

