/**
 * Safe image download — iOS Safari compatible, non-blocking.
 *
 * iOS Safari problems:
 * 1. <a href="data:image/png;base64,..."> → navigates to URL, page dies
 * 2. <a href="blob:..."> + click() → WebKitBlobResource error, page dies
 * 3. navigator.share() blocks main thread if awaited → pipeline stalls
 *
 * Solution for iOS: Fire-and-forget navigator.share() (don't await).
 * The share sheet opens as an overlay — JS continues running underneath.
 * If share unavailable: open blob in new tab via iframe trick.
 */

const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const base64ToBlob = (base64: string, type = 'image/png'): Blob => {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type });
};

/**
 * iOS download: non-blocking share sheet.
 * Returns true if share was initiated (not awaited — fire and forget).
 */
const iosDownload = (blob: Blob, filename: string): boolean => {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Fire and forget — do NOT await. Share sheet opens as overlay,
      // JS keeps running. User saves from share sheet.
      navigator.share({ files: [file] }).catch(() => {
        // User cancelled or share failed — silently ignore
      });
      return true;
    }
  } catch {
    // canShare not supported
  }

  // Fallback: open image in new tab via anchor with target=_blank
  // User can long-press → "Save Image" from there
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    // Don't set download attr on iOS — it triggers the blob navigation bug
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    return false;
  }
};

/**
 * Desktop/Android download via blob URL.
 */
const standardDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};

/**
 * Download a base64 image safely on any platform.
 * Non-blocking on iOS — won't interrupt running pipelines.
 */
export const downloadBase64Image = (base64: string, filename: string): void => {
  try {
    const blob = base64ToBlob(base64);

    if (isIOS()) {
      iosDownload(blob, filename);
      return;
    }

    // Android with share support
    if (/Android/i.test(navigator.userAgent)) {
      try {
        const file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file] }).catch(() => {});
          return;
        }
      } catch {
        // fall through to standard download
      }
    }

    standardDownload(blob, filename);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

/**
 * Download multiple images with staggered timing.
 */
export const downloadMultipleImages = async (
  items: Array<{ base64: string; filename: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  for (let i = 0; i < items.length; i++) {
    downloadBase64Image(items[i].base64, items[i].filename);
    onProgress?.(i + 1, items.length);
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
};
