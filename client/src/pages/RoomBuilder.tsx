// client/src/pages/RoomBuilder.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import { Stage, Layer, Rect, Line, Circle, Image as KImage, Transformer } from 'react-konva';

function URLImage({ url, ...props }: { url: string } & Omit<React.ComponentProps<typeof KImage>, 'image'>) {
  const imgRef = useRef<HTMLImageElement>(new window.Image());
  useEffect(() => {
    imgRef.current.src = url;
  }, [url]);
  return <KImage {...props} image={imgRef.current} />;
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

  // Canvas sizing
  const scale = 20;
  const stageWidth = template.width * scale;
  const stageHeight = template.height * scale;

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

  // Persist template changes
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

  if (loading) return <p className="p-4">Loading...</p>;
  if (!room) return <p className="p-4">Room not found.</p>;

  return (
    <div className="p-4 flex h-full">
      {/* Sidebar */}
      <div className="w-1/4 pr-4 overflow-auto">
        {/* Room Template Form */}
        <form onSubmit={handleTemplateSubmit} className="mb-4 border p-3 rounded space-y-2">
          <h3 className="font-semibold">Room Template</h3>
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
            Apply
          </button>
        </form>

        {/* Inventory Form */}

        <form onSubmit={createInventoryItem} className="mb-4 flex space-x-2 items-center">
          <div className="flex space-x-2">
            <input
              type="text" placeholder="Name" value={invName}
              onChange={e => setInvName(e.target.value)}
              className="w-24 border px-1 py-1 rounded" required
            />
            <input
              type="number" placeholder="W" value={invWidth}
              onChange={e => setInvWidth(+e.target.value)}
              className="w-12 border px-1 py-1 rounded" min={1} max={50} required
            />
            <input
              type="number" placeholder="H" value={invHeight}
              onChange={e => setInvHeight(+e.target.value)}
              className="w-12 border px-1 py-1 rounded" min={1} max={50} required
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
            Add Item
          </button>
        </form>

        {/* Inventory List */}
        <h2 className="text-lg mb-2">Inventory</h2>
        <ul className="space-y-2">
          {inventory.map(inv => (
            <li key={inv.id} className="p-2 border rounded flex justify-between items-center">
              <span>{inv.name}</span>
              <div className="flex space-x-1">
                <button
                  onClick={() => addToRoom(inv)}
                  className="bg-blue-500 text-white px-2 py-1 rounded"
                >
                  Add
                </button>
                <button
                  onClick={() => deleteInventoryItem(inv.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

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
      <div className="flex-1 overflow-auto">
        <h1 className="text-2xl mb-4">{room.name}</h1>
        <Stage width={stageWidth} height={stageHeight} style={{ border: '1px solid #ccc' }}>
          <Layer ref={layerRef}>
            {template.type === 'rectangle' ? (
              <Rect x={0} y={0} width={stageWidth} height={stageHeight} stroke="#333" strokeWidth={2} />
            ) : (
              <Line points={computeLShape()} closed stroke="#333" strokeWidth={2} />
            )}
            {placedItems.map(item => {
              const x = item.pos_x * scale;
              const y = item.pos_y * scale;
              const rot = item.rotation;
              // if this item has an image URL, render it
              if (item.shape === 'image' && item.imageUrl) {
                return (
                  <URLImage
                    key={item.id}
                    id={`item-${item.id}`}
                    url={item.imageUrl}
                    x={x}
                    y={y}
                    width={item.width * scale}
                    height={item.height * scale}
                    rotation={rot}
                    draggable
                    onClick={() => setSelectedId(item.id)}
                    onDragEnd={(e: any) => handleDragEnd(e, item)}
                  />
                );
              }
              // otherwise fall back to a colored rectangle
              return (
                <Rect
                  key={item.id}
                  id={`item-${item.id}`}
                  x={x}
                  y={y}
                  width={item.width * scale}
                  height={item.height * scale}
                  fill={item.color}
                  rotation={rot}
                  draggable
                  onClick={() => setSelectedId(item.id)}
                  onDragEnd={e => handleDragEnd(e, item)}
                />
              );
            })}
            <Transformer ref={trRef} rotateEnabled={true} onTransformEnd={handleTransformEnd} />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

