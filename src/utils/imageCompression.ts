/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCsrfToken } from './apiClient';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0 (default 0.8)
  format?: 'image/jpeg' | 'image/webp';
}

export interface UploadResult {
  success: boolean;
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

/**
 * Checks whether a given file is a compressible raster image.
 */
export function isImageFile(file: File | { type?: string; name?: string }): boolean {
  if (file.type && file.type.startsWith('image/')) {
    // Avoid compressing SVG vector files or icons
    return !file.type.includes('svg');
  }
  const name = file.name ? file.name.toLowerCase() : '';
  return /\.(jpe?g|png|webp|bmp)$/i.test(name);
}

/**
 * Compresses an image file client-side using an off-screen HTMLCanvas.
 * - Resizes if width or height exceeds 1600px (preserving aspect ratio)
 * - Compresses JPEG/WebP to quality 0.8
 * - Yields lightweight payload (~250–350 KB)
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  // If not an image, return original file intact
  if (!isImageFile(file)) {
    return file;
  }

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.8,
    format = 'image/jpeg',
  } = options;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file); // Fallback to original on error
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        resolve(file);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale while maintaining exact aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        // Fill background white for JPEGs to prevent black alpha-channel artifacts
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Derive safe filename with matching extension
            const ext = format === 'image/webp' ? '.webp' : '.jpg';
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const newName = `${baseName}_optimized${ext}`;

            const compressedFile = new File([blob], newName, {
              type: format,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          format,
          quality
        );
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image file and returns an optimized data URL directly.
 */
export async function compressImageToDataUrl(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const compressed = await compressImageFile(file, options);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(compressed);
  });
}

/**
 * Uploads a file (or compressed image) to the persistent server disk (`server/uploads/`).
 * Returns lightweight relative URL (e.g., `/uploads/filename.ext`) for storage in PostgreSQL.
 */
export async function uploadFileToServer(
  file: File,
  autoCompress = true
): Promise<UploadResult> {
  let fileToUpload = file;

  // Auto-compress images before network transmission if enabled
  if (autoCompress && isImageFile(file)) {
    fileToUpload = await compressImageFile(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.8,
    });
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);

  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Upload failed with HTTP ${res.status}`);
  }

  return await res.json();
}
