// src/presets.ts
export type ItemPreset = {
  key: string;
  label: string;
  shape: 'rectangle' | 'circle' | 'triangle' | 'image';
  width: number;
  height: number;
  color?: string;
  type?: string;       
  notes?: string;     
  imageUrl?: string;   
};

export const PRESETS: ItemPreset[] = [
  {
    key: 'table-rect',
    label: 'Table (Rect)',
    shape: 'rectangle',
    width: 120,
    height: 60,
    color: '#c8a97e',
    type: 'Table',
  },
  {
    key: 'table-round',
    label: 'Table (Round)',
    shape: 'circle',
    width: 100,
    height: 100,
    color: '#d2b48c',
    type: 'Table',
  },
  {
    key: 'chair',
    label: 'Chair',
    shape: 'rectangle',
    width: 40,
    height: 40,
    color: '#8b9dc3',
    type: 'Chair',
  },
  {
    key: 'window-double',
    label: 'Window (Double Flap)',
    shape: 'rectangle', 
    width: 140,
    height: 70,
    color: '#e7f5ff',
    type: 'Window',
    notes: 'double_flap=1',
  },
];
