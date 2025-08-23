// client/src/types/openings.ts
import api from '../api/api';

export type Side = 'N'|'E'|'S'|'W';
export type OpeningKind = 'door'|'window';

export interface Opening {
  id: number;
  room_id: number;
  opening_type: OpeningKind;
  side: Side;
  offset_px: number;
  length_px: number;
  thickness_px: number;
  swing?: 'in-left'|'in-right'|'out-left'|'out-right'|null;
}

export const fetchOpenings = (roomId: number) =>
  api.get<Opening[]>(`/rooms/${roomId}/openings`).then(r => r.data);

export const createOpening = (roomId: number, payload: Omit<Opening,'id'|'room_id'> & { roomWidth:number; roomHeight:number }) =>
  api.post<Opening>(`/rooms/${roomId}/openings`, payload).then(r => r.data);

export const updateOpening = (id: number, payload: Partial<Opening> & { roomId:number; roomWidth:number; roomHeight:number }) =>
  api.put<Opening>(`/openings/${id}`, payload).then(r => r.data);

export const deleteOpening = (id: number) =>
  api.delete(`/openings/${id}`);
