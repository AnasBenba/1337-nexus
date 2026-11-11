import React from 'react';
import type { DrawingTool } from './types';

export interface ToolbarProps {
  currentTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  currentStrokeWidth: number;
  onSelectStrokeWidth: (width: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onExport?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const PALETTE = [
  '#000000', // Black
  '#2563EB', // Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
  '#F59E0B', // Amber
  '#64748B', // Slate
];

const STROKE_WIDTHS = [2, 4, 8, 14];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  currentColor,
  onSelectColor,
  currentStrokeWidth,
  onSelectStrokeWidth,
  onUndo,
  onRedo,
  onClear,
  onExport,
  canUndo = false,
  canRedo = false,
}) => {
  const tools: { id: DrawingTool; label: string; icon: string }[] = [
    { id: 'select', label: 'Select / Pan', icon: 'pan_tool' },
    { id: 'pen', label: 'Freehand Pen', icon: 'draw' },
    { id: 'rect', label: 'Rectangle', icon: 'rectangle' },
    { id: 'circle', label: 'Circle', icon: 'circle' },
    { id: 'arrow', label: 'Arrow', icon: 'trending_flat' },
    { id: 'text', label: 'Text Note', icon: 'text_fields' },
    { id: 'eraser', label: 'Eraser', icon: 'ink_eraser' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
      {/* Tool Selector */}
      <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onSelectTool(t.id)}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
              currentTool === t.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">{t.icon}</span>
          </button>
        ))}
      </div>

      {/* Color Palette */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-container rounded-xl">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelectColor(color)}
            title={color}
            style={{ backgroundColor: color }}
            className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
              currentColor === color ? 'border-primary scale-110 shadow-sm' : 'border-transparent hover:scale-105'
            }`}
          />
        ))}
        <input
          type="color"
          value={currentColor}
          onChange={(e) => onSelectColor(e.target.value)}
          title="Custom Color"
          className="w-6 h-6 rounded-full overflow-hidden border-0 p-0 cursor-pointer bg-transparent"
        />
      </div>

      {/* Stroke Width Selector */}
      <div className="flex items-center gap-1 px-2 py-1 bg-surface-container rounded-xl">
        {STROKE_WIDTHS.map((width) => (
          <button
            key={width}
            type="button"
            onClick={() => onSelectStrokeWidth(width)}
            className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
              currentStrokeWidth === width
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {width}px
          </button>
        ))}
      </div>

      {/* Action Buttons: Undo, Redo, Clear, Export */}
      <div className="flex items-center gap-1">
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">undo</span>
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">redo</span>
          </button>
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            title="Clear Board"
            className="p-2 rounded-xl text-error hover:bg-error-container hover:text-on-error-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            title="Export PNG"
            className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
          </button>
        )}
      </div>
    </div>
  );
};

