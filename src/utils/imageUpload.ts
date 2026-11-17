export interface CompressImageOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  maxChars?: number;
}

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
    img.onerror = () => reject(new Error('অকার্যকর ছবির ফাইল'));
    img.src = src;
  });
}

export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageOptions
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('দয়া করে শুধুমাত্র ছবির ফাইল (JPG, PNG, WebP) নির্বাচন করুন।');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (rawDataUrl.length <= (options.maxChars ?? 220000)) {
    const imgCheck = await loadImage(rawDataUrl);
    if (
      imgCheck.naturalWidth <= options.maxWidth &&
      imgCheck.naturalHeight <= options.maxHeight
    ) {
      return rawDataUrl;
    }
  }

  const img = await loadImage(rawDataUrl);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ছবি প্রসেস করা যায়নি।');
  }

  let scale = Math.min(
    1,
    options.maxWidth / (img.naturalWidth || options.maxWidth),
    options.maxHeight / (img.naturalHeight || options.maxHeight)
  );

  let quality = options.quality ?? 0.85;
  const maxChars = options.maxChars ?? 200000;

  for (let attempt = 0; attempt < 6; attempt++) {
    const width = Math.max(1, Math.round((img.naturalWidth || options.maxWidth) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || options.maxHeight) * scale));

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const webpOutput = canvas.toDataURL('image/webp', quality);
    const jpegOutput = canvas.toDataURL('image/jpeg', quality);
    const output =
      webpOutput.startsWith('data:image/webp') && webpOutput.length <= jpegOutput.length
        ? webpOutput
        : jpegOutput;

    if (output.length <= maxChars) {
      return output;
    }

    scale *= 0.88;
    quality = Math.max(0.62, quality - 0.05);
  }

  const finalWebp = canvas.toDataURL('image/webp', 0.65);
  return finalWebp.startsWith('data:image/webp')
    ? finalWebp
    : canvas.toDataURL('image/jpeg', 0.68);
}
