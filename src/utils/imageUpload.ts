export interface CompressImageOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  maxChars?: number;
  squareCrop?: boolean;
}

const NON_IMAGE_MIME_PREFIXES = ['video/', 'audio/', 'text/', 'application/'];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('ছবি পড়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'));
      }
    };
    reader.onerror = () => reject(new Error('ছবি পড়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('ছবিটি ওপেন করা যায়নি। অনুগ্রহ করে JPG, PNG বা WebP ছবি নির্বাচন করুন।'));
    img.src = src;
  });
}

interface DecodedImageSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decodeImageFile(file: File): Promise<DecodedImageSource> {
  // 1. Prefer createImageBitmap (fast, low-memory on mobile, respects EXIF orientation)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => {
            try {
              bitmap.close();
            } catch {
              // Ignore cleanup errors
            }
          },
        };
      }
      bitmap.close();
    } catch {
      // Fall back to Object URL / FileReader below
    }
  }

  // 2. Use Object URL (avoids multi-MB base64 memory spike on mobile camera photos)
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImageElement(objectUrl);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width > 0 && height > 0) {
        return {
          source: img,
          width,
          height,
          cleanup: () => URL.revokeObjectURL(objectUrl),
        };
      }
      URL.revokeObjectURL(objectUrl);
    } catch {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // 3. Final fallback: FileReader Data URL
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  return {
    source: img,
    width: img.naturalWidth || img.width || 360,
    height: img.naturalHeight || img.height || 360,
    cleanup: () => {},
  };
}

export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageOptions
): Promise<string> {
  const mime = (file.type || '').toLowerCase();
  if (mime && NON_IMAGE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new Error('দয়া করে শুধুমাত্র ছবির ফাইল (JPG, PNG, WebP) নির্বাচন করুন।');
  }

  const maxChars = options.maxChars ?? 140000;
  const decoded = await decodeImageFile(file);

  try {
    const srcW = decoded.width || options.maxWidth;
    const srcH = decoded.height || options.maxHeight;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ছবি প্রসেস করা যায়নি।');
    }

    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (options.squareCrop) {
      const side = Math.min(srcW, srcH);
      sx = Math.max(0, Math.floor((srcW - side) / 2));
      sy = Math.max(0, Math.floor((srcH - side) / 2));
      sw = side;
      sh = side;
    }

    let scale = Math.min(1, options.maxWidth / sw, options.maxHeight / sh);
    let quality = options.quality ?? 0.84;
    let bestOutput = '';

    for (let attempt = 0; attempt < 12; attempt++) {
      const width = Math.max(64, Math.round(sw * scale));
      const height = Math.max(64, Math.round(sh * scale));

      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, width, height);

      const webpOutput = canvas.toDataURL('image/webp', quality);
      const jpegOutput = canvas.toDataURL('image/jpeg', quality);
      const output =
        webpOutput.startsWith('data:image/webp') && webpOutput.length <= jpegOutput.length
          ? webpOutput
          : jpegOutput;

      bestOutput = output;
      if (output.length <= maxChars) {
        return output;
      }

      scale *= 0.82;
      quality = Math.max(0.45, quality - 0.06);
    }

    if (bestOutput && bestOutput.length <= maxChars) {
      return bestOutput;
    }

    // Final strict size fallback (128px)
    canvas.width = 128;
    canvas.height = 128;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 128, 128);
    ctx.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, 128, 128);
    const fallback = canvas.toDataURL('image/jpeg', 0.6);
    if (fallback.length > maxChars) {
      throw new Error('ছবির সাইজ অনেক বড়। অনুগ্রহ করে ছোট কোনো ছবি নির্বাচন করুন।');
    }
    return fallback;
  } finally {
    decoded.cleanup();
  }
}
