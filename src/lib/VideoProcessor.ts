/**
 * VideoProcessor utility for handling video editing operations
 */

/**
 * Creates a new video by removing a segment from the source video
 * 
 * @param sourceVideo The original video file
 * @param segmentToRemove Object containing start and end times of segment to remove
 * @param mimeType The desired output format
 * @returns Promise resolving to a Blob of the processed video
 */
export const removeVideoSegment = async (
  sourceVideo: File,
  segmentToRemove: { startTime: number; endTime: number },
  mimeType: string = 'video/webm'
): Promise<Blob> => {
  // In a browser environment without server-side processing,
  // we need a client-side approach to video editing
  
  // Create the first segment (before the removed part)
  let segments: Blob[] = [];
  
  if (segmentToRemove.startTime > 0) {
    const firstSegment = await createVideoSegment(
      sourceVideo,
      0,
      segmentToRemove.startTime,
      mimeType
    );
    segments.push(firstSegment);
  }
  
  // Get video duration
  const videoDuration = await getVideoDuration(sourceVideo);
  
  // Create the last segment (after the removed part)
  if (segmentToRemove.endTime < videoDuration) {
    const lastSegment = await createVideoSegment(
      sourceVideo,
      segmentToRemove.endTime,
      videoDuration,
      mimeType
    );
    segments.push(lastSegment);
  }
  
  // Combine the segments into one video
  if (segments.length === 1) {
    return segments[0];
  } else if (segments.length > 1) {
    // This is a simplified approach - in a real implementation,
    // we would use a more robust method to combine video segments
    return new Blob(segments, { type: mimeType });
  }
  
  throw new Error("Could not process video segments");
};

/**
 * Creates a video segment from a source video
 * (This reimplements the function from videoUtils.ts as we need it here)
 */
export const createVideoSegment = async (
  sourceVideo: File,
  startTime: number,
  endTime: number,
  mimeType: string = 'video/webm'
): Promise<Blob> => {
  // Create a video element to play the source video
  const video = document.createElement('video');
  video.src = URL.createObjectURL(sourceVideo);
  video.muted = true;

  // Wait for video to load
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
    video.load();
  });

  // Create a canvas to capture video frames
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Create a media stream from the canvas
  const stream = canvas.captureStream();

  // Create a media recorder to record the stream
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
  });

  // Store the recorded chunks
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Start recording
  mediaRecorder.start();

  // Seek to the start time
  video.currentTime = startTime;

  // Start playing the video
  await video.play();

  // Function to draw the video frame to the canvas
  const drawFrame = () => {
    if (video.currentTime <= endTime) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawFrame);
    } else {
      // Stop recording when we reach the end time
      mediaRecorder.stop();
      video.pause();
    }
  };

  // Start drawing frames
  drawFrame();

  // Return a promise that resolves with the recorded video blob
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
  });
};

/**
 * Get the duration of a video file
 */
export const getVideoDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    
    video.onerror = () => {
      reject(new Error("Could not load video metadata"));
    };
    
    video.src = URL.createObjectURL(file);
  });
};
