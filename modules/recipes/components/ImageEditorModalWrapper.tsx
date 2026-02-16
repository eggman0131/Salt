import React from 'react';
import { Card } from '../../../components/UI';
import { ImageEditor } from '../../../components/ImageEditor';

interface ImageEditorModalWrapperProps {
  onSave: (imageData: string) => void;
  onCancel: () => void;
}

export const ImageEditorModalWrapper: React.FC<ImageEditorModalWrapperProps> = ({
  onSave,
  onCancel,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
      onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <Card className="w-full max-w-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <ImageEditor 
          onSave={onSave}
          onCancel={onCancel}
        />
      </Card>
    </div>
  );
};
