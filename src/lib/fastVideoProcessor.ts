
/**
 * High-performance video processor using Web Workers and FFmpeg WebAssembly
 */

interface ProcessingOptions {
  maxConcurrentWorkers?: number;
  chunkSize?: number;
  useStreamingDownload?: boolean;
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
  
  constructor(options: ProcessingOptions = {}) {
    this.maxWorkers = Math.min(
      options.maxConcurrentWorkers || navigator.hardwareConcurrency || 4,
      8 // Cap at 8 to prevent browser overload
    );
  }
  
  async initialize(videoFile: File): Promise<void> {
    // Load video data once
    this.videoData = await videoFile.arrayBuffer();
    
    // Create and initialize workers
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker('/videoWorker.js');
      
      worker.onmessage = (e) => this.handleWorkerMessage(e, worker);
      worker.onerror = (error) => this.handleWorkerError(error, worker);
      
      this.workers.push(worker);
      
      // Initialize FFmpeg in worker
      worker.postMessage({ type: 'init' });
    }
    
    // Wait for all workers to be ready
    await Promise.all(
      this.workers.map(worker => 
        new Promise<void>((resolve) => {
          const handler = (e: MessageEvent) => {
            if (e.data.type === 'ready') {
              worker.removeEventListener('message', handler);
              this.availableWorkers.push(worker);
              resolve();
            }
          };
          worker.addEventListener('message', handler);
        })
      )
    );
  }
  
  async processSegments(
    segments: SegmentJob[],
    outputFormat: string = 'mp4',
    onProgress?: (completed: number, total: number) => void,
    onSegmentComplete?: (segmentId: string, data: ArrayBuffer) => void
  ): Promise<Map<string, ArrayBuffer>> {
    if (!this.videoData) {
      throw new Error('Video processor not initialized');
    }
    
    const results = new Map<string, ArrayBuffer>();
    let completed = 0;
    
    return new Promise((resolve, reject) => {
      const processNext = () => {
        if (this.processingQueue.length === 0 && this.activeJobs.size === 0) {
          resolve(results);
          return;
        }
        
        while (this.availableWorkers.length > 0 && this.processingQueue.length > 0) {
          const worker = this.availableWorkers.pop()!;
          const job = this.processingQueue.shift()!;
          
          const jobPromise = new Promise<ArrayBuffer>((resolveJob, rejectJob) => {
            this.activeJobs.set(job.id, { worker, resolve: resolveJob, reject: rejectJob });
            
            worker.postMessage({
              type: 'processSegment',
              data: {
                videoData: this.videoData,
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
   * Process segments with automatic downloads as each completes
   */
  async processAndDownloadSegments(
    segments: SegmentJob[],
    outputFormat: string = 'mp4',
    videoFileName: string,
    onProgress?: (completed: number, total: number) => void,
    onSegmentDownloaded?: (segmentId: string, filename: string) => void
  ): Promise<void> {
    if (!this.videoData) {
      throw new Error('Video processor not initialized');
    }
    
    let completed = 0;
    
    return new Promise((resolve, reject) => {
      const processNext = () => {
        if (this.processingQueue.length === 0 && this.activeJobs.size === 0) {
          resolve();
          return;
        }
        
        while (this.availableWorkers.length > 0 && this.processingQueue.length > 0) {
          const worker = this.availableWorkers.pop()!;
          const job = this.processingQueue.shift()!;
          
          const jobPromise = new Promise<ArrayBuffer>((resolveJob, rejectJob) => {
            this.activeJobs.set(job.id, { worker, resolve: resolveJob, reject: rejectJob });
            
            worker.postMessage({
              type: 'processSegment',
              data: {
                videoData: this.videoData,
                startTime: job.startTime,
                endTime: job.endTime,
                outputFormat,
                segmentId: job.id
              }
            });
          });
          
          jobPromise.then((data) => {
            // Immediately download the segment
            const blob = new Blob([data], { type: `video/${outputFormat}` });
            const filename = this.generateSegmentFilename(videoFileName, job.index, outputFormat);
            this.streamingDownload(blob, filename);
            
            completed++;
            onProgress?.(completed, segments.length);
            onSegmentDownloaded?.(job.id, filename);
          }).catch(reject);
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
    const { type, segmentId, data, error } = e.data;
    
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
          errorJob.reject(new Error(error));
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
  }
}

/**
 * Download blob with streaming for better performance
 */
export const streamingDownload = (blob: Blob, filename: string): void => {
  // Use streaming download for large files
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
    
    // Download each segment immediately to free memory
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
    
    // Small delay between batches to prevent browser lockup
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};
