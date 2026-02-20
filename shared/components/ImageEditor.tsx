import React, { useState, useRef } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Slider } from '../../components/ui/slider';
import { Upload, X, RotateCw } from 'lucide-react';

interface ImageEditorProps {
  initialImage?: string;
  onSave: (imageData: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  borderRadius?: number;
  isCircle?: boolean; // For avatars
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  initialImage,
  onSave,
  onCancel,
  width = 400,
  height = 300,
  borderRadius = 0,
  isCircle = false,
}) => {
  const [image, setImage] = useState<string | File | null>(initialImage || null);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const editorRef = useRef<AvatarEditor>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate responsive dimensions - ensure it fits within container
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  // On mobile: leave room for padding and borders. On desktop: use reasonable max
  const maxWidth = isMobile ? window.innerWidth - 100 : Math.min(width, 550);
  const aspectRatio = height / width;
  const editorWidth = maxWidth;
  const editorHeight = maxWidth * aspectRatio;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          setImage(blob);
        }
      }
    }
  };

  const handleSave = () => {
    if (editorRef.current) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      onSave(imageData);
    }
  };

  const handleRotate = () => {
    setRotate((prev) => (prev + 90) % 360);
  };

  const handleClear = () => {
    setImage(null);
    setScale(1);
    setRotate(0);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4 w-full" onPaste={handlePaste} tabIndex={0}>
      {/* Editor Canvas */}
      <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2 md:p-4 overflow-hidden">
        {image ? (
          <div className="flex items-center justify-center">
            <AvatarEditor
              ref={editorRef}
              image={image}
              width={editorWidth}
              height={editorHeight}
              border={10}
              borderRadius={isCircle ? Math.max(editorWidth, editorHeight) / 2 : borderRadius}
              color={[0, 0, 0, 0.4]}
              scale={scale}
              rotate={rotate}
              className="rounded-lg"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 md:px-8 border-2 border-dashed rounded-lg" style={{ minHeight: isMobile ? '200px' : '300px', width: '100%' }}>
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground text-center">
              Paste an image (Ctrl+V) or upload below
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      {image && (
        <div className="space-y-4">
          {/* Zoom Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Zoom</Label>
              <span className="text-sm text-muted-foreground">{scale.toFixed(2)}x</span>
            </div>
            <Slider
              value={[scale]}
              onValueChange={([value]) => setScale(value)}
              min={0.5}
              max={3}
              step={0.01}
              className="w-full"
            />
          </div>

          {/* Rotate and Clear Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotate}
            >
              <RotateCw className="w-4 h-4 mr-1" />
              Rotate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* File Upload and Action Buttons */}
      <div className="flex flex-col md:flex-row items-stretch gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleUploadClick}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
        {image && (
          <Button onClick={handleSave} className="w-full md:w-auto">
            Save
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="w-full md:w-auto">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
