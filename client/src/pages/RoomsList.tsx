// client/src/pages/RoomsList.tsx
import { useEffect, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';

interface Room {
  id: number;
  name: string;
}

export default function RoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Room[]>('/rooms');
      setRooms(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/rooms', { name: newName, width: 10, height: 10, shape_data: {} });
      setNewName('');
      fetchRooms();
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/rooms/${id}`);
      fetchRooms();
    } catch (err: any) {
      setError(err.message || 'Failed to delete room');
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (room: Room) => {
    setEditingId(room.id);
    setEditingName(room.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEditing = async () => {
    if (editingId === null || !editingName.trim()) return;
    setEditingLoading(true);
    try {
      await api.put(`/rooms/${editingId}`, { name: editingName });
      setEditingId(null);
      setEditingName('');
      fetchRooms();
    } catch (err: any) {
      setError(err.message || 'Failed to update room name');
    } finally {
      setEditingLoading(false);
    }
  };

  if (loading) return <p className="p-4">Loading rooms…</p>;
  if (error)   return <p className="p-4 text-red-500">Error: {error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Your Rooms</h1>

      {/* Create new room */}
      <form onSubmit={handleCreate} className="mb-6 flex space-x-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New room name"
          className="flex-1 border px-3 py-2 rounded"
          disabled={submitting}
        />
        <button
          type="submit"
          className="bg-green-500 text-white px-4 rounded"
          disabled={submitting}
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </form>

      {/* Room list */}
      {rooms.length === 0 ? (
        <p>No rooms yet.</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map(room => {
            const isEditing = editingId === room.id;
            return (
              <li
                key={room.id}
                className="p-2 border rounded hover:bg-gray-50 flex items-center justify-between"
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
                    className="flex-1 border px-2 py-1 rounded mr-2"
                    disabled={editingLoading}
                  />
                ) : (
                  <Link
                    to={`/rooms/${room.id}`}
                    className="text-blue-600 hover:underline flex-1"
                  >
                    {room.name}
                  </Link>
                )}

                <div className="flex space-x-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEditing}
                        disabled={editingLoading}
                        className="text-white bg-blue-500 px-2 py-1 rounded hover:bg-blue-600"
                      >
                        {editingLoading ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={editingLoading}
                        className="px-2 py-1 border rounded hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditing(room)}
                        className="px-2 py-1 border rounded hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        disabled={deletingId === room.id}
                        className="text-red-600 px-2 py-1 rounded border hover:bg-red-100"
                      >
                        {deletingId === room.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
