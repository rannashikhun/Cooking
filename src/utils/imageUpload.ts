export interface CompressImageOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  maxChars?: number;
  squareCrop?: boolean;
}

const IMAGE_FILE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('ছবি পড়া যায়নি'));
      }
    };
    reader.onerror = () => reject(new Error('ছবি পড়া যায়নি'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('অকার্যকর ছবির ফাইল। অনুগ্রহ করে JPG বা PNG ছবি দিন।'));
    img.src = src;
  });
}

export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageOptions
): Promise<string> {
  const isImageMime = Boolean(file.type && file.type.startsWith('image/'));
  const isImageName = Boolean(file.name && IMAGE_FILE_EXT_RE.test(file.name));
  if (!isImageMime && !isImageName) {
    throw new Error('দয়া করে শুধুমাত্র ছবির ফাইল (JPG, PNG, WebP) নির্বাচন করুন।');
  }

  const maxChars = options.maxChars ?? 140000;
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const srcW = img.naturalWidth || options.maxWidth;
  const srcH = img.naturalHeight || options.maxHeight;

  if (
    !options.squareCrop &&
    rawDataUrl.length <= maxChars &&
    srcW <= options.maxWidth &&
    srcH <= options.maxHeight
  ) {
    return rawDataUrl;
  }

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

  let scale = Math.min(
    1,
    options.maxWidth / sw,
    options.maxHeight / sh
  );

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
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

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
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 128, 128);
  const fallback = canvas.toDataURL('image/jpeg', 0.6);
  if (fallback.length > maxChars) {
    throw new Error('ছবির সাইজ অনেক বড়। অনুগ্রহ করে ছোট কোনো ছবি নির্বাচন করুন।');
  }
  return fallback;
}
