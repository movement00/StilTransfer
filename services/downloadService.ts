/**
 * Safe image download utility — iOS Safari compatible.
 *
 * Problems solved:
 * 1. data:image URLs → crash (page navigates to megabyte string)
 * 2. Blob URL + <a>.click() → WebKitBlobResource error on iOS Safari
 *    (Safari tries to navigate to blob URL, page unloads, JS dies)
 * 3. Bulk downloads → browser blocks simultaneous downloads
 *
 * Strategy:
 * - iOS/iPadOS: Use navigator.share() → native share sheet → "Save Image"
 * - Android: Use navigator.share() if available, else blob download
 * - Desktop: Blob URL download (works fine on Chrome/Firefox/Edge)
 */

const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isMobile = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return isIOS() || /Android/i.test(navigator.userAgent);
};

const base64ToBlob = (base64: string, type = 'image/png'): Blob => {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type });
};

const shareFile = async (blob: Blob, filename: string): Promise<boolean> => {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return true;
    }
  } catch (err: any) {
    // User cancelled share → not an error, just return false
    if (err.name === 'AbortError') return true;
    console.warn('Share failed, falling back:', err);
  }
  return false;
};

const desktopDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Use target=_blank as extra safety against page navigation
  link.target = '_blank';
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};

export const downloadBase64Image = async (base64: string, filename: string): Promise<void> => {
  try {
    const blob = base64ToBlob(base64);

    // iOS: Always use share API (blob download crashes Safari)
    if (isIOS()) {
      const shared = await shareFile(blob, filename);
      if (shared) return;
      // Fallback: open blob in new tab, user can long-press to save
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    // Android: Try share first, fall back to blob download
    if (isMobile()) {
      const shared = await shareFile(blob, filename);
      if (shared) return;
    }

    // Desktop / fallback
    desktopDownload(blob, filename);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

/**
 * Download multiple images with staggered timing.
 * Each download is independent — one failure doesn't stop the rest.
 */
export const downloadMultipleImages = async (
  items: Array<{ base64: string; filename: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  for (let i = 0; i < items.length; i++) {
    await downloadBase64Image(items[i].base64, items[i].filename);
    onProgress?.(i + 1, items.length);
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
};
