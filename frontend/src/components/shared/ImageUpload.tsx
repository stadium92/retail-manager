import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageService } from '@/services/ImageService';
import { Upload, X, Image as ImageIcon, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved?: () => void;
  folder: 'inventory' | 'stores' | 'deliveries' | 'profiles';
  maxSize?: number; // in MB
  compress?: boolean;
  className?: string;
}

export function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  folder,
  maxSize = 5,
  compress = true,
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Image must be less than ${maxSize}MB`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Compress image if enabled
      const fileToUpload = compress 
        ? await ImageService.compressImage(file)
        : file;

      // Upload image (handles offline automatically)
      const { data: imageUrl, error, isOffline: wasOffline } = await ImageService.uploadImage(
        fileToUpload,
        folder
      );

      if (error) {
        throw error;
      }

      if (imageUrl) {
        setPreview(imageUrl);
        onImageUploaded(imageUrl);
        toast({
          title: wasOffline ? 'Image saved locally' : 'Success',
          description: wasOffline 
            ? 'Image will be uploaded when back online' 
            : 'Image uploaded successfully',
        });
      }
    } catch (error: any) {
      // Handle offline gracefully - create local blob URL
      if (!navigator.onLine || error?.message?.includes('Load failed')) {
        const localUrl = URL.createObjectURL(file);
        setPreview(localUrl);
        onImageUploaded(localUrl);
        toast({
          title: 'Image saved locally',
          description: 'Image will be uploaded when back online',
        });
      } else {
        toast({
          title: 'Upload failed',
          description: error.message || 'Failed to upload image',
          variant: 'destructive',
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (currentImageUrl) {
      // Delete from storage
      await ImageService.deleteImage(currentImageUrl);
    }
    setPreview(null);
    onImageRemoved?.();
    toast({
      title: 'Image removed',
      description: 'Image has been deleted',
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="h-32 w-32 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            No image uploaded
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : preview ? 'Change Image' : 'Upload Image'}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRemove}
            disabled={uploading}
          >
            <X className="h-4 w-4 mr-2" />
            Remove
          </Button>
        )}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
