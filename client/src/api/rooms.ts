// client/src/api/rooms.ts
import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:5000/api' });
export function getAllRooms() {
  return api.get('/rooms');
}
export function getRoomById(id: number) {
  return api.get(`/rooms/${id}`);
}
