
/**
 * Utility functions for localStorage persistence
 */

export type StorageSegment = {
  id: string;
  startTime: number;
  endTime: number;
  type?: "cut" | "remove";
  label?: string; // Added for better segment identification
  color?: string; // For visual differentiation on timeline
  createdAt?: number; // Timestamp when segment was created
};

export type TimelineData = {
  markers: number[];
  selections?: { start: number | null; end: number | null }[];
  zoomLevel?: number; // Added for timeline zoom persistence
  position?: number; // Current position in video
};

export type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
  format?: string;
  lastAccessed: number;
};

/**
 * Save segments for a specific video to localStorage
 */
export const saveSegmentsToStorage = (videoId: string, segments: StorageSegment[]): void => {
  try {
    localStorage.setItem(`segments_${videoId}`, JSON.stringify(segments));
  } catch (error) {
    console.error("Failed to save segments to localStorage:", error);
  }
};

/**
 * Load segments for a specific video from localStorage
 */
export const loadSegmentsFromStorage = (videoId: string): StorageSegment[] => {
  try {
    const savedSegments = localStorage.getItem(`segments_${videoId}`);
    if (savedSegments) {
      return JSON.parse(savedSegments);
    }
  } catch (error) {
    console.error("Failed to load segments from localStorage:", error);
  }
  return [];
};

/**
 * Save timeline data for a specific video to localStorage
 */
export const saveTimelineToStorage = (videoId: string, data: TimelineData): void => {
  try {
    localStorage.setItem(`timeline_${videoId}`, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save timeline data to localStorage:", error);
  }
};

/**
 * Load timeline data for a specific video from localStorage
 */
export const loadTimelineFromStorage = (videoId: string): TimelineData | null => {
  try {
    const savedData = localStorage.getItem(`timeline_${videoId}`);
    if (savedData) {
      return JSON.parse(savedData);
    }
  } catch (error) {
    console.error("Failed to load timeline data from localStorage:", error);
  }
  return null;
};

/**
 * Generate a unique ID for a video file
 */
export const generateVideoId = (file: File): string => {
  // Use file name and size as part of the ID to make it unique
  return `video_${file.name.replace(/\W/g, '_')}_${file.size}`;
};

/**
 * Save video metadata to localStorage
 */
export const saveVideoMetadata = (videoId: string, metadata: VideoMetadata): void => {
  try {
    localStorage.setItem(`metadata_${videoId}`, JSON.stringify(metadata));
  } catch (error) {
    console.error("Failed to save video metadata to localStorage:", error);
  }
};

/**
 * Load video metadata from localStorage
 */
export const loadVideoMetadata = (videoId: string): VideoMetadata | null => {
  try {
    const savedMetadata = localStorage.getItem(`metadata_${videoId}`);
    if (savedMetadata) {
      return JSON.parse(savedMetadata);
    }
  } catch (error) {
    console.error("Failed to load video metadata from localStorage:", error);
  }
  return null;
};

/**
 * Clear all stored data for a specific video
 */
export const clearVideoStorage = (videoId: string): void => {
  try {
    localStorage.removeItem(`segments_${videoId}`);
    localStorage.removeItem(`timeline_${videoId}`);
    localStorage.removeItem(`splitPoints_${videoId}`);
    localStorage.removeItem(`metadata_${videoId}`);
    localStorage.removeItem(`history_${videoId}`);
  } catch (error) {
    console.error("Failed to clear video data from localStorage:", error);
  }
};

/**
 * Save edit history for undo/redo functionality
 */
export const saveHistoryToStorage = (videoId: string, history: any[]): void => {
  try {
    // Limit history size to prevent localStorage overflow
    const limitedHistory = history.slice(-20);
    localStorage.setItem(`history_${videoId}`, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error("Failed to save history to localStorage:", error);
  }
};

/**
 * Load edit history from localStorage
 */
export const loadHistoryFromStorage = (videoId: string): any[] => {
  try {
    const savedHistory = localStorage.getItem(`history_${videoId}`);
    if (savedHistory) {
      return JSON.parse(savedHistory);
    }
  } catch (error) {
    console.error("Failed to load history from localStorage:", error);
  }
  return [];
};
