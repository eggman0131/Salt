
import React, { useState, useRef } from 'react';
import { Button, Label } from './UI';

interface ImageEditorProps {
  initialImage?: string;
  onSave: (imageData: string) => void;
  onCancel?: () => void;
  aspectRatio?: number; // width / height
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ 
  initialImage, 
  onSave, 
  onCancel,
  aspectRatio = 4/3 
}) => {
  const [image, setImage] = useState<string | null>(initialImage || null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items) as DataTransferItem[]) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => setImage(event.target?.result as string);
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const captureCrop = () => {
    if (!image || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Optimized for minimal but decent quality: 600px width is sufficient for 4:3
      canvas.width = 600;
      canvas.height = 600 / aspectRatio;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const drawWidth = canvas.width * zoom;
      const drawHeight = (img.height / img.width) * drawWidth;
      const drawX = position.x + (canvas.width - drawWidth) / 2;
      const drawY = position.y + (canvas.height - drawHeight) / 2;
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      // Quality 0.7 is the sweet spot for "minimal decent" JPEG
      onSave(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = image;
  };

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      <div 
        ref={containerRef}
        className="relative w-full aspect-[4/3] bg-gray-50 border border-gray-100 rounded-lg overflow-hidden cursor-move flex items-center justify-center shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {image ? (
          <img 
            src={image} 
            alt="Preview" 
            draggable={false}
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              maxWidth: 'none',
              maxHeight: '100%'
            }} 
            className="transition-transform duration-75"
          />
        ) : (
          <div className="text-center p-8 bg-white rounded-lg border border-dashed border-gray-200">
            <p className="text-sm text-gray-400 font-medium italic font-sans">Paste (Ctrl+V) or upload below</p>
          </div>
        )}
      </div>
      {image && (
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-4 w-full">
            <Label className="mb-0 whitespace-nowrap">Zoom</Label>
            <input 
              type="range" min="0.5" max="3" step="0.01" value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-[#2563eb] h-10"
            />
          </div>
          <Button variant="primary" fullWidth className="sm:w-auto text-[10px] uppercase font-bold py-1 px-3 h-11" onClick={captureCrop}>Save Crop</Button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-base text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 font-sans" />
        <div className="flex gap-2 w-full sm:w-auto">
          {onCancel && <Button variant="secondary" className="text-sm h-11" onClick={onCancel}>Cancel</Button>}
          {image && <Button variant="ghost" className="text-sm text-red-500 font-bold h-11" onClick={() => setImage(null)}>Clear</Button>}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
