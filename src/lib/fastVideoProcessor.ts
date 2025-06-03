/**
 * High-performance video processor optimized for large files (1-3GB)
 * Uses Web Workers, FFmpeg WebAssembly, and memory management techniques
 */

interface ProcessingOptions {
  maxConcurrentWorkers?: number;
  chunkSize?: number;
  useStreamingDownload?: boolean;
  memoryThreshold?: number; // MB
}

interface SegmentJob {
  id: string;
  startTime: number;
  endTime: number;
  index: number;
}

export class FastVideoProcessor {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private processingQueue: SegmentJob[] = [];
  private activeJobs = new Map<string, { worker: Worker; resolve: Function; reject: Function }>();
  private maxWorkers: number;
  private videoData: ArrayBuffer | null = null;
  private isFFmpegAvailable: boolean = true;
  private memoryThreshold: number;
  private videoFile: File | null = null;
  
  constructor(options: ProcessingOptions = {}) {
    this.maxWorkers = Math.min(
      options.maxConcurrentWorkers || Math.max(2, Math.floor(navigator.hardwareConcurrency / 2)),
      6 // Reduced cap for large files to prevent memory issues
    );
    this.memoryThreshold = options.memoryThreshold || 1000; // 1GB default threshold
  }
  
  async initialize(videoFile: File): Promise<void> {
    this.videoFile = videoFile;
    const fileSizeMB = videoFile.size / (1024 * 1024);
    
    // For very large files, reduce worker count and use streaming
    if (fileSizeMB > this.memoryThreshold) {
      console.log(`Large file detected (${fileSizeMB.toFixed(0)}MB), optimizing for memory usage`);
      this.maxWorkers = Math.min(this.maxWorkers, 3);
    }
    
    // Load video data in chunks for large files or all at once for smaller files
    if (fileSizeMB > 500) {
      console.log("Using streaming mode for large file");
      // Don't load entire file into memory for very large files
      this.videoData = null;
    } else {
      console.log("Loading file into memory for fast processing");
      this.videoData = await videoFile.arrayBuffer();
    }
    
    // Create and initialize workers
    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker('/videoWorker.js');
        
        worker.onmessage = (e) => this.handleWorkerMessage(e, worker);
        worker.onerror = (error) => this.handleWorkerError(error, worker);
        
        this.workers.push(worker);
        
        // Initialize FFmpeg in worker
        worker.postMessage({ type: 'init' });
      } catch (error) {
        console.warn('Failed to create worker:', error);
        this.isFFmpegAvailable = false;
      }
    }
    
    if (this.workers.length === 0) {
      throw new Error('No workers could be created');
    }
    
    // Wait for workers to initialize with longer timeout for large files
    const timeout = fileSizeMB > 1000 ? 15000 : 10000;
    const workerPromises = this.workers.map(worker => 
      new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          console.warn('Worker initialization timeout');
          resolve(false);
        }, timeout);
        
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'ready') {
            worker.removeEventListener('message', handler);
            this.availableWorkers.push(worker);
            clearTimeout(timeoutId);
            resolve(true);
          } else if (e.data.type === 'error' && e.data.ffmpegUnavailable) {
            worker.removeEventListener('message', handler);
            clearTimeout(timeoutId);
            resolve(false);
          }
        };
        worker.addEventListener('message', handler);
      })
    );
    
    const results = await Promise.all(workerPromises);
    const successfulWorkers = results.filter(Boolean).length;
    
    if (successfulWorkers === 0) {
      this.isFFmpegAvailable = false;
      throw new Error('FFmpeg workers failed to initialize - falling back to slower method');
    }
    
    console.log(`Initialized ${successfulWorkers}/${this.workers.length} FFmpeg workers for ${fileSizeMB.toFixed(0)}MB file`);
  }

  /**
   * Get video data for a segment, either from memory or by reading from file
   */
  private async getVideoDataForSegment(): Promise<ArrayBuffer> {
    if (this.videoData) {
      return this.videoData;
    }
    
    // For large files, read the entire file when needed
    // In a more advanced implementation, we could read only the needed portion
    if (this.videoFile) {
      return await this.videoFile.arrayBuffer();
    }
    
    throw new Error('No video data available');
  }
  
  async processSegments(
    segments: SegmentJob[],
    outputFormat: string = 'mp4',
    onProgress?: (completed: number, total: number) => void,
    onSegmentComplete?: (segmentId: string, data: ArrayBuffer) => void
  ): Promise<Map<string, ArrayBuffer>> {
    if (!this.videoFile) {
      throw new Error('Video processor not initialized');
    }
    
    if (!this.isFFmpegAvailable || this.availableWorkers.length === 0) {
      throw new Error('No FFmpeg workers available');
    }
    
    const results = new Map<string, ArrayBuffer>();
    let completed = 0;
    
    return new Promise((resolve, reject) => {
      const processNext = async () => {
        if (this.processingQueue.length === 0 && this.activeJobs.size === 0) {
          resolve(results);
          return;
        }
        
        while (this.availableWorkers.length > 0 && this.processingQueue.length > 0) {
          const worker = this.availableWorkers.pop()!;
          const job = this.processingQueue.shift()!;
          
          try {
            const videoData = await this.getVideoDataForSegment();
            
            const jobPromise = new Promise<ArrayBuffer>((resolveJob, rejectJob) => {
              this.activeJobs.set(job.id, { worker, resolve: resolveJob, reject: rejectJob });
              
              worker.postMessage({
                type: 'processSegment',
                data: {
                  videoData: videoData,
                  startTime: job.startTime,
                  endTime: job.endTime,
                  outputFormat,
                  segmentId: job.id
                }
              });
            });
            
            jobPromise.then((data) => {
              results.set(job.id, data);
              completed++;
              onProgress?.(completed, segments.length);
              onSegmentComplete?.(job.id, data);
            }).catch(reject);
            
          } catch (error) {
            reject(error);
            return;
          }
        }
      };
      
      this.processingQueue = [...segments];
      processNext();
      
      // Set up interval to check for available workers
      const checkInterval = setInterval(() => {
        if (this.availableWorkers.length > 0 && this.processingQueue.length > 0) {
          processNext();
        }
        if (this.processingQueue.length === 0 && this.activeJobs.size === 0) {
          clearInterval(checkInterval);
        }
      }, 100);
    });
  }

  /**
   * Process segments with automatic downloads - optimized for large files
   */
  async processAndDownloadSegments(
    segments: SegmentJob[],
    outputFormat: string = 'mp4',
    videoFileName: string,
    onProgress?: (completed: number, total: number) => void,
    onSegmentDownloaded?: (segmentId: string, filename: string) => void
  ): Promise<void> {
    if (!this.videoFile) {
      throw new Error('Video processor not initialized');
    }
    
    if (!this.isFFmpegAvailable || this.availableWorkers.length === 0) {
      throw new Error('No FFmpeg workers available');
    }
    
    let completed = 0;
    
    return new Promise((resolve, reject) => {
      const processNext = async () => {
        if (this.processingQueue.length === 0 && this.activeJobs.size === 0) {
          resolve();
          return;
        }
        
        while (this.availableWorkers.length > 0 && this.processingQueue.length > 0) {
          const worker = this.availableWorkers.pop()!;
          const job = this.processingQueue.shift()!;
          
          try {
            const videoData = await this.getVideoDataForSegment();
            
            const jobPromise = new Promise<ArrayBuffer>((resolveJob, rejectJob) => {
              this.activeJobs.set(job.id, { worker, resolve: resolveJob, reject: rejectJob });
              
              worker.postMessage({
                type: 'processSegment',
                data: {
                  videoData: videoData,
                  startTime: job.startTime,
                  endTime: job.endTime,
                  outputFormat,
                  segmentId: job.id
                }
              });
            });
            
            jobPromise.then((data) => {
              // Immediately download and release memory
              const blob = new Blob([data], { type: `video/${outputFormat}` });
              const filename = this.generateSegmentFilename(videoFileName, job.index, outputFormat);
              this.streamingDownload(blob, filename);
              
              completed++;
              onProgress?.(completed, segments.length);
              onSegmentDownloaded?.(job.id, filename);
              
              // Force garbage collection hint for large files
              if (this.videoFile && this.videoFile.size > 500 * 1024 * 1024) {
                setTimeout(() => {
                  if (window.gc) {
                    window.gc();
                  }
                }, 100);
              }
            }).catch(reject);
            
          } catch (error) {
            reject(error);
            return;
          }
        }
      };
      
      this.processingQueue = [...segments];
      processNext();
      
      const checkInterval = setInterval(() => {
        if (this.availableWorkers.length > 0 && this.processingQueue.length > 0) {
          processNext();
        }
        if (this.processingQueue.length === 0 && this.activeJobs.size === 0) {
          clearInterval(checkInterval);
        }
      }, 100);
    });
  }

  private generateSegmentFilename(videoFileName: string, index: number, format: string): string {
    const baseName = videoFileName.replace(/\.[^/.]+$/, "");
    return `${baseName}_part${index + 1}.${format}`;
  }

  private streamingDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Clean up immediately to free memory
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  private handleWorkerMessage(e: MessageEvent, worker: Worker) {
    const { type, segmentId, data, error, ffmpegUnavailable } = e.data;
    
    switch (type) {
      case 'segmentComplete':
        const job = this.activeJobs.get(segmentId);
        if (job) {
          job.resolve(data);
          this.activeJobs.delete(segmentId);
          this.availableWorkers.push(worker);
        }
        break;
        
      case 'error':
        const errorJob = this.activeJobs.get(segmentId);
        if (errorJob) {
          if (ffmpegUnavailable) {
            errorJob.reject(new Error('FFmpeg not available in worker'));
          } else {
            errorJob.reject(new Error(error));
          }
          this.activeJobs.delete(segmentId);
          this.availableWorkers.push(worker);
        }
        break;
        
      case 'log':
        console.log('FFmpeg:', e.data.message);
        break;
    }
  }
  
  private handleWorkerError(error: ErrorEvent, worker: Worker) {
    console.error('Worker error:', error);
    // Find and reject any active jobs for this worker
    for (const [segmentId, job] of this.activeJobs) {
      if (job.worker === worker) {
        job.reject(new Error('Worker error'));
        this.activeJobs.delete(segmentId);
      }
    }
  }
  
  destroy() {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.activeJobs.clear();
    this.processingQueue = [];
    this.videoData = null;
    this.videoFile = null;
  }
  
  get isAvailable(): boolean {
    return this.isFFmpegAvailable && this.availableWorkers.length > 0;
  }

  get memoryUsage(): { videoDataMB: number; isUsingMemoryMode: boolean } {
    const videoDataMB = this.videoData ? this.videoData.byteLength / (1024 * 1024) : 0;
    return {
      videoDataMB,
      isUsingMemoryMode: !!this.videoData
    };
  }
}

/**
 * Download blob with streaming for better performance
 */
export const streamingDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

/**
 * Process segments in batches to prevent memory overload
 */
export const processBatchedSegments = async (
  processor: FastVideoProcessor,
  segments: SegmentJob[],
  batchSize: number = 10,
  outputFormat: string = 'mp4',
  onProgress?: (completed: number, total: number) => void,
  onSegmentComplete?: (segmentId: string, data: ArrayBuffer, filename: string) => void
): Promise<void> => {
  const totalSegments = segments.length;
  let processedCount = 0;
  
  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    
    const results = await processor.processSegments(
      batch,
      outputFormat,
      (batchCompleted, batchTotal) => {
        onProgress?.(processedCount + batchCompleted, totalSegments);
      }
    );
    
    for (const [segmentId, data] of results) {
      const segment = batch.find(s => s.id === segmentId);
      if (segment) {
        const filename = `segment_${segment.index + 1}.${outputFormat}`;
        const blob = new Blob([data], { type: `video/${outputFormat}` });
        streamingDownload(blob, filename);
        onSegmentComplete?.(segmentId, data, filename);
      }
    }
    
    processedCount += batch.length;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};
