// client/src/pages/RoomBuilder.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import { Stage, Layer, Rect, Transformer } from 'react-konva';

interface InventoryItem {
  id: number;
  name: string;
  width: number;
  height: number;
  notes?: string;
}
interface PlacedItem {
  id: number;
  name: string;
  width: number;
  height: number;
  pos_x: number;
  pos_y: number;
  notes?: string;
}

export default function RoomBuilder() {
  // grab /rooms/:id
  const { id } = useParams<{ id: string }>();
  const roomId = Number(id);

  // state
  const [room, setRoom] = useState<{ name: string; width: number; height: number } | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // inventory form
  const [invName, setInvName] = useState('');
  const [invWidth, setInvWidth] = useState(1);
  const [invHeight, setInvHeight] = useState(1);

  // drawing scale
  const scale = 20;
  const w = room?.width ?? 10;
  const h = room?.height ?? 10;
  const stageWidth = w * scale;
  const stageHeight = h * scale;

  // refs for Konva
  const layerRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  // fetch just‐inventory helper
  const fetchInventory = () => {
    api.get('/items/inventory')
      .then(res => setInventory(res.data))
      .catch(console.error);
  };

  // on mount / when roomId changes
  useEffect(() => {
    setLoading(true);
    api.get(`/rooms/${roomId}`)
      .then(res => setRoom(res.data))
      .catch(() => setRoom(null))
      .finally(() => setLoading(false));

    fetchInventory();
    api.get(`/items/room/${roomId}`)
      .then(res => setPlacedItems(res.data))
      .catch(console.error);
  }, [roomId]);

  // attach transformer to selected shape
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

  // backspace → delete placed item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && selectedId !== null) {
        api.delete(`/items/${selectedId}`)
          .then(() => {
            setPlacedItems(prev => prev.filter(item => item.id !== selectedId));
            setSelectedId(null);
            if (trRef.current) {
              trRef.current.nodes([]);
              trRef.current.getLayer().batchDraw();
            }
          })
          .catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  // when drag ends, save new coords
  const handleDragEnd = (e: any, item: PlacedItem) => {
    const { x, y } = e.target.position();
    const newX = x / scale;
    const newY = y / scale;
    api.put(`/items/${item.id}`, { ...item, pos_x: newX, pos_y: newY })
      .then(() => {
        setPlacedItems(prev =>
          prev.map(it => (it.id === item.id ? { ...it, pos_x: newX, pos_y: newY } : it))
        );
      })
      .catch(console.error);
  };

  // add inventory item into room
  const addToRoom = (inv: InventoryItem) => {
    api.post('/items', {
      room_id: roomId,
      name: inv.name,
      type: 'Generic',
      pos_x: 0,
      pos_y: 0,
      width: inv.width,
      height: inv.height,
      notes: inv.notes || ''
    })
      .then(res => setPlacedItems(prev => [...prev, res.data]))
      .catch(console.error);
  };

  // create brand‑new inventory item
  const createInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    api.post('/items', {
      room_id: null,
      name: invName,
      type: 'Generic',
      pos_x: 0,
      pos_y: 0,
      width: invWidth,
      height: invHeight,
      notes: ''
    })
      .then(res => {
        setInventory(prev => [...prev, res.data]);
        setInvName('');
        setInvWidth(1);
        setInvHeight(1);
      })
      .catch(console.error);
  };

  // delete an inventory item
  const deleteInventoryItem = (invId: number) => {
    if (!window.confirm('Really delete this inventory item?')) return;
    api.delete(`/items/${invId}`)
      .then(() => {
        setInventory(prev => prev.filter(inv => inv.id !== invId));
      })
      .catch(console.error);
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (!room) return <p className="p-4">Room not found.</p>;

  return (
    <div className="p-4 flex h-full">
      {/* Sidebar */}
      <div className="w-1/4 pr-4 overflow-auto">
        <form onSubmit={createInventoryItem} className="mb-4 flex space-x-2 items-center">
          <input
            type="text"
            placeholder="Name"
            value={invName}
            onChange={e => setInvName(e.target.value)}
            className="flex-none w-20 border px-1 py-1 rounded"
            required
          />
          <input
            type="number"
            placeholder="W"
            value={invWidth}
            onChange={e => setInvWidth(Number(e.target.value))}
            className="flex-none w-8 border px-1 py-1 rounded"
            min={1}
            required
          />
          <input
            type="number"
            placeholder="H"
            value={invHeight}
            onChange={e => setInvHeight(Number(e.target.value))}
            className="flex-none w-8 border px-1 py-1 rounded"
            min={1}
            required
          />
          <button type="submit" className="bg-green-500 text-white px-2 py-1 rounded">
            Add Item
          </button>
        </form>

        <h2 className="text-xl mb-2">Inventory</h2>
        <ul className="space-y-2">
          {inventory.map(inv => (
            <li
              key={inv.id}
              className="p-2 border rounded flex justify-between items-center"
            >
              <span>{inv.name}</span>
              <div className="space-x-1">
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
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto">
        <h1 className="text-2xl mb-4">{room.name}</h1>
        <Stage
          width={stageWidth}
          height={stageHeight}
          style={{ border: '1px solid #ccc' }}
        >
          <Layer ref={layerRef}>
            {/* Room outline */}
            <Rect
              x={0}
              y={0}
              width={stageWidth}
              height={stageHeight}
              stroke="#333"
              strokeWidth={2}
            />

            {/* Placed items */}
            {placedItems.map(item => (
              <Rect
                key={item.id}
                id={`item-${item.id}`}
                x={item.pos_x * scale}
                y={item.pos_y * scale}
                width={item.width * scale}
                height={item.height * scale}
                fill="#888"
                draggable
                onClick={() => setSelectedId(item.id)}
                onDragEnd={e => handleDragEnd(e, item)}
              />
            ))}

            {/* Transformer for resizing/selecting */}
            <Transformer ref={trRef} rotateEnabled={false} />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
