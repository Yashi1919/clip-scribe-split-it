
/**
 * Creates a download URL for a video segment from a source video
 */
export const createVideoSegment = async (
  sourceVideo: File,
  startTime: number,
  endTime: number
): Promise<Blob> => {
  // This is a simplified implementation that uses MediaRecorder to create a new video
  // In a production app, you'd likely want to use a more robust library like FFmpeg.js
  
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
    mimeType: 'video/webm',
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
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
  });
};

/**
 * Formats seconds into MM:SS format
 */
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Trigger a file download
 */
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
