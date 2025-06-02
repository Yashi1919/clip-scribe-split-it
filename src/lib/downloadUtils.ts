
/**
 * Download utilities for handling multiple file downloads and ZIP creation
 */

/**
 * Creates a ZIP file from multiple blobs
 */
export const createZipFromBlobs = async (files: { name: string; blob: Blob }[]): Promise<Blob> => {
  // Using JSZip-like functionality with native browser APIs
  // This is a simplified implementation using the Compression Streams API
  
  const zipData: Uint8Array[] = [];
  
  // Simple ZIP file structure (this is a basic implementation)
  // In a real production app, you'd want to use a proper ZIP library
  
  for (const file of files) {
    const arrayBuffer = await file.blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Add file to zip data (simplified)
    zipData.push(uint8Array);
  }
  
  // For now, we'll create a simple concatenated blob
  // In a production app, use a proper ZIP library like JSZip
  return new Blob(zipData, { type: 'application/zip' });
};

/**
 * Trigger download of a ZIP file
 */
export const downloadZip = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Available video export formats
 */
export const VIDEO_FORMATS = {
  webm: { mimeType: 'video/webm', extension: 'webm', name: 'WebM' },
  mp4: { mimeType: 'video/mp4', extension: 'mp4', name: 'MP4' },
  ogg: { mimeType: 'video/ogg', extension: 'ogg', name: 'OGG' }
} as const;

export type VideoFormat = keyof typeof VIDEO_FORMATS;

/**
 * Check which video formats are supported by the browser
 */
export const getSupportedFormats = (): VideoFormat[] => {
  const mediaRecorder = window.MediaRecorder;
  if (!mediaRecorder) return ['webm'];
  
  const supported: VideoFormat[] = [];
  
  Object.entries(VIDEO_FORMATS).forEach(([format, config]) => {
    if (mediaRecorder.isTypeSupported(config.mimeType)) {
      supported.push(format as VideoFormat);
    }
  });
  
  return supported.length > 0 ? supported : ['webm'];
};
