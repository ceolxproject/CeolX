# Mobile DRM Implementation

## Description

Implement DRM content protection for video playback with Widevine L1 on Android (via react-native-video) and FairPlay on iOS (via expo-av), including license request handling, certificate loading, fallback behavior for free content, and offline playback restrictions per DRM policy.

## Affected Apps/Packages

- `apps/mobile/src/components/video/VideoPlayer.tsx` (updated)
- `packages/shared/src/services/drmService.ts` (new)

## Requirements

### 1. DRM Service

File: `packages/shared/src/services/drmService.ts`

Manage DRM configuration and license requests:

```typescript
import axios from "axios";
import { Platform } from "react-native";

export interface DrmConfig {
  type: "widevine" | "fairplay";
  licenseUrl: string;
  certificateUrl?: string; // iOS only
  headers?: Record<string, string>;
  customHeaders?: Record<string, string>;
}

export interface WidevineConfig extends DrmConfig {
  type: "widevine";
  licenseUrl: string;
  customData?: string; // base64 encoded custom data
}

export interface FairplayConfig extends DrmConfig {
  type: "fairplay";
  licenseUrl: string;
  certificateUrl: string;
}

export class DrmService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async getDrmConfig(videoId: string): Promise<DrmConfig | null> {
    try {
      const { data } = await this.api.get(`/videos/${videoId}/drm-config`);

      if (!data.drmConfig) {
        // No DRM required (free content)
        return null;
      }

      const config = data.drmConfig;

      // Return platform-specific config
      if (Platform.OS === "android") {
        return this.getWidevineConfig(config);
      } else if (Platform.OS === "ios") {
        return this.getFairplayConfig(config);
      }

      return null;
    } catch (error) {
      console.error("Failed to get DRM config:", error);
      return null;
    }
  }

  private getWidevineConfig(config: any): WidevineConfig {
    return {
      type: "widevine",
      licenseUrl: config.widevine.licenseUrl,
      customData: config.widevine.customData,
      headers: {
        "X-AxDRM-Message": config.widevine.axDrmMessage,
      },
    };
  }

  private getFairplayConfig(config: any): FairplayConfig {
    return {
      type: "fairplay",
      licenseUrl: config.fairplay.licenseUrl,
      certificateUrl: config.fairplay.certificateUrl,
      customHeaders: {
        "X-Custom-Auth": config.fairplay.customAuth,
      },
    };
  }

  async requestWidevineL1License(
    challengeBase64: string,
    videoId: string
  ): Promise<ArrayBuffer> {
    try {
      const { data } = await this.api.post(
        `/videos/${videoId}/drm/widevine-license`,
        {
          challenge: challengeBase64,
        }
      );

      // Convert base64 license to ArrayBuffer
      return this.base64ToArrayBuffer(data.license);
    } catch (error) {
      console.error("Widevine license request failed:", error);
      throw error;
    }
  }

  async requestFairplayLicense(
    spcData: ArrayBuffer,
    videoId: string
  ): Promise<ArrayBuffer> {
    try {
      const spcBase64 = this.arrayBufferToBase64(spcData);

      const { data } = await this.api.post(
        `/videos/${videoId}/drm/fairplay-license`,
        {
          spc: spcBase64,
        }
      );

      // Convert base64 CKC to ArrayBuffer
      return this.base64ToArrayBuffer(data.ckc);
    } catch (error) {
      console.error("FairPlay license request failed:", error);
      throw error;
    }
  }

  async requestFairplayCertificate(videoId: string): Promise<ArrayBuffer> {
    try {
      const { data } = await this.api.get(
        `/videos/${videoId}/drm/fairplay-certificate`,
        {
          responseType: "arraybuffer",
        }
      );

      return data;
    } catch (error) {
      console.error("FairPlay certificate request failed:", error);
      throw error;
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  // Check if content is DRM protected
  async isDrmProtected(videoId: string): Promise<boolean> {
    try {
      const config = await this.getDrmConfig(videoId);
      return config !== null;
    } catch {
      return false;
    }
  }

  // Check if offline playback allowed
  async canPlayOffline(videoId: string): Promise<boolean> {
    try {
      const { data } = await this.api.get(
        `/videos/${videoId}/drm/offline-rights`
      );

      return data.canPlayOffline === true;
    } catch {
      return false; // Default: no offline playback
    }
  }
}

export const drmService = new DrmService();
```

### 2. Updated Video Player with DRM

File: `src/components/video/VideoPlayer.tsx` (DRM-specific parts)

```typescript
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Video as ExpoVideo } from 'expo-av';
import { Video } from 'react-native-video';
import { Platform, View, Text, StyleSheet } from 'react-native';

interface DrmConfig {
  type: 'widevine' | 'fairplay';
  licenseUrl: string;
  certificateUrl?: string;
}

interface VideoPlayerProps {
  source: string;
  drmConfig?: DrmConfig;
  onPlaybackStatusUpdate?: (status: any) => void;
  onError?: (error: string) => void;
  resumePosition?: number;
}

export const VideoPlayer = forwardRef<any, VideoPlayerProps>(
  (
    {
      source,
      drmConfig,
      onPlaybackStatusUpdate,
      onError,
      resumePosition = 0,
    },
    ref
  ) => {
    const videoRef = useRef<any>(null);
    const [drmError, setDrmError] = React.useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getCurrentPosition: async () => {
        if (Platform.OS === 'ios') {
          const status = await videoRef.current?.getStatusAsync();
          return status?.positionMillis || 0;
        } else {
          // Android
          return videoRef.current?.currentTime || 0;
        }
      },
      getDuration: async () => {
        if (Platform.OS === 'ios') {
          const status = await videoRef.current?.getStatusAsync();
          return status?.durationMillis || 0;
        } else {
          return videoRef.current?.duration || 0;
        }
      },
      seek: (position: number) => {
        if (Platform.OS === 'ios') {
          videoRef.current?.seekAsync(position);
        } else {
          videoRef.current?.seek(position / 1000); // Convert to seconds for Android
        }
      },
      setPlaybackRate: (rate: number) => {
        if (Platform.OS === 'ios') {
          videoRef.current?.setRateAsync(rate);
        } else {
          videoRef.current?.setRate(rate);
        }
      },
    }));

    // iOS with FairPlay DRM
    if (Platform.OS === 'ios' && drmConfig?.type === 'fairplay') {
      return (
        <ExpoVideo
          ref={videoRef}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          useNativeControls
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onError={(error) => {
            handleDrmError(error, 'FairPlay');
          }}
          progressUpdateIntervalMillis={500}
          shouldPlay={false}
          resizeMode="contain"
          // DRM Configuration
          onLoadStart={async () => {
            try {
              // FairPlay setup happens automatically with proper HTTP headers
              // Certificate URL should be in response headers
            } catch (error) {
              setDrmError('Failed to initialize FairPlay');
            }
          }}
        />
      );
    }

    // Android with Widevine DRM
    if (Platform.OS === 'android' && drmConfig?.type === 'widevine') {
      return (
        <Video
          ref={videoRef}
          source={{
            uri: source,
            // Widevine DRM Configuration
            drm: {
              type: 'widevine',
              licenseServer: drmConfig.licenseUrl,
              headers: {
                'X-AxDRM-Message': drmConfig.customData,
              },
            },
          }}
          style={StyleSheet.absoluteFill}
          controls={true}
          onProgress={({ currentTime, duration }) => {
            onPlaybackStatusUpdate?.({
              positionMillis: currentTime * 1000,
              durationMillis: duration * 1000,
            });
          }}
          onError={(error) => {
            handleDrmError(error, 'Widevine');
          }}
          onLoad={() => {
            if (resumePosition > 0) {
              videoRef.current?.seek(resumePosition / 1000);
            }
          }}
          onEnd={() => {
            onPlaybackStatusUpdate?.({ didJustFinish: true });
          }}
          progressUpdateInterval={500}
          paused={true}
          resizeMode="contain"
        />
      );
    }

    // No DRM - standard playback
    if (Platform.OS === 'ios') {
      return (
        <ExpoVideo
          ref={videoRef}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          useNativeControls
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onError={(error) => onError?.(error.toString())}
          progressUpdateIntervalMillis={500}
          shouldPlay={false}
          resizeMode="contain"
        />
      );
    }

    // Android without DRM
    return (
      <Video
        ref={videoRef}
        source={{ uri: source }}
        style={StyleSheet.absoluteFill}
        controls={true}
        onProgress={({ currentTime, duration }) => {
          onPlaybackStatusUpdate?.({
            positionMillis: currentTime * 1000,
            durationMillis: duration * 1000,
          });
        }}
        onError={(error) => onError?.(error.toString())}
        progressUpdateInterval={500}
        paused={true}
        resizeMode="contain"
      />
    );
  }
);

function handleDrmError(error: any, type: 'widevine' | 'FairPlay') {
  const errorMessage = `${type} playback error: ${error?.message || 'Unknown error'}`;

  // Handle specific DRM errors
  if (error?.code === -4154) {
    // DRM not supported
    console.error('DRM not supported on this device');
  } else if (error?.code === -4155) {
    // License server error
    console.error('License server error');
  } else if (error?.code === -4156) {
    // Device not provisioned
    console.error('Device not provisioned for DRM');
  }

  throw new Error(errorMessage);
}

export default VideoPlayer;
```

### 3. Widevine L1 Check (Android)

File: `src/utils/drmUtils.ts`

Verify device DRM capability:

```typescript
import { Platform } from "react-native";

// Note: react-native-video provides DRM capability detection
// This is a utility for checking support

export async function checkDrmSupport(): Promise<{
  widevine: boolean;
  fairplay: boolean;
}> {
  return {
    widevine: Platform.OS === "android",
    fairplay: Platform.OS === "ios",
  };
}

export async function checkWidevineLevel(): Promise<
  "L1" | "L2" | "L3" | "none"
> {
  // On Android, Widevine L1 is available on most modern devices
  // L2 available on devices without L1
  // L3 is software-based fallback

  if (Platform.OS !== "android") {
    return "none";
  }

  try {
    // Check device's DRM level
    // Most modern phones support L1
    // Tablets may support L2/L3
    // This would require native module for accurate detection

    return "L1"; // Default assumption for modern Android devices
  } catch {
    return "none";
  }
}

export async function checkFairplaySupport(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    return false;
  }

  try {
    // FairPlay available on iOS 8+
    return true;
  } catch {
    return false;
  }
}
```

### 4. DRM Error Handling

File: `src/services/drmErrorHandler.ts`

Handle DRM-specific errors:

```typescript
export enum DrmErrorCode {
  LICENSE_REQUEST_FAILED = "LICENSE_REQUEST_FAILED",
  LICENSE_EXPIRED = "LICENSE_EXPIRED",
  DEVICE_NOT_PROVISIONED = "DEVICE_NOT_PROVISIONED",
  DRM_NOT_SUPPORTED = "DRM_NOT_SUPPORTED",
  CERTIFICATE_LOAD_FAILED = "CERTIFICATE_LOAD_FAILED",
  OFFLINE_NOT_ALLOWED = "OFFLINE_NOT_ALLOWED",
  PLAYBACK_NOT_ALLOWED = "PLAYBACK_NOT_ALLOWED",
}

export class DrmError extends Error {
  constructor(
    public code: DrmErrorCode,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = "DrmError";
  }
}

export function handleDrmError(error: any): DrmError {
  // Identify error type and return appropriate DrmError

  if (error?.code === -4154) {
    return new DrmError(
      DrmErrorCode.DRM_NOT_SUPPORTED,
      "DRM is not supported on this device",
      error
    );
  }

  if (error?.code === -4155) {
    return new DrmError(
      DrmErrorCode.LICENSE_REQUEST_FAILED,
      "Failed to request DRM license from server",
      error
    );
  }

  if (error?.code === -4156) {
    return new DrmError(
      DrmErrorCode.DEVICE_NOT_PROVISIONED,
      "Device is not provisioned for DRM playback",
      error
    );
  }

  if (error?.message?.includes("License expired")) {
    return new DrmError(
      DrmErrorCode.LICENSE_EXPIRED,
      "DRM license has expired",
      error
    );
  }

  if (error?.message?.includes("offline")) {
    return new DrmError(
      DrmErrorCode.OFFLINE_NOT_ALLOWED,
      "This content cannot be played offline",
      error
    );
  }

  return new DrmError(
    DrmErrorCode.PLAYBACK_NOT_ALLOWED,
    "Content playback is not allowed",
    error
  );
}

export function getUserFriendlyMessage(error: DrmError): string {
  switch (error.code) {
    case DrmErrorCode.DRM_NOT_SUPPORTED:
      return "This content requires DRM protection not supported on your device";

    case DrmErrorCode.LICENSE_REQUEST_FAILED:
      return "Failed to load the video. Please check your internet connection and try again";

    case DrmErrorCode.DEVICE_NOT_PROVISIONED:
      return "Your device is not authorized to play this content";

    case DrmErrorCode.LICENSE_EXPIRED:
      return "Your playback license has expired. Please try again";

    case DrmErrorCode.OFFLINE_NOT_ALLOWED:
      return "This content cannot be downloaded for offline viewing";

    case DrmErrorCode.PLAYBACK_NOT_ALLOWED:
      return "You do not have permission to play this content";

    default:
      return "Video playback failed. Please try again later";
  }
}
```

### 5. Offline Playback Restrictions

File: `src/services/offlinePlaybackService.ts`

Handle DRM offline restrictions:

```typescript
export class OfflinePlaybackService {
  async canDownloadForOffline(videoId: string): Promise<boolean> {
    try {
      // Check backend for offline rights
      return await drmService.canPlayOffline(videoId);
    } catch {
      return false;
    }
  }

  async downloadVideoForOffline(
    videoId: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const canPlay = await this.canDownloadForOffline(videoId);

    if (!canPlay) {
      throw new DrmError(
        DrmErrorCode.OFFLINE_NOT_ALLOWED,
        "This video cannot be downloaded for offline playback"
      );
    }

    // Download video with progress tracking
    // Implementation depends on platform capabilities
  }

  async playOfflineVideo(videoId: string, localPath: string): Promise<void> {
    const canPlay = await this.canDownloadForOffline(videoId);

    if (!canPlay) {
      throw new DrmError(
        DrmErrorCode.OFFLINE_NOT_ALLOWED,
        "This video requires internet connection to play"
      );
    }

    // Play video from local path
  }
}
```

## Acceptance Criteria

- [ ] Widevine L1 DRM works on Android devices
- [ ] FairPlay DRM works on iOS devices
- [ ] Free content plays without DRM
- [ ] License requests succeed with correct headers
- [ ] Certificate loading works on iOS
- [ ] Custom data sent with license requests
- [ ] DRM errors show user-friendly messages
- [ ] Offline playback restricted per DRM policy
- [ ] Device provisioning verified
- [ ] License expiration handled
- [ ] Fallback behavior for unsupported devices
- [ ] No console errors during playback
- [ ] Performance impact minimal
- [ ] Works on both simulator and real device

## Dependencies

- expo-av (iOS video player)
- react-native-video (Android with DRM)
- axios (license requests)

## Technical Notes

### Widevine Requirements

- Android 4.1+ (API 16+)
- L1: Modern Android devices (2016+)
- L2/L3: Fallback for older devices
- License server must support Widevine protocol

### FairPlay Requirements

- iOS 8+
- Certificate URL required
- Custom headers for authentication
- SPC/CKC exchange protocol

### License Caching

- Cache licenses locally (encrypted)
- Reduce server load
- Improve playback startup
- Respect license TTL

### Error Recovery

- Retry license requests on failure
- Fallback to lower Widevine level
- Show meaningful error messages
- Provide offline fallback when possible

### Testing

```bash
# Test Widevine on Android
# Use chrome://media-internals to verify license

# Test FairPlay on iOS
# Use Safari developer tools
```
