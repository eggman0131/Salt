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
  width = 250,
  height = 250,
  borderRadius = 0,
  isCircle = false,
}) => {
  const [image, setImage] = useState<string | File | null>(initialImage || null);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const editorRef = useRef<AvatarEditor>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Debug: log what the editor thinks it has
      const canvas = editorRef.current.getImageScaledToCanvas();
      console.log('Editor canvas dimensions:', canvas.width, 'x', canvas.height);
      console.log('Props width/height:', width, 'x', height);
      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      onSave(imageData);
    } else {
      console.log('Editor ref is null!');
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
      <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-4 overflow-hidden">
        {image ? (
          <AvatarEditor
            ref={editorRef}
            image={image}
            width={width}
            height={height}
            border={30}
            borderRadius={isCircle ? width / 2 : borderRadius}
            color={[0, 0, 0, 0.5]}
            scale={scale}
            rotate={rotate}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-8 border-2 border-dashed rounded-lg" style={{ minHeight: '200px', width: '100%' }}>
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
