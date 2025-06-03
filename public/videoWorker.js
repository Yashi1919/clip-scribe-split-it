
// Video processing worker using FFmpeg WebAssembly
importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');

let ffmpeg = null;

async function initFFmpeg() {
  if (!ffmpeg) {
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
  }
  return ffmpeg;
}

self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'init':
        await initFFmpeg();
        self.postMessage({ type: 'ready' });
        break;
        
      case 'processSegment':
        const { videoData, startTime, endTime, outputFormat, segmentId } = data;
        
        const ffmpeg = await initFFmpeg();
        
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
        
      case 'batchProcess':
        const { videoData: batchVideoData, segments, outputFormat: batchFormat } = data;
        const ffmpeg2 = await initFFmpeg();
        
        await ffmpeg2.writeFile('input.mp4', new Uint8Array(batchVideoData));
        
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const duration = segment.endTime - segment.startTime;
          
          await ffmpeg2.exec([
            '-i', 'input.mp4',
            '-ss', segment.startTime.toString(),
            '-t', duration.toString(),
            '-c', 'copy',
            '-avoid_negative_ts', 'make_zero',
            `segment_${i}.${batchFormat}`
          ]);
          
          const segmentData = await ffmpeg2.readFile(`segment_${i}.${batchFormat}`);
          
          self.postMessage({
            type: 'batchSegmentComplete',
            index: i,
            segmentId: segment.id,
            data: segmentData.buffer
          });
          
          await ffmpeg2.deleteFile(`segment_${i}.${batchFormat}`);
        }
        
        await ffmpeg2.deleteFile('input.mp4');
        self.postMessage({ type: 'batchComplete' });
        break;
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error.message,
      segmentId: data?.segmentId 
    });
  }
};
