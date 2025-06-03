
// Video processing worker with better error handling
let ffmpeg = null;
let isFFmpegAvailable = false;

async function initFFmpeg() {
  if (!ffmpeg && !isFFmpegAvailable) {
    try {
      // Try to load FFmpeg from CDN
      importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
      
      const { FFmpeg } = FFmpegWASM;
      ffmpeg = new FFmpeg();
      
      ffmpeg.on('log', ({ message }) => {
        self.postMessage({ type: 'log', message });
      });
      
      ffmpeg.on('progress', ({ progress }) => {
        self.postMessage({ type: 'progress', progress });
      });
      
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      });
      
      isFFmpegAvailable = true;
      self.postMessage({ type: 'log', message: 'FFmpeg loaded successfully' });
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      isFFmpegAvailable = false;
      // Signal that FFmpeg is not available
      self.postMessage({ 
        type: 'error', 
        error: 'FFmpeg not available - CDN loading failed',
        ffmpegUnavailable: true 
      });
      return null;
    }
  }
  return ffmpeg;
}

self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'init':
        const initResult = await initFFmpeg();
        if (initResult || isFFmpegAvailable) {
          self.postMessage({ type: 'ready' });
        } else {
          self.postMessage({ 
            type: 'error', 
            error: 'FFmpeg initialization failed',
            ffmpegUnavailable: true 
          });
        }
        break;
        
      case 'processSegment':
        if (!isFFmpegAvailable) {
          self.postMessage({ 
            type: 'error', 
            error: 'FFmpeg not available',
            segmentId: data.segmentId,
            ffmpegUnavailable: true 
          });
          return;
        }
        
        const { videoData, startTime, endTime, outputFormat, segmentId } = data;
        
        const ffmpeg = await initFFmpeg();
        if (!ffmpeg) {
          self.postMessage({ 
            type: 'error', 
            error: 'FFmpeg not initialized',
            segmentId: segmentId,
            ffmpegUnavailable: true 
          });
          return;
        }
        
        // Write input file
        await ffmpeg.writeFile('input.mp4', new Uint8Array(videoData));
        
        // Process segment with FFmpeg
        const duration = endTime - startTime;
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-ss', startTime.toString(),
          '-t', duration.toString(),
          '-c', 'copy', // Copy streams without re-encoding for speed
          '-avoid_negative_ts', 'make_zero',
          `output.${outputFormat}`
        ]);
        
        // Read output file
        const outputData = await ffmpeg.readFile(`output.${outputFormat}`);
        
        // Clean up
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile(`output.${outputFormat}`);
        
        self.postMessage({
          type: 'segmentComplete',
          segmentId,
          data: outputData.buffer
        });
        break;
        
      default:
        self.postMessage({ 
          type: 'error', 
          error: `Unknown message type: ${type}` 
        });
    }
  } catch (error) {
    console.error('Worker processing error:', error);
    self.postMessage({ 
      type: 'error', 
      error: error.message,
      segmentId: data?.segmentId 
    });
  }
};
