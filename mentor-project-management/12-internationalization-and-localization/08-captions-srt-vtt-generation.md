# Task: Generate and Attach Localized Caption Tracks

## Description

Implement caption pipeline to generate EN transcripts from Mux auto-transcription, translate to ES/FR/RU using ElevenLabs or translation service, convert to VTT format, and upload to Mux as text tracks. Captions must be independently selectable from audio tracks, synchronized with video, and support all 4 languages. Ensure accurate timing, proper formatting, and accessibility compliance (WCAG 2.1 Level AA).

## Affected Apps/Packages

- `services/transcription` (Mux auto-transcription handling)
- `services/translation` (Caption translation)
- `services/storage` (Caption file storage)
- `packages/video-player` (Caption display)
- `services/mux` (Text track attachment)

## Requirements

### Transcription Pipeline

- Extract captions from Mux auto-transcription API
- Generate SRT and VTT files from transcription
- Preserve speaker timing and accuracy
- Support multiple speaker detection
- Clean up transcription errors (speech-to-text artifacts)

### Translation Process

- Translate EN transcriptions to ES, FR, RU
- Use ElevenLabs Translation API or Google Translate API
- Maintain timing/sync with original
- Keep proper punctuation and formatting
- Review translations for accuracy

### Caption Format

- VTT (WebVTT) primary format for web and mobile
- SRT format optional (alternative compatibility)
- Proper timing format: `HH:MM:SS.mmm --> HH:MM:SS.mmm`
- Max 2 lines per subtitle, 42 characters per line
- UTF-8 encoding with BOM

### Mux Integration

- Create text tracks via Mux Create Asset Track API
- Language code: ISO 639-1 (en, es, fr, ru)
- Track type: captions (not subtitles)
- Passthrough ID: Include job reference
- Status polling until ready

### Caption Accessibility

- WCAG 2.1 Level AA compliance
- Proper color contrast for caption text
- Font sizing responsive to video size
- Option to disable captions
- Support for caption positioning
- Keyboard navigation for caption control

### Player Integration

- Caption selector in Mux Player
- Independent from audio track selection
- Show/hide toggle
- Language preference persistence
- Default: Captions in viewer's language if available, else EN

## Acceptance Criteria

- [ ] Mux auto-transcription API integrated
- [ ] EN transcripts extracted and formatted as VTT
- [ ] ES/FR/RU translations generated
- [ ] VTT files with proper timing and formatting
- [ ] Caption files uploaded to Mux as text tracks
- [ ] Mux Player caption selector functional
- [ ] Captions synchronized with audio/video
- [ ] Captions independently selectable from audio
- [ ] Max 2 lines, 42 chars per line enforced
- [ ] WCAG 2.1 Level AA compliance verified
- [ ] Mobile caption display working
- [ ] Caption preference persisted
- [ ] SRT format available for download
- [ ] Error handling for transcription failures
- [ ] Translation quality review process

## Dependencies

- Video uploaded to Mux with playback ID
- Mux auto-transcription enabled on asset
- Translation service API access (ElevenLabs or Google)
- Caption styling CSS available

## Technical Notes

### Transcription Service

**services/transcription/mux-transcription.ts:**

```typescript
import Mux from "@mux/mux-node";

export interface Transcription {
  text: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number;
}

export interface TranscriptionResponse {
  language: string;
  text: string;
  lines: Transcription[];
}

export class MuxTranscriptionService {
  private mux: Mux;

  constructor() {
    this.mux = new Mux({
      accessTokenId: process.env.MUX_TOKEN_ID!,
      accessTokenSecret: process.env.MUX_TOKEN_SECRET!,
    });
  }

  /**
   * Get captions/transcription from Mux asset
   */
  async getTranscription(assetId: string): Promise<TranscriptionResponse> {
    try {
      const asset = await this.mux.video.assets.retrieve(assetId);

      // Check if captions track exists
      const captionTrack = asset.tracks?.find(
        (t) => t.type === "text" && t.text_type === "captions"
      );

      if (!captionTrack) {
        throw new Error(
          "No captions found. Enable auto-transcription on asset."
        );
      }

      // Get caption file
      const vttResponse = await fetch(captionTrack.url);
      if (!vttResponse.ok) {
        throw new Error("Failed to fetch caption file");
      }

      const vttText = await vttResponse.text();
      const transcription = this.parseVTT(vttText);

      return {
        language: "en",
        text: transcription.map((t) => t.text).join(" "),
        lines: transcription,
      };
    } catch (error) {
      console.error("Failed to get transcription:", error);
      throw error;
    }
  }

  /**
   * Parse VTT format to structured data
   */
  private parseVTT(vttText: string): Transcription[] {
    const lines = vttText.split("\n");
    const captions: Transcription[] = [];

    let i = 0;
    while (i < lines.length) {
      // Skip header and empty lines
      if (
        lines[i].startsWith("WEBVTT") ||
        lines[i].trim() === "" ||
        lines[i].startsWith("NOTE ")
      ) {
        i++;
        continue;
      }

      // Parse timing line
      const timingMatch = lines[i].match(
        /(\d{2}:)?(\d{2}):(\d{2}\.\d{3}) --> (\d{2}:)?(\d{2}):(\d{2}\.\d{3})/
      );

      if (timingMatch) {
        const startTime = this.timeToSeconds(timingMatch[0].split(" --> ")[0]);
        const endTime = this.timeToSeconds(timingMatch[0].split(" --> ")[1]);

        let captionText = "";
        i++;

        // Collect caption text lines
        while (
          i < lines.length &&
          lines[i].trim() !== "" &&
          !lines[i].includes("-->")
        ) {
          if (captionText) captionText += "\n";
          captionText += lines[i];
          i++;
        }

        if (captionText) {
          captions.push({
            text: captionText.trim(),
            start: startTime,
            end: endTime,
            confidence: 1.0,
          });
        }
      } else {
        i++;
      }
    }

    return captions;
  }

  /**
   * Convert time format to seconds
   */
  private timeToSeconds(timeStr: string): number {
    const parts = timeStr.split(":");
    let seconds = 0;

    if (parts.length === 3) {
      seconds += parseInt(parts[0]) * 3600; // hours
      seconds += parseInt(parts[1]) * 60; // minutes
      seconds += parseFloat(parts[2]); // seconds
    } else if (parts.length === 2) {
      seconds += parseInt(parts[0]) * 60; // minutes
      seconds += parseFloat(parts[1]); // seconds
    }

    return seconds;
  }
}

export const transcriptionService = new MuxTranscriptionService();
```

### Caption Translation

**services/translation/caption-translator.ts:**

```typescript
import { GoogleTranslate } from "@services/google-translate";
import { Transcription } from "@services/transcription";

export interface CaptionTranslationRequest {
  lines: Transcription[];
  targetLanguage: "es" | "fr" | "ru";
  sourceLanguage?: "en";
}

export class CaptionTranslator {
  private translator = new GoogleTranslate();

  /**
   * Translate caption lines preserving timing
   */
  async translateCaptions(
    request: CaptionTranslationRequest
  ): Promise<Transcription[]> {
    const { lines, targetLanguage } = request;

    try {
      console.log(
        `Translating ${lines.length} caption lines to ${targetLanguage}`
      );

      // Translate text while preserving timing
      const texts = lines.map((line) => line.text);
      const translations = await this.translator.translateBatch(
        texts,
        "en",
        this.getGoogleLanguageCode(targetLanguage)
      );

      // Map translations back to caption lines
      const translatedLines = lines.map((line, index) => ({
        ...line,
        text: translations[index],
      }));

      return translatedLines;
    } catch (error) {
      console.error("Caption translation error:", error);
      throw error;
    }
  }

  /**
   * Validate caption line length (max 42 chars, 2 lines)
   */
  validateCaptionLine(text: string): { valid: boolean; error?: string } {
    const lines = text.split("\n");

    if (lines.length > 2) {
      return {
        valid: false,
        error: `Caption has ${lines.length} lines, max 2 allowed`,
      };
    }

    for (const line of lines) {
      if (line.length > 42) {
        return {
          valid: false,
          error: `Line "${line}" exceeds 42 characters (${line.length})`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Reflow caption lines to fit constraints
   */
  reflowCaptions(lines: Transcription[]): Transcription[] {
    return lines.map((line) => {
      let text = line.text;
      const validation = this.validateCaptionLine(text);

      if (!validation.valid) {
        // Try to split long lines
        const words = text.split(" ");
        const newLines: string[] = [];
        let currentLine = "";

        for (const word of words) {
          if ((currentLine + " " + word).length > 42) {
            if (currentLine) newLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = currentLine ? currentLine + " " + word : word;
          }
        }

        if (currentLine) newLines.push(currentLine);

        // Take max 2 lines
        text = newLines.slice(0, 2).join("\n");
      }

      return { ...line, text };
    });
  }

  private getGoogleLanguageCode(lang: "es" | "fr" | "ru"): string {
    const codes: Record<string, string> = {
      es: "es",
      fr: "fr",
      ru: "ru",
    };
    return codes[lang];
  }
}

export const captionTranslator = new CaptionTranslator();
```

### Caption File Generation

**services/caption/caption-generator.ts:**

```typescript
import { Transcription } from "@services/transcription";
import fs from "fs";
import path from "path";

export class CaptionGenerator {
  /**
   * Generate VTT file from transcription
   */
  generateVTT(lines: Transcription[], language: string = "en"): string {
    let vtt = "WEBVTT\n\n";

    // Add metadata
    vtt += `NOTE Language: ${language}\n`;
    vtt += `NOTE Generated: ${new Date().toISOString()}\n\n`;

    // Add captions
    for (const line of lines) {
      const start = this.formatTime(line.start);
      const end = this.formatTime(line.end);

      vtt += `${start} --> ${end}\n`;
      vtt += `${line.text}\n\n`;
    }

    return vtt;
  }

  /**
   * Generate SRT file from transcription
   */
  generateSRT(lines: Transcription[], language: string = "en"): string {
    let srt = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const start = this.formatTimeSRT(line.start);
      const end = this.formatTimeSRT(line.end);

      srt += `${i + 1}\n`;
      srt += `${start} --> ${end}\n`;
      srt += `${line.text}\n\n`;
    }

    return srt;
  }

  /**
   * Save caption file
   */
  async saveCaptionFile(
    content: string,
    videoId: string,
    language: string,
    format: "vtt" | "srt" = "vtt"
  ): Promise<string> {
    const filename = `${videoId}-${language}.${format}`;
    const filepath = path.join(process.env.CAPTIONS_DIR || "/tmp", filename);

    fs.writeFileSync(filepath, content, "utf-8");

    console.log(`Saved caption file: ${filepath}`);
    return filepath;
  }

  /**
   * Format time for VTT (HH:MM:SS.mmm)
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const h = String(hours).padStart(2, "0");
    const m = String(minutes).padStart(2, "0");
    const s = secs.toFixed(3).padStart(6, "0");

    return `${h}:${m}:${s}`;
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private formatTimeSRT(seconds: number): string {
    return this.formatTime(seconds).replace(".", ",");
  }
}

export const captionGenerator = new CaptionGenerator();
```

### Caption Pipeline Integration

**services/caption/caption-pipeline.ts:**

```typescript
import { transcriptionService } from "@services/transcription";
import { captionTranslator } from "@services/translation";
import { captionGenerator } from "./caption-generator";
import { StorageService } from "@services/storage";
import { MuxClient } from "@services/mux";
import { VideoModel } from "@models";
import { logger } from "@lib/logger";

export class CaptionPipeline {
  /**
   * Generate captions for all languages
   */
  static async generateCaptions(videoId: string): Promise<void> {
    try {
      logger.info(`Starting caption generation for video ${videoId}`);

      const video = await VideoModel.findById(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      // Get English transcription
      logger.info("Extracting English transcription from Mux");
      const enTranscription = await transcriptionService.getTranscription(
        video.muxAssetId
      );

      // Generate EN VTT
      logger.info("Generating English VTT");
      const enVTT = captionGenerator.generateVTT(enTranscription.lines, "en");
      const enPath = await captionGenerator.saveCaptionFile(
        enVTT,
        videoId,
        "en",
        "vtt"
      );

      // Upload EN captions to R2
      const storage = new StorageService();
      const enR2Path = `videos/${videoId}/captions/en.vtt`;
      const enUrl = await storage.uploadFile(enPath, enR2Path);

      logger.info(`Uploaded EN captions to R2: ${enR2Path}`);

      // Translate to other languages
      const languages = ["es", "fr", "ru"] as const;

      for (const lang of languages) {
        try {
          logger.info(`Translating captions to ${lang}`);

          const translated = await captionTranslator.translateCaptions({
            lines: enTranscription.lines,
            targetLanguage: lang,
          });

          // Reflow captions to fit display constraints
          const reflowed = captionTranslator.reflowCaptions(translated);

          // Generate VTT
          const vtt = captionGenerator.generateVTT(reflowed, lang);
          const filepath = await captionGenerator.saveCaptionFile(
            vtt,
            videoId,
            lang,
            "vtt"
          );

          // Upload to R2
          const r2Path = `videos/${videoId}/captions/${lang}.vtt`;
          const url = await storage.uploadFile(filepath, r2Path);

          logger.info(`Uploaded ${lang} captions to R2: ${r2Path}`);

          // Update video record
          await VideoModel.updateOne(
            { _id: videoId },
            {
              $set: {
                [`captionTracks.${lang}`]: {
                  r2Path,
                  url,
                  status: "completed",
                },
              },
            }
          );
        } catch (error) {
          logger.error(`Failed to generate ${lang} captions:`, error);
          // Continue with other languages
        }
      }

      // Attach captions to Mux
      logger.info("Attaching caption tracks to Mux");
      await this.attachCaptionsToMux(videoId, video.muxAssetId);

      logger.info(`Caption generation complete for video ${videoId}`);
    } catch (error) {
      logger.error(`Caption pipeline error for video ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Attach caption VTT files to Mux asset
   */
  private static async attachCaptionsToMux(
    videoId: string,
    muxAssetId: string
  ): Promise<void> {
    try {
      const video = await VideoModel.findById(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      const muxClient = new MuxClient();
      const languages = ["en", "es", "fr", "ru"] as const;

      for (const lang of languages) {
        const track = video.captionTracks?.[lang];
        if (!track || !track.url) {
          logger.warn(`No caption file found for ${lang}`);
          continue;
        }

        try {
          const muxTrack = await muxClient.createAssetTrack({
            assetId: muxAssetId,
            type: "text",
            language: lang,
            name: this.getCaptionLabel(lang),
            url: track.url,
            passthrough: `captions-${lang}`,
          });

          logger.info(`Created Mux caption track for ${lang}: ${muxTrack.id}`);

          // Update video record with Mux track ID
          await VideoModel.updateOne(
            { _id: videoId },
            {
              $set: {
                [`captionTracks.${lang}.muxTrackId`]: muxTrack.id,
              },
            }
          );
        } catch (error) {
          logger.error(`Failed to attach ${lang} captions to Mux:`, error);
        }
      }
    } catch (error) {
      logger.error("Error attaching captions to Mux:", error);
      throw error;
    }
  }

  private static getCaptionLabel(lang: string): string {
    const labels: Record<string, string> = {
      en: "English",
      es: "Español",
      fr: "Français",
      ru: "Русский",
    };
    return labels[lang] || lang;
  }
}

export const captionPipeline = new CaptionPipeline();
```

### Player Caption Styling

**packages/video-player/src/captions.css:**

```css
/* Mux Player Caption Styling */
mux-player::cue {
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 1rem;
  line-height: 1.4;
  padding: 0.25rem 0.5rem;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

mux-player::cue:past {
  color: rgba(255, 255, 255, 0.5);
}

/* Caption control styling */
.mux-player-caption-button {
  background-color: rgba(0, 0, 0, 0.7);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mux-player-caption-button:hover {
  background-color: rgba(0, 0, 0, 0.9);
  border-color: #fff;
}

.mux-player-caption-button.active {
  background-color: #6366f1;
  color: #fff;
}

/* WCAG 2.1 AA Compliance */
/* Ensure sufficient contrast (4.5:1 for normal text) */
@media (prefers-reduced-motion: reduce) {
  mux-player {
    animation: none !important;
  }
}

/* Support for high contrast mode */
@media (prefers-contrast: more) {
  mux-player::cue {
    background-color: rgba(0, 0, 0, 1);
    color: #fff;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
  }
}
```

### API Endpoint

**pages/api/videos/[videoId]/captions/generate.ts:**

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@lib/auth";
import { captionPipeline } from "@services/caption";
import { VideoModel } from "@models";

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

    const video = await VideoModel.findById(videoId);
    if (!video || video.mentorId !== user.id) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Queue caption generation
    await captionPipeline.generateCaptions(videoId as string);

    return res.status(202).json({
      message: "Caption generation started",
      videoId,
    });
  } catch (error) {
    console.error("Error generating captions:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
```

## Implementation Order

1. Implement Mux transcription service
2. Create caption translation service
3. Create caption file generator (VTT/SRT)
4. Implement caption validation and reflow
5. Build caption pipeline
6. Create API endpoints for caption generation
7. Test transcription extraction
8. Test caption translation accuracy
9. Test VTT file generation and timing
10. Test Mux text track attachment
11. Test caption display in player
12. Test caption selector functionality
13. Verify WCAG 2.1 Level AA compliance
14. Test mobile caption display
15. Implement caption download functionality
