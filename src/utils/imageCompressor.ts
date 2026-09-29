/**
 * Utility to compress and resize images (logo/letterhead) on the client side
 * before saving to IndexedDB / Firestore to avoid exceeding document size limits (1MB).
 */
export async function compressImage(
  base64OrFile: string,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    // If it is not a base64 image data URL or is an SVG, return as is
    if (
      !base64OrFile ||
      !base64OrFile.startsWith('data:image') ||
      base64OrFile.includes('image/svg+xml')
    ) {
      resolve(base64OrFile);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while preserving aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64OrFile);
          return;
        }

        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG data URL
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      } catch (err) {
        console.warn('[ImageCompressor] Error resizing image on canvas, returning original:', err);
        resolve(base64OrFile);
      }
    };

    img.onerror = (err) => {
      console.warn('[ImageCompressor] Error loading image for compression, returning original:', err);
      resolve(base64OrFile);
    };

    img.src = base64OrFile;
  });
}
