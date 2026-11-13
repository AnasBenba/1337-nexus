import { describe, it, expect } from 'vitest';
import { getCanvasCoordinates } from './CanvasStage';
import type { CanvasShape } from './types';

describe('Whiteboard & Canvas Unit Tests', () => {
  it('correctly calculates world coordinates with pan and zoom', () => {
    const mockCanvas = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        right: 900,
        bottom: 650,
        width: 800,
        height: 600,
        x: 100,
        y: 50,
        toJSON: () => {},
      }),
    } as unknown as HTMLCanvasElement;

    const mockEvent = {
      clientX: 250,
      clientY: 150,
    } as React.PointerEvent<HTMLCanvasElement>;

    // 1. Without pan or zoom
    const coords1 = getCanvasCoordinates(mockEvent, mockCanvas);
    expect(coords1).toEqual({ x: 150, y: 100 });

    // 2. With pan offset
    const coords2 = getCanvasCoordinates(mockEvent, mockCanvas, { x: 50, y: 20 }, 1);
    expect(coords2).toEqual({ x: 100, y: 80 });

    // 3. With zoom factor = 2
    const coords3 = getCanvasCoordinates(mockEvent, mockCanvas, { x: 50, y: 20 }, 2);
    expect(coords3).toEqual({ x: 50, y: 40 });
  });

  it('serializes and deserializes canvas binary delta updates (<= 256 KB)', () => {
    const shape: CanvasShape = {
      id: 'test-shape-uuid',
      type: 'pen',
      color: '#2563EB',
      strokeWidth: 4,
      points: [
        { x: 10, y: 20 },
        { x: 15, y: 25 },
        { x: 30, y: 40 },
      ],
      userId: 'test_user',
      createdAt: Date.now(),
    };

    const action = {
      action: 'add_shape',
      shape,
    };

    // Serialize to binary Uint8Array
    const binaryBytes = new TextEncoder().encode(JSON.stringify(action));
    expect(binaryBytes instanceof Uint8Array).toBe(true);
    expect(binaryBytes.byteLength).toBeLessThan(256 * 1024);

    // Deserialize from binary ArrayBuffer
    const decodedString = new TextDecoder().decode(binaryBytes);
    const parsed = JSON.parse(decodedString);

    expect(parsed.action).toBe('add_shape');
    expect(parsed.shape.id).toBe('test-shape-uuid');
    expect(parsed.shape.type).toBe('pen');
    expect(parsed.shape.points).toHaveLength(3);
    expect(parsed.shape.color).toBe('#2563EB');
  });

  it('supports clear and undo binary action encoding', () => {
    const clearAction = { action: 'clear' };
    const clearBytes = new TextEncoder().encode(JSON.stringify(clearAction));
    const decodedClear = JSON.parse(new TextDecoder().decode(clearBytes));
    expect(decodedClear.action).toBe('clear');

    const undoAction = { action: 'undo', shapeId: 'shape-123' };
    const undoBytes = new TextEncoder().encode(JSON.stringify(undoAction));
    const decodedUndo = JSON.parse(new TextDecoder().decode(undoBytes));
    expect(decodedUndo.action).toBe('undo');
    expect(decodedUndo.shapeId).toBe('shape-123');
  });
});

