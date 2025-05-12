
/**
 * Format file size in bytes to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

/**
 * Format seconds to HH:MM:SS format
 */
export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const hDisplay = h > 0 ? h.toString().padStart(2, '0') + ':' : '';
  const mDisplay = m.toString().padStart(2, '0') + ':';
  const sDisplay = s.toString().padStart(2, '0');
  
  return hDisplay + mDisplay + sDisplay;
};

/**
 * Generate a readable file name from the original name
 */
export const generateOutputFileName = (
  originalName: string, 
  suffix: string, 
  extension: string = 'webm'
): string => {
  // Remove existing extension
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  // Clean up the name
  const cleanName = baseName.replace(/[^\w-]/g, '_').substring(0, 30);
  
  return `${cleanName}_${suffix}.${extension}`;
};

/**
 * Format date to local string
 */
export const formatDate = (date: Date | number): string => {
  const d = new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
};
