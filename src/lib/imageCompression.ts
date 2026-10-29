/**
 * Client-side image compression utility using HTML5 Canvas.
 * Automatically downsamples and compresses high-resolution camera photos
 * before uploading to Supabase storage, preventing storage overflow and 413 errors.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  maxTargetBytes?: number;
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
  reductionPercentage: number;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxDimension = 1920,
    quality = 0.85,
    maxTargetBytes = 1.5 * 1024 * 1024, // 1.5 MB target
  } = options;

  const originalSize = file.size;

  // If not an image or running in an environment without DOM/Canvas, return unchanged
  if (!file.type.startsWith('image/') || typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      compressedFile: file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
      reductionPercentage: 0,
    };
  }

  // If file is already well under max target and not oversized, skip compression
  if (originalSize <= 500 * 1024) {
    return {
      compressedFile: file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
      reductionPercentage: 0,
    };
  }

  return new Promise<CompressionResult>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Downscale if either dimension exceeds maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          compressedFile: file,
          originalSize,
          compressedSize: originalSize,
          wasCompressed: false,
          reductionPercentage: 0,
        });
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output format (prefer image/jpeg for photographic ID cards)
      const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const fileExtension = outputType === 'image/webp' ? '.webp' : '.jpg';
      const cleanName = file.name.replace(/\.[^.]+$/, '') + fileExtension;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              compressedFile: file,
              originalSize,
              compressedSize: originalSize,
              wasCompressed: false,
              reductionPercentage: 0,
            });
            return;
          }

          // If compression resulted in a smaller file or resolved an oversize issue
          if (blob.size < originalSize || originalSize > maxTargetBytes) {
            const compressedFile = new File([blob], cleanName, {
              type: outputType,
              lastModified: Date.now(),
            });

            const reduction = Math.max(0, Math.round(((originalSize - blob.size) / originalSize) * 100));

            resolve({
              compressedFile,
              originalSize,
              compressedSize: blob.size,
              wasCompressed: true,
              reductionPercentage: reduction,
            });
          } else {
            resolve({
              compressedFile: file,
              originalSize,
              compressedSize: originalSize,
              wasCompressed: false,
              reductionPercentage: 0,
            });
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        compressedFile: file,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
        reductionPercentage: 0,
      });
    };

    img.src = objectUrl;
  });
}
