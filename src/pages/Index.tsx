
import { useState } from "react";
import { Scissors, File, Video } from "lucide-react";
import VideoUploader from "@/components/VideoUploader";
import VideoPlayer from "@/components/VideoPlayer";
import VideoSplitter from "@/components/VideoSplitter";

const Index = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const handleVideoUploaded = (file: File, url: string) => {
    setVideoFile(file);
    setVideoUrl(url);
  };

  const handleVideoMetadata = (duration: number) => {
    setVideoDuration(duration);
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 min-h-screen">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <Scissors className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Clip<span className="text-accent">Scribe</span>
          </h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Split videos into equal segments with ease
        </p>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center">
            <File className="mr-2 h-5 w-5" />
            Upload Video
          </h2>
          <VideoUploader onVideoUploaded={handleVideoUploaded} />
        </section>

        {videoUrl && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center">
              <Video className="mr-2 h-5 w-5" />
              Video Preview
            </h2>
            <div className="max-w-3xl mx-auto">
              <VideoPlayer
                src={videoUrl}
                className="rounded-lg shadow-lg border"
                onLoadedMetadata={handleVideoMetadata}
              />
              {videoDuration > 0 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Video duration: {Math.floor(videoDuration / 60)}:{Math.floor(videoDuration % 60)
                    .toString()
                    .padStart(2, "0")}
                </p>
              )}
            </div>
          </section>
        )}

        {videoFile && videoUrl && videoDuration > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center">
              <Scissors className="mr-2 h-5 w-5" />
              Split Video
            </h2>
            <VideoSplitter
              videoFile={videoFile}
              videoUrl={videoUrl}
              videoDuration={videoDuration}
            />
          </section>
        )}
      </div>
      
      <footer className="mt-16 border-t pt-6 text-center text-sm text-muted-foreground">
        <p>ClipScribe Video Splitter &copy; 2025</p>
        <p className="mt-1">Split, manage, and download video segments with ease</p>
      </footer>
    </div>
  );
};

export default Index;
