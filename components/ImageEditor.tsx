
import React, { useState, useRef } from 'react';
import { Button, Label } from './UI';

interface ImageEditorProps {
  initialImage?: string;
  onSave: (imageData: string) => void;
  onCancel?: () => void;
  aspectRatio?: number; // width / height (ignored if width/height are provided)
  width?: number;
  height?: number;
  isCircle?: boolean;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ 
  initialImage, 
  onSave, 
  onCancel,
  aspectRatio: propAspectRatio,
  width,
  height,
  isCircle = false,
}) => {
  // Calculate aspect ratio from width/height if provided, else use prop, else default
  const aspectRatio = (width && height) ? width / height : (propAspectRatio ?? 4/3);
  const outputWidth = width ?? 600;
  const outputHeight = height ?? Math.round(outputWidth / aspectRatio);
  
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
      const container = containerRef.current!;
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      
      // Set output canvas size
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      
      // Fill background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Calculate scale factor between display and output
      const scaleX = outputWidth / containerWidth;
      const scaleY = outputHeight / containerHeight;
      
      // Calculate the base image scale to fit container width
      const baseScale = containerWidth / img.width;
      const displayWidth = img.width * baseScale * zoom;
      const displayHeight = img.height * baseScale * zoom;
      
      // Calculate position in display coordinates (centered + user offset)
      const displayX = (containerWidth - displayWidth) / 2 + position.x;
      const displayY = (containerHeight - displayHeight) / 2 + position.y;
      
      // Scale to output coordinates
      const drawX = displayX * scaleX;
      const drawY = displayY * scaleY;
      const drawWidth = displayWidth * scaleX;
      const drawHeight = displayHeight * scaleY;
      
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      
      // If circle, apply circular mask
      if (isCircle) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(outputWidth / 2, outputHeight / 2, Math.min(outputWidth, outputHeight) / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      onSave(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = image;
  };

  // Determine container aspect class
  const aspectClass = aspectRatio === 1 ? 'aspect-square' : 'aspect-4/3';

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      <div 
        ref={containerRef}
        className={`relative w-full ${aspectClass} bg-gray-50 border border-gray-100 rounded-lg overflow-hidden cursor-move flex items-center justify-center shadow-inner ${isCircle ? 'rounded-full' : ''}`}
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
              width: '100%',
            }} 
            className="transition-transform duration-75"
          />
        ) : (
          <div className="text-center p-8 bg-white rounded-lg border border-dashed border-gray-200">
            <p className="text-sm text-gray-400 font-medium italic font-sans">Paste (Ctrl+V) or upload below</p>
          </div>
        )}
        {/* Circle overlay for visual feedback */}
        {isCircle && image && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.5) 50%)',
            }}
          />
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded">
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
