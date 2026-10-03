/** Compress a data-URL image via canvas for storage / PDF branding */
export function compressImageBase64(
  base64Str: string,
  maxWidth: number = 2000,
  quality: number = 0.92
): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (!base64Str || !base64Str.startsWith("data:image")) {
        resolve(base64Str);
        return;
      }
      const isPng = base64Str.startsWith("data:image/png");
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          if (!isPng) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = isPng ? "image/png" : "image/jpeg";
          const compressed = canvas.toDataURL(mimeType, quality);
          resolve(compressed);
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
      img.src = base64Str;
    } catch (e) {
      console.error("Error compressing image:", e);
      resolve(base64Str);
    }
  });
}
