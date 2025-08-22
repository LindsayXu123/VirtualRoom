import React from 'react';
import { Rect, Line } from 'react-konva';
import type { RoomTemplate } from './roomTemplates';

export default function RoomTemplateNode({
  tpl,
  stroke = '#343a40',
  fill = '#f8f9fa',
  strokeWidth = 2,
}: {
  tpl: RoomTemplate;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}) {
  if (tpl.shape === 'l') {
    const outline = Array.isArray(tpl.outline) ? tpl.outline : null;
    if (outline && outline.length >= 3) {
      const pts = outline.flat().filter(n => Number.isFinite(n)) as number[];
      if (pts.length >= 6) {
        return <Line points={pts} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
      }
    }
  }
  return <Rect width={tpl.width ?? 0} height={tpl.height ?? 0} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}
