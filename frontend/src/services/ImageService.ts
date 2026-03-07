export class ImageService {
  /**
   * Upload image locally (returns blob URL)
   * When offline, queues base64 data for later sync
   * @param file - File object to upload
   * @param folder - Folder path in storage (e.g., 'inventory', 'stores')
   * @param fileName - Optional custom file name
   * @returns Local blob URL of the image
   */
  static async uploadImage(
    file: File,
    folder: 'inventory' | 'stores' | 'deliveries' | 'profiles',
    fileName?: string
  ): Promise<{ data?: string; error?: any; isOffline?: boolean }> {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return { error: { message: 'File must be an image' } };
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return { error: { message: 'Image size must be less than 5MB' } };
      }

      // Handle offline mode - return local blob URL
      if (!navigator.onLine) {
        const localUrl = URL.createObjectURL(file);
        // Store file data in localStorage for later sync (base64)
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        
        // Store pending upload in localStorage
        const pendingUploads = JSON.parse(localStorage.getItem('pending_image_uploads') || '[]');
        pendingUploads.push({
          id: crypto.randomUUID(),
          localUrl,
          base64Data,
          folder,
          fileName: fileName || `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          fileType: file.type,
          timestamp: Date.now(),
        });
        localStorage.setItem('pending_image_uploads', JSON.stringify(pendingUploads));
        
        return { data: localUrl, isOffline: true };
      }

      // Cloud storage disabled - always use local blob URL
      const localUrl = URL.createObjectURL(file);
      return { data: localUrl, isOffline: true };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Delete image (no-op for local blob URLs)
   */
  static async deleteImage(_imageUrl: string): Promise<{ error?: any }> {
    // Cloud storage disabled - no-op for local blob URLs
    return {};
  }

  /**
   * Resize/compress image before upload (optional optimization)
   */
  static async compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            file.type,
            quality
          );
        };
      };
    });
  }
}
