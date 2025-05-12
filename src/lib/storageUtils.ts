
/**
 * Utility functions for localStorage persistence
 */

export type StorageSegment = {
  id: string;
  startTime: number;
  endTime: number;
  type?: "cut" | "remove";
};

export type TimelineData = {
  markers: number[];
  selections?: { start: number | null; end: number | null }[];
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
 * Clear all stored data for a specific video
 */
export const clearVideoStorage = (videoId: string): void => {
  try {
    localStorage.removeItem(`segments_${videoId}`);
    localStorage.removeItem(`timeline_${videoId}`);
    localStorage.removeItem(`splitPoints_${videoId}`);
  } catch (error) {
    console.error("Failed to clear video data from localStorage:", error);
  }
};
