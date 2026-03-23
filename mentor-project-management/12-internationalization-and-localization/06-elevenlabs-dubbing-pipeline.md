# Task: Build ElevenLabs Dubbing Pipeline for Video Localization

## Description

Implement backend pipeline to automatically generate dubbed audio tracks for course videos in ES, FR, RU using ElevenLabs Dubbing API. Mentor uploads EN video, backend extracts audio, calls ElevenLabs API to generate gender-consistent dubbed audio for all languages, stores dubbed tracks in R2 storage, and attaches to Mux assets. Use QStash for background job processing and webhooks for async completion notifications.

## Affected Apps/Packages

- `packages/backend` (dubbing pipeline logic)
- `apps/api` (endpoints for video upload and dubbing status)
- `services/elevenlabs` (ElevenLabs API integration)
- `services/mux` (Mux API calls)
- `services/qstash` (background job queue)

## Requirements

### ElevenLabs Integration

- ElevenLabs Dubbing API for ES, FR, RU audio generation
- Gender-consistent AI voices (select based on original speaker gender)
- Voice tone matching (professional, educational context)
- Audio quality: 48kHz, AAC format for Mux compatibility
- Support for multiple speakers in single video

### Video Upload Flow

1. Mentor uploads EN video to storage (Mux)
2. Backend creates Mux asset from video
3. Trigger QStash job: extract audio and prepare for dubbing
4. Submit job to ElevenLabs Dubbing API
5. Poll or webhook for completion
6. Download dubbed audio files
7. Upload to R2 storage
8. Create Mux audio tracks for each dubbed language
9. Notify user of completion

### Audio Processing

- Extract audio from video in lossless format
- Support multiple audio tracks (if source has multiple speakers)
- Ensure audio metadata (duration, sample rate) preserved
- Convert dubbed audio to format compatible with Mux

### Error Handling & Retry Logic

- Exponential backoff for API failures
- Webhook validation (ElevenLabs signing)
- Fallback to EN audio if dubbing fails
- Max retry attempts: 3
- Log all errors and statuses for debugging

### Gender-Consistent Dubbing

- Detect speaker gender from original EN audio (manual or auto-detection)
- Store gender metadata with video
- Select matching gender voices from ElevenLabs
- Ensure consistency across all dubbed tracks

## Acceptance Criteria

- [ ] ElevenLabs API integration implemented with authentication
- [ ] Video upload triggers dubbing pipeline
- [ ] Audio extraction from video works correctly
- [ ] ElevenLabs Dubbing API called successfully for ES, FR, RU
- [ ] Gender-consistent voice selection working
- [ ] QStash job processing implemented
- [ ] Dubbed audio downloaded and stored in R2
- [ ] Mux Create Asset Track API called for each dubbed language
- [ ] Webhook endpoint handles ElevenLabs completion notifications
- [ ] Polling mechanism for dubbing status (fallback)
- [ ] Error handling and retry logic working
- [ ] Fallback to EN audio on failure
- [ ] User receives completion notification
- [ ] Admin can view dubbing status per video
- [ ] Dubbed audio quality verified (sound, sync)

## Dependencies

- Mux integration for video storage and assets
- R2 storage configured for media files
- QStash account and API key configured
- ElevenLabs account with Dubbing API access

## Technical Notes

### ElevenLabs API Setup

**services/elevenlabs/types.ts:**

```typescript
export interface DubbingJob {
  dubbing_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  source_language: string;
  target_language: string;
  num_speakers: number;
  video_url?: string;
  webhook_url?: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface DubbedAudio {
  language: string;
  audio_url: string;
  duration: number;
  file_size: number;
}

export interface SpeakerProfile {
  speaker_id: number;
  gender: "male" | "female";
  name?: string;
  characteristics?: string;
}

export interface DubbingRequest {
  file: File | Buffer;
  source_language: string;
  target_languages: string[];
  speakers?: SpeakerProfile[];
  num_speakers?: number;
  webhook_url?: string;
}
```

**services/elevenlabs/client.ts:**

```typescript
import axios, { AxiosInstance } from "axios";
import { DubbingJob, DubbingRequest, DubbedAudio } from "./types";

export class ElevenLabsClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = "https://api.elevenlabs.io/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Submit video for dubbing across multiple target languages
   */
  async submitDubbingJob(request: DubbingRequest): Promise<DubbingJob> {
    try {
      const formData = new FormData();

      // Add file
      if (Buffer.isBuffer(request.file)) {
        formData.append("file", new Blob([request.file]), "audio.wav");
      } else {
        formData.append("file", request.file);
      }

      // Add parameters
      formData.append("source_lang", request.source_language);
      formData.append("target_langs", JSON.stringify(request.target_languages));

      if (request.speakers && request.speakers.length > 0) {
        formData.append("speakers", JSON.stringify(request.speakers));
      }

      if (request.num_speakers) {
        formData.append("num_speakers", request.num_speakers.toString());
      }

      if (request.webhook_url) {
        formData.append("webhook_url", request.webhook_url);
      }

      const response = await this.client.post<DubbingJob>(
        "/dubbing",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Failed to submit dubbing job:", error);
      throw error;
    }
  }

  /**
   * Get status of dubbing job
   */
  async getDubbingStatus(dubbing_id: string): Promise<DubbingJob> {
    try {
      const response = await this.client.get<DubbingJob>(
        `/dubbing/${dubbing_id}`
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get dubbing status:", error);
      throw error;
    }
  }

  /**
   * Get dubbed audio for a specific language
   */
  async getDubbedAudio(
    dubbing_id: string,
    language: string
  ): Promise<DubbedAudio> {
    try {
      const response = await this.client.get<DubbedAudio>(
        `/dubbing/${dubbing_id}/audio/${language}`,
        { responseType: "arraybuffer" as any }
      );

      return {
        language,
        audio_url: `data:audio/mpeg;base64,${Buffer.from(response.data).toString("base64")}`,
        duration: 0, // Set from metadata
        file_size: response.data.byteLength,
      };
    } catch (error) {
      console.error(`Failed to get dubbed audio for ${language}:`, error);
      throw error;
    }
  }

  /**
   * Get all dubbed audio files for a job
   */
  async getAllDubbedAudio(dubbing_id: string): Promise<DubbedAudio[]> {
    try {
      const status = await this.getDubbingStatus(dubbing_id);

      const audioFiles: DubbedAudio[] = [];

      for (const language of ["es", "fr", "ru"]) {
        try {
          const audio = await this.getDubbedAudio(dubbing_id, language);
          audioFiles.push(audio);
        } catch (err) {
          console.warn(`Could not fetch ${language} audio:`, err);
        }
      }

      return audioFiles;
    } catch (error) {
      console.error("Failed to get all dubbed audio:", error);
      throw error;
    }
  }

  /**
   * Validate webhook signature from ElevenLabs
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const computed = hmac.digest("hex");
    return computed === signature;
  }
}

export const elevenlabsClient = new ElevenLabsClient(
  process.env.ELEVENLABS_API_KEY!
);
```

### Video Processing & Audio Extraction

**services/media/video-processor.ts:**

```typescript
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

export class VideoProcessor {
  /**
   * Extract audio from video file
   */
  static async extractAudio(
    videoPath: string,
    outputPath: string,
    format: "wav" | "mp3" = "wav"
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(outputPath)
        .audioCodec(format === "wav" ? "pcm_s16le" : "libmp3lame")
        .audioFrequency(48000) // 48kHz for Mux compatibility
        .on("end", () => {
          console.log(`Audio extracted: ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Get video metadata (duration, etc.)
   */
  static async getMetadata(
    videoPath: string
  ): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const stream = metadata.streams[0];
        resolve({
          duration: metadata.format.duration || 0,
          width: stream.width || 0,
          height: stream.height || 0,
        });
      });
    });
  }

  /**
   * Detect number of speakers (silence gaps)
   */
  static async detectSpeakers(audioPath: string): Promise<number> {
    // Simplified: return 1 for single speaker
    // More sophisticated detection would analyze audio levels and gaps
    return 1;
  }

  /**
   * Detect speaker gender from audio (ML model or service)
   */
  static async detectSpeakerGender(
    audioPath: string
  ): Promise<"male" | "female"> {
    // TODO: Integrate with audio gender detection service
    // For now, return placeholder
    return "female";
  }
}
```

### Dubbing Pipeline Job

**services/dubbing/dubbing-pipeline.ts:**

```typescript
import { QStashQueue } from "@services/qstash";
import { elevenlabsClient } from "@services/elevenlabs";
import { VideoProcessor } from "@services/media";
import { MuxClient } from "@services/mux";
import { StorageService } from "@services/storage";
import { VideoModel, DubbingJobModel } from "@models";
import { logger } from "@lib/logger";

interface DubbingJobPayload {
  videoId: string;
  videoPath: string;
  dubbingLanguages: string[]; // ['es', 'fr', 'ru']
  webhookUrl?: string;
}

export class DubbingPipeline {
  /**
   * Initiate dubbing pipeline for a video
   */
  static async initiateDubbing(payload: DubbingJobPayload): Promise<void> {
    const { videoId, videoPath, dubbingLanguages, webhookUrl } = payload;

    try {
      logger.info(`Starting dubbing pipeline for video ${videoId}`);

      const video = await VideoModel.findById(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      // Extract audio from video
      const tempDir = "/tmp/dubbing";
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const audioPath = path.join(tempDir, `${videoId}-audio.wav`);

      logger.info(`Extracting audio from ${videoPath}`);
      await VideoProcessor.extractAudio(videoPath, audioPath);

      // Detect metadata
      logger.info("Detecting audio metadata");
      const numSpeakers = await VideoProcessor.detectSpeakers(audioPath);
      const speakerGender = await VideoProcessor.detectSpeakerGender(audioPath);

      // Prepare speaker profiles
      const speakers = [];
      for (let i = 0; i < numSpeakers; i++) {
        speakers.push({
          speaker_id: i + 1,
          gender: speakerGender,
        });
      }

      // Read audio file
      const audioBuffer = fs.readFileSync(audioPath);

      // Submit to ElevenLabs
      logger.info(
        `Submitting dubbing job for languages: ${dubbingLanguages.join(", ")}`
      );

      const dubbingJob = await elevenlabsClient.submitDubbingJob({
        file: audioBuffer,
        source_language: "en",
        target_languages: dubbingLanguages,
        speakers,
        webhook_url: webhookUrl,
      });

      logger.info(`ElevenLabs job created: ${dubbingJob.dubbing_id}`);

      // Store dubbing job record
      await DubbingJobModel.create({
        videoId,
        dubbingId: dubbingJob.dubbing_id,
        status: "submitted",
        targetLanguages: dubbingLanguages,
        numSpeakers,
        speakerGender,
        metadata: { videoPath, audioPath },
      });

      // Clean up temp audio file
      fs.unlinkSync(audioPath);

      // Queue polling job (if no webhook)
      if (!webhookUrl) {
        await QStashQueue.scheduleJob({
          name: "poll-dubbing-status",
          payload: { videoId, dubbingId: dubbingJob.dubbing_id },
          delay: 30, // Poll after 30 seconds
        });
      }
    } catch (error) {
      logger.error(`Dubbing pipeline error for video ${videoId}:`, error);

      // Mark video as dubbing failed
      await VideoModel.updateOne(
        { _id: videoId },
        { dubbingStatus: "failed", dubbingError: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Poll for dubbing job completion
   */
  static async pollDubbingStatus(
    videoId: string,
    dubbingId: string,
    retryCount: number = 0
  ): Promise<void> {
    const MAX_RETRIES = 10; // Poll for ~5 min (30s intervals)
    const POLL_INTERVAL = 30; // seconds

    try {
      logger.info(`Polling dubbing status for ${dubbingId}`);

      const status = await elevenlabsClient.getDubbingStatus(dubbingId);

      logger.info(`Dubbing job ${dubbingId} status: ${status.status}`);

      if (status.status === "completed") {
        logger.info(`Dubbing complete: ${dubbingId}`);
        await this.processDubbedAudio(videoId, dubbingId);
      } else if (status.status === "failed") {
        logger.error(`Dubbing failed: ${dubbingId} - ${status.error}`);
        await VideoModel.updateOne(
          { _id: videoId },
          { dubbingStatus: "failed", dubbingError: status.error }
        );
      } else if (status.status === "processing") {
        if (retryCount < MAX_RETRIES) {
          logger.info(
            `Still processing, scheduling next poll (attempt ${retryCount + 1}/${MAX_RETRIES})`
          );

          // Schedule next poll
          await QStashQueue.scheduleJob({
            name: "poll-dubbing-status",
            payload: { videoId, dubbingId, retryCount: retryCount + 1 },
            delay: POLL_INTERVAL,
          });
        } else {
          logger.error(`Max retry attempts reached for ${dubbingId}`);
          await VideoModel.updateOne(
            { _id: videoId },
            { dubbingStatus: "timeout", dubbingError: "Processing timeout" }
          );
        }
      }
    } catch (error) {
      logger.error(`Polling error for ${dubbingId}:`, error);

      // Retry polling on transient errors
      if (retryCount < MAX_RETRIES) {
        await QStashQueue.scheduleJob({
          name: "poll-dubbing-status",
          payload: { videoId, dubbingId, retryCount: retryCount + 1 },
          delay: POLL_INTERVAL,
        });
      }

      throw error;
    }
  }

  /**
   * Process dubbed audio and attach to Mux asset
   */
  static async processDubbedAudio(
    videoId: string,
    dubbingId: string
  ): Promise<void> {
    try {
      logger.info(`Processing dubbed audio for video ${videoId}`);

      const video = await VideoModel.findById(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      // Get dubbed audio files
      const audioFiles = await elevenlabsClient.getAllDubbedAudio(dubbingId);

      logger.info(`Downloaded ${audioFiles.length} dubbed audio files`);

      // Upload to R2 and attach to Mux
      const muxClient = new MuxClient();
      const storage = new StorageService();

      for (const audio of audioFiles) {
        const language = audio.language;
        logger.info(`Processing ${language} audio`);

        // Upload to R2
        const r2Path = `videos/${videoId}/dubbing/${language}.aac`;
        const uploadResult = await storage.uploadFromUrl(
          audio.audio_url,
          r2Path
        );

        logger.info(`Uploaded ${language} audio to R2: ${r2Path}`);

        // Create Mux audio track
        const trackResponse = await muxClient.createAssetTrack({
          assetId: video.muxAssetId,
          type: "audio",
          language: this.getIso639Code(language),
          name: `${this.getLanguageName(language)} (Dubbed)`,
          url: uploadResult.url,
        });

        logger.info(
          `Created Mux audio track for ${language}: ${trackResponse.id}`
        );

        // Update video record
        await VideoModel.updateOne(
          { _id: videoId },
          {
            $set: {
              [`dubbingTracks.${language}`]: {
                trackId: trackResponse.id,
                r2Path,
                status: "completed",
                duration: audio.duration,
                fileSize: audio.file_size,
              },
            },
          }
        );
      }

      // Mark dubbing complete
      await VideoModel.updateOne(
        { _id: videoId },
        { dubbingStatus: "completed" }
      );

      // Update DubbingJob record
      await DubbingJobModel.updateOne(
        { dubbingId },
        { status: "completed", completedAt: new Date() }
      );

      logger.info(`Dubbing pipeline complete for video ${videoId}`);

      // Send notification to user
      await this.notifyDubbingComplete(videoId);
    } catch (error) {
      logger.error(`Processing dubbed audio error for ${videoId}:`, error);

      await VideoModel.updateOne(
        { _id: videoId },
        {
          dubbingStatus: "processing_failed",
          dubbingError: (error as Error).message,
        }
      );

      throw error;
    }
  }

  /**
   * Webhook handler for ElevenLabs completion
   */
  static async handleWebhook(payload: any, signature: string): Promise<void> {
    try {
      // Validate webhook signature
      const isValid = elevenlabsClient.validateWebhookSignature(
        JSON.stringify(payload),
        signature,
        process.env.ELEVENLABS_WEBHOOK_SECRET!
      );

      if (!isValid) {
        throw new Error("Invalid webhook signature");
      }

      const { dubbing_id, status } = payload;

      logger.info(`Webhook received for dubbing ${dubbing_id}: ${status}`);

      // Find video by dubbing ID
      const dubbingJob = await DubbingJobModel.findOne({
        dubbingId: dubbing_id,
      });
      if (!dubbingJob) {
        throw new Error(`Dubbing job not found: ${dubbing_id}`);
      }

      if (status === "completed") {
        await this.processDubbedAudio(dubbingJob.videoId, dubbing_id);
      } else if (status === "failed") {
        await VideoModel.updateOne(
          { _id: dubbingJob.videoId },
          {
            dubbingStatus: "failed",
            dubbingError: payload.error || "Unknown error",
          }
        );
      }
    } catch (error) {
      logger.error("Webhook processing error:", error);
      throw error;
    }
  }

  // Helper methods
  private static getLanguageName(code: string): string {
    const names: Record<string, string> = {
      es: "Spanish",
      fr: "French",
      ru: "Russian",
    };
    return names[code] || code;
  }

  private static getIso639Code(code: string): string {
    return code; // 'es', 'fr', 'ru' are already ISO 639-1 codes
  }

  private static async notifyDubbingComplete(videoId: string): Promise<void> {
    // TODO: Send notification to mentor via email/in-app
    logger.info(`Notification sent for completed dubbing: ${videoId}`);
  }
}
```

### API Endpoints

**pages/api/videos/[videoId]/dubbing/initiate.ts:**

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@lib/auth";
import { DubbingPipeline } from "@services/dubbing";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const user = await getAuth(req);
    if (!user || user.role !== "mentor") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { videoId } = req.query;
    const { dubbingLanguages } = req.body;

    if (!videoId || !Array.isArray(dubbingLanguages)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Validate languages
    const validLanguages = ["es", "fr", "ru"];
    const invalid = dubbingLanguages.filter((l) => !validLanguages.includes(l));
    if (invalid.length > 0) {
      return res
        .status(400)
        .json({ message: `Invalid languages: ${invalid.join(", ")}` });
    }

    // Get video details
    const video = await VideoModel.findById(videoId);
    if (!video || video.mentorId !== user.id) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Initiate dubbing
    const webhookUrl = `${process.env.API_BASE_URL}/api/webhooks/elevenlabs`;

    await DubbingPipeline.initiateDubbing({
      videoId: videoId as string,
      videoPath: video.storageUrl,
      dubbingLanguages,
      webhookUrl,
    });

    return res
      .status(202)
      .json({ message: "Dubbing initiated", dubbingLanguages });
  } catch (error) {
    console.error("Dubbing initiation error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
```

**pages/api/videos/[videoId]/dubbing/status.ts:**

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@lib/auth";
import { VideoModel } from "@models";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const user = await getAuth(req);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { videoId } = req.query;

    const video = await VideoModel.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Return dubbing status
    return res.status(200).json({
      videoId,
      dubbingStatus: video.dubbingStatus,
      dubbingTracks: video.dubbingTracks || {},
      dubbingError: video.dubbingError,
    });
  } catch (error) {
    console.error("Error getting dubbing status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
```

**pages/api/webhooks/elevenlabs.ts:**

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { DubbingPipeline } from "@services/dubbing";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const signature = req.headers["x-elevenlabs-signature"] as string;

    if (!signature) {
      return res.status(400).json({ message: "Missing signature" });
    }

    await DubbingPipeline.handleWebhook(req.body, signature);

    return res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
```

### QStash Job Handler

**jobs/dubbing-jobs.ts:**

```typescript
import { Client } from "@upstash/qstash";
import { DubbingPipeline } from "@services/dubbing";
import { logger } from "@lib/logger";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// Register job handlers
export const registerDubbingJobs = () => {
  // Initiate dubbing job
  qstash.receiver.receive({
    url: `${process.env.API_BASE_URL}/api/jobs/initiate-dubbing`,
    handler: async (payload: any) => {
      try {
        await DubbingPipeline.initiateDubbing(payload);
      } catch (error) {
        logger.error("Initiate dubbing job error:", error);
        throw error;
      }
    },
  });

  // Poll dubbing status job
  qstash.receiver.receive({
    url: `${process.env.API_BASE_URL}/api/jobs/poll-dubbing-status`,
    handler: async (payload: any) => {
      try {
        const { videoId, dubbingId, retryCount } = payload;
        await DubbingPipeline.pollDubbingStatus(videoId, dubbingId, retryCount);
      } catch (error) {
        logger.error("Poll dubbing status job error:", error);
        throw error;
      }
    },
  });
};
```

## Implementation Order

1. Set up ElevenLabs API client and authentication
2. Implement video processor for audio extraction
3. Implement dubbing pipeline core logic
4. Set up QStash for background job processing
5. Create API endpoints for initiation and status
6. Implement webhook handler with signature validation
7. Create polling mechanism as fallback
8. Test with sample video uploads
9. Verify dubbed audio quality
10. Implement error handling and retry logic
11. Add admin dashboard for dubbing status
12. Implement user notifications for completion
13. Create monitoring and logging system
14. Document API for mentors
