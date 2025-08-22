// src/components/roomTemplates.ts
import api from '../api/api';

/** ---------- Types ---------- */
export type RawTemplate = {
  id: number;
  name: string;
  width: number;
  height: number;
  shape_type?: string | null;              // optional; many backends won't have this
  outline?: [number, number][] | string | null;
  notes?: string | null;                   // always safe to use
};

export type RoomTemplate = {
  id: number;
  name: string;
  width: number;
  height: number;
  shape: 'rectangle' | 'l';
  outline: [number, number][] | null;
};

export type CreateTemplateInput = {
  name: string;
  width: number;
  height: number;
  kind: 'rectangle' | 'l';
  notchW?: number;
  notchH?: number;
  corner?: 'tl' | 'tr' | 'bl' | 'br';
};

/** ---------- Geometry ---------- */
export function buildLOutline(
  W: number, H: number,
  notchW: number, notchH: number,
  corner: 'tl'|'tr'|'bl'|'br' = 'tl'
): [number, number][] {
  switch (corner) {
    case 'tl': return [[0,0],[W,0],[W,H],[notchW,H],[notchW,notchH],[0,notchH]];
    case 'tr': return [[0,0],[W,0],[W,notchH],[W,H],[0,H],[0,notchH]];
    case 'bl': return [[0,0],[W,0],[W,H],[0,H],[0,H - notchH],[notchW,H - notchH]];
    case 'br': return [[0,0],[W,0],[W,H - notchH],[W - notchW,H - notchH],[W - notchW,H],[0,H]];
  }
}

/** ---------- Parsing (supports columns or notes) ---------- */
export function parseTemplate(raw: RawTemplate): RoomTemplate {
  const st = raw.shape_type?.toString().toLowerCase?.();
  if (st === 'l') {
    let outline: [number, number][] | null = null;
    if (Array.isArray(raw.outline)) outline = raw.outline as [number, number][];
    else if (typeof raw.outline === 'string') { try { outline = JSON.parse(raw.outline); } catch {} }
    return { id: raw.id, name: raw.name, width: raw.width, height: raw.height, shape: 'l', outline };
  }
  if (st === 'rectangle') {
    return { id: raw.id, name: raw.name, width: raw.width, height: raw.height, shape: 'rectangle', outline: null };
  }
  // Fallback to notes JSON
  if (raw.notes) {
    try {
      const j = JSON.parse(raw.notes);
      if (j?.shape_type === 'l' && Array.isArray(j.outline)) {
        return { id: raw.id, name: raw.name, width: raw.width, height: raw.height, shape: 'l', outline: j.outline };
      }
    } catch {}
  }
  return { id: raw.id, name: raw.name, width: raw.width, height: raw.height, shape: 'rectangle', outline: null };
}

/** ---------- API helpers ---------- */
export async function createTemplateWithNotes(input: CreateTemplateInput): Promise<RoomTemplate> {
  const { name, width, height, kind, notchW, notchH, corner } = input;
  const outline = kind === 'l' ? buildLOutline(width, height, notchW ?? 40, notchH ?? 40, corner ?? 'tl') : null;
  const notes = kind === 'l'
    ? JSON.stringify({ shape_type: 'l', outline })
    : JSON.stringify({ shape_type: 'rectangle' });
  const { data } = await api.post<RawTemplate>('/templates', { name, width, height, notes });
  return parseTemplate(data);
}

export async function listTemplatesAuto(): Promise<RoomTemplate[]> {
  const { data } = await api.get<RawTemplate[]>('/templates');
  return data.map(parseTemplate);
}
