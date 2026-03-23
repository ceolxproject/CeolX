# Monitoring & Alerting Setup

## Description

Comprehensive production monitoring and alerting infrastructure for Mentor platform. Covers error tracking (Sentry), uptime monitoring (BetterStack), web analytics (Vercel Analytics), video metrics (Mux Data), database monitoring (Neon), background job monitoring (QStash), and alert escalation rules. Ensures rapid issue detection and response during and after launch.

## Affected Systems

- **Hono API** (Vercel)
- **Learner Web** (Next.js)
- **Mentor Web** (Next.js)
- **Admin Web** (Next.js)
- **Learner Mobile** (React Native Expo)
- **Database** (Neon PostgreSQL)
- **Video Streaming** (Mux)
- **Background Jobs** (QStash)
- **Email Service** (SendGrid/SES)

## Requirements

### Monitoring Tools Setup

1. **Sentry** - Error/exception tracking
2. **BetterStack** - Uptime/health monitoring
3. **Vercel Analytics** - Web Vitals and performance
4. **Mux Data** - Video playback metrics
5. **Neon** - Database performance monitoring
6. **QStash** - Background job monitoring
7. **Datadog/New Relic** (optional) - Advanced APM

### Alert Channels

- **Slack** - Real-time notifications for team
- **Email** - Critical alerts, daily summaries
- **SMS** - Critical P1 incidents (on-call engineer)
- **PagerDuty** (optional) - Incident escalation

### Dashboard Access

- **Sentry Dashboard**: https://sentry.io/organizations/mentor/
- **BetterStack Dashboard**: https://uptime.betterstack.com/
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Mux Dashboard**: https://dashboard.mux.com/
- **Neon Dashboard**: https://console.neon.tech/

## Acceptance Criteria

- [ ] Sentry integration complete for all apps
- [ ] Error tracking working for web and mobile
- [ ] Slack alerts configured and tested
- [ ] BetterStack monitoring all critical endpoints
- [ ] Uptime monitoring alerting within 2 minutes
- [ ] Vercel Analytics tracking Web Vitals
- [ ] Mux Data dashboards displaying video metrics
- [ ] Database monitoring showing query performance
- [ ] QStash job monitoring setup complete
- [ ] All alert thresholds configured appropriately
- [ ] Escalation rules documented
- [ ] On-call rotation configured
- [ ] Runbook for common alerts documented
- [ ] Team trained on monitoring dashboards

## Technical Notes

### 1. Sentry Setup

**Install & Configure:**

```bash
# Install Sentry SDKs
npm install @sentry/react @sentry/nextjs @sentry/node
```

**Web Apps (Next.js):**

```typescript
// pages/_app.tsx or app.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  release: process.env.GIT_COMMIT_SHA || "1.0.0",
  beforeSend(event, hint) {
    // Filter out noisy errors
    if (event.exception) {
      const error = hint.originalException;
      // Ignore 404s from bots
      if (error?.statusCode === 404 && error?.isBot) {
        return null;
      }
    }
    return event;
  },
});
```

**API Routes (Hono):**

```typescript
// api/middleware/sentry.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  release: process.env.GIT_COMMIT_SHA,
});

// Use Sentry middleware
app.use("*", (c, next) => {
  return Sentry.captureAsyncStackTrace(
    async () => {
      try {
        return await next();
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    },
    (error) => {
      return {
        status: 500,
        body: { error: "Internal Server Error" },
      };
    }
  );
});
```

**Mobile App (React Native):**

```typescript
// App.ts
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://your-sentry-dsn",
  environment: "production",
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.ReactNativeTracing({
      enableNativeFramesTracking: true,
      enableStallTracking: true,
    }),
  ],
});

// Wrap app with error boundary
export default Sentry.withProfiler(App);
```

**Sentry Dashboard Configuration:**

1. Create project for each app (learner-web, mentor-web, api, mobile)
2. Configure alert rules:

   ```
   Rule: Error Rate Threshold
   Condition: Error rate > 0.1% in 5 minutes
   Actions: Post to Slack #monitoring
   ```

3. Set up release tracking:
   ```bash
   # Tag releases in Sentry
   sentry-cli releases create --project mentor-learner-web "1.0.0"
   ```

### 2. BetterStack Uptime Monitoring

**Setup Monitors:**

```
Monitor 1: API Health
  URL: https://api.mentor.example.com/health
  Method: GET
  Expected Status: 200
  Check Interval: 60 seconds
  Timeout: 10 seconds
  Regions: US East, EU West, Asia Pacific
  Alert: Slack #incidents

Monitor 2: Learner Web
  URL: https://app.mentor.example.com/
  Method: GET
  Check Element: <h1>Mentor</h1> in page
  Interval: 120 seconds
  Regions: Global (3+)

Monitor 3: Database Health
  URL: https://api.mentor.example.com/health/db
  Checks: Database connectivity
  Response Time SLA: < 500ms

Monitor 4: Video Streaming
  URL: https://image.mux.com/v1/{playback_id}/master.m3u8
  Status Code: 200
  Interval: 300 seconds

Monitor 5: Payment Processing
  URL: https://api.mentor.example.com/health/stripe
  Checks: Stripe API connectivity
  Interval: 300 seconds
```

**Alert Configuration:**

```
Alert Rule: Service Down
  Condition: Monitor down for 5 minutes
  Actions:
    - Slack notification
    - Email to on-call
    - SMS if critical (API down)

Alert Rule: High Latency
  Condition: Response time > 2 seconds (p95)
  Actions:
    - Slack notification (non-critical channel)
    - Auto-escalate if > 5 minutes

Alert Rule: Certificate Expiring
  Condition: SSL cert expires in 30 days
  Actions:
    - Email reminder
    - Slack notification
```

**Health Check Endpoint:**

```typescript
// api/health.ts
app.get("/health", async (c) => {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      api: { status: "up", latency: 0 },
      database: { status: "unknown", latency: 0 },
      stripe: { status: "unknown", latency: 0 },
      mux: { status: "unknown", latency: 0 },
    },
  };

  // Check database
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.services.database = {
      status: "up",
      latency: Date.now() - start,
    };
  } catch (error) {
    checks.services.database = { status: "down", error: error.message };
    checks.status = "degraded";
  }

  // Check Stripe
  try {
    const start = Date.now();
    await stripe.charges.list({ limit: 1 });
    checks.services.stripe = {
      status: "up",
      latency: Date.now() - start,
    };
  } catch (error) {
    checks.services.stripe = { status: "down", error: error.message };
  }

  // Check Mux
  try {
    const start = Date.now();
    const upload = await mux.video.uploads.list({ limit: 1 });
    checks.services.mux = { status: "up", latency: Date.now() - start };
  } catch (error) {
    checks.services.mux = { status: "down", error: error.message };
  }

  return c.json(checks, checks.status === "healthy" ? 200 : 503);
});
```

### 3. Vercel Analytics & Web Vitals

**Enable in vercel.json:**

```json
{
  "analytics": {
    "enabled": true
  }
}
```

**Track Web Vitals:**

```typescript
// lib/web-vitals.ts
import { getCLS, getFID, getLCP, getLCP, getTTFB } from "web-vitals";

export function reportWebVitals(metric: any) {
  // Send to Vercel Analytics (automatic)
  // Send to custom analytics if needed
  console.log(`${metric.name}:`, metric.value);

  // Alert if thresholds exceeded
  const thresholds = {
    TTFB: 800,
    FCP: 1800,
    LCP: 2500,
    FID: 100,
    CLS: 0.1,
  };

  if (metric.value > thresholds[metric.name]) {
    Sentry.captureMessage(
      `Poor Web Vital: ${metric.name} = ${metric.value}`,
      "warning"
    );
  }
}

// Initialize
getCLS(reportWebVitals);
getFID(reportWebVitals);
getLCP(reportWebVitals);
getTTFB(reportWebVitals);
```

**Vercel Analytics Dashboard:**

Monitor in https://vercel.com/dashboard → Analytics:

- TTFB (Time to First Byte)
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- FCP (First Contentful Paint)

Set alerts:

```
Alert: LCP > 2.5s (p95)
Alert: TTFB > 800ms (p95)
Alert: CLS > 0.1
```

### 4. Mux Data Video Metrics

**Enable Mux Data:**

```typescript
// Configure video player to send metrics
import MuxPlayer from '@mux/mux-player-react';

export default function VideoPlayer({ playbackId }) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      metadata={{
        video_id: playbackId,
        video_title: 'Makeup Fundamentals - Lesson 1',
        viewer_user_id: currentUser.id,
        player_name: 'Mentor Player',
      }}
      onPlay={() => {
        // Track engagement
      }}
    />
  );
}
```

**Mux Data Dashboard Metrics:**

Monitor:

- **Video Start Time**: Should be < 2 seconds p95
- **Buffering Ratio**: Should be < 1%
- **Errors**: Track playback errors < 0.5%
- **Viewers**: Concurrent viewers and peak load
- **Session Duration**: Track engagement
- **Rebuffer Events**: Indicates quality issues
- **Bitrate Changes**: Quality switching patterns

**Create Mux Data Alerts:**

```
Alert: Video Error Rate > 0.5%
  Condition: error_rate > 0.005
  Duration: 5 minutes
  Action: Slack #video-monitoring

Alert: Buffering Rate > 1%
  Condition: buffering_ratio > 0.01
  Duration: 10 minutes
  Action: Slack #video-monitoring

Alert: Video Start Time > 3s
  Condition: video_startup_time_p95 > 3000
  Duration: 5 minutes
  Action: Slack #performance
```

### 5. Database Monitoring (Neon)

**Neon Console Monitoring:**

Access: https://console.neon.tech/

Monitor:

- **Connection Count**: Current and max connections
- **Query Performance**: Slow query log
- **Database Size**: Track growth
- **Disk Usage**: Alert if > 80%
- **CPU Usage**: Alert if sustained > 80%

**Enable Neon Metrics:**

```sql
-- Monitor slow queries
SELECT
  query,
  calls,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- Queries > 100ms
ORDER BY mean_time DESC
LIMIT 10;

-- Monitor connection pool
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Monitor table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Setup Alerts:**

```
Alert: High Connection Count
  Condition: active_connections > 40 (of 50 max)
  Action: Slack #database, investigate queries

Alert: Slow Query Detected
  Condition: query execution > 1 second (p95)
  Action: Log to Sentry, analyze

Alert: Disk Usage Critical
  Condition: used_disk > 90%
  Action: Email DBA, investigate storage
```

### 6. QStash Background Job Monitoring

**QStash Dashboard:**

Access: https://console.upstash.com/qstash

Monitor:

- **Queue Depth**: Number of pending jobs
- **Processing Rate**: Jobs processed per minute
- **Error Rate**: Failed jobs
- **Latency**: Time to process job
- **Retry Count**: Jobs being retried

**Job Monitoring Configuration:**

```typescript
// jobs/video-transcoding.ts
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN });

export async function scheduleVideoTranscoding(videoId: string) {
  try {
    await client.publishJSON({
      api: {
        name: "video_transcode",
        baseUrl: "https://api.mentor.example.com",
      },
      body: { videoId },
      notBefore: Math.floor(Date.now() / 1000) + 60, // 1 minute delay
    });

    console.log(`Transcoding job scheduled for video ${videoId}`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { job: "video_transcode" },
    });

    throw error;
  }
}

// Monitor job completion
export async function getJobStatus(messageId: string) {
  const status = await client.messages.getStatus(messageId);
  return status; // 'Scheduled', 'Sent', 'Failed', etc.
}
```

**Setup Alerts:**

```
Alert: Queue Depth > 100
  Condition: pending_jobs > 100
  Duration: 5 minutes
  Action: Slack, investigate bottleneck

Alert: Job Failure Rate > 5%
  Condition: failed_jobs / total_jobs > 0.05
  Duration: 10 minutes
  Action: Slack #jobs, review error logs

Alert: Job Processing Latency > 5 minutes
  Condition: avg_processing_time > 300000ms
  Action: Slack, investigate performance
```

### 7. Slack Integration

**Setup Slack App:**

1. Create app: https://api.slack.com/apps
2. Enable incoming webhooks
3. Create channels:
   - #monitoring (general alerts)
   - #incidents (critical issues)
   - #video-monitoring (video-specific)
   - #database (database alerts)
   - #performance (performance degradation)

**Alert Messages Template:**

```json
{
  "channel": "#monitoring",
  "username": "Sentry Bot",
  "icon_emoji": ":sentry:",
  "text": "New Error Alert",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Error Alert*\nProject: Learner Web\nError: TypeError: Cannot read property 'id' of undefined\nOccurrences: 45\nSeverity: High"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View in Sentry"
          },
          "url": "https://sentry.io/..."
        }
      ]
    }
  ]
}
```

**Configure Sentry Slack Integration:**

1. Sentry → Settings → Integrations → Slack
2. Install Slack app
3. Create alert rules with Slack actions

### 8. Alert Escalation Rules

**Severity Levels & Escalation:**

```
CRITICAL (P1) - Immediate action required
├─ Condition: API down, data loss, payment failure, > 1% errors
├─ Alert: Slack #incidents + SMS to on-call + email
├─ Response SLA: < 5 minutes
├─ Escalation: Page on-call after 15 minutes
└─ War room: Slack video call immediately

HIGH (P2) - Urgent attention needed
├─ Condition: Feature broken, performance degraded > 20%, error rate 0.1-1%
├─ Alert: Slack #monitoring + email
├─ Response SLA: < 30 minutes
├─ Escalation: Email management after 1 hour
└─ No automatic escalation to on-call (unless multiple high)

MEDIUM (P3) - Should be fixed soon
├─ Condition: Minor issues, error rate < 0.1%, slow features
├─ Alert: Slack #monitoring (summary) + daily digest
├─ Response SLA: < 4 hours
├─ Escalation: None (handle in next sprint if not critical)
└─ Batch with other medium issues

LOW (P4) - Nice to fix
├─ Condition: Cosmetic, typos, minor performance
├─ Alert: Daily digest only
├─ Response SLA: End of week
└─ No immediate action required
```

**On-Call Rotation:**

```
Week 1: Engineer A (primary), Engineer B (backup)
Week 2: Engineer C (primary), Engineer D (backup)
Week 3: Engineer A (primary), Engineer E (backup)
...

Primary: Responds to all P1/P2 alerts
Backup: Takes over if primary unresponsive after 15 minutes
```

### 9. Runbook for Common Alerts

**Alert: High Error Rate (> 0.1%)**

1. Check Sentry for error pattern
2. Identify affected endpoints
3. Check recent deployments
4. Options:
   - Hot fix if simple
   - Rollback if recent deployment
   - Scale up if load-related
5. Monitor error rate recovery
6. Post-mortem within 24 hours

**Alert: High Response Time (p95 > 500ms)**

1. Check Vercel/BetterStack for affected endpoints
2. Analyze database slow query log
3. Check API rate limiting
4. Options:
   - Optimize slow queries
   - Increase cache TTL
   - Scale database if needed
5. Verify recovery
6. Document fix

**Alert: Video Playback Errors > 0.5%**

1. Check Mux Data dashboard for error types
2. Verify CDN/Mux status
3. Check DRM licensing issues
4. Options:
   - Check FairPlay/Widevine configuration
   - Verify certificate validity
   - Escalate to Mux support
5. Monitor error rate
6. Notify users if widespread

**Alert: Database Connectivity Issue**

1. Check Neon console for connection status
2. Verify connection pool not exhausted
3. Check query logs for hanging queries
4. Kill long-running queries if needed
5. Options:
   - Increase connection pool
   - Optimize slow queries
   - Restart connection pool
6. Monitor recovery
7. Set alerts for future prevention

### 10. Dashboard Setup

**Grafana Dashboard (Optional but Recommended):**

Create unified dashboard showing:

- API response times (p50, p95, p99)
- Error rate over time
- Video playback metrics
- Database query times
- User engagement trends
- Revenue metrics (if available)

```yaml
# Example Grafana dashboard JSON
{
  "dashboard":
    {
      "title": "Mentor Production Monitoring",
      "panels":
        [
          {
            "title": "API Response Time (p95)",
            "datasource": "Sentry",
            "targets": [{ "expr": "sentry_response_time_p95" }],
            "thresholds": { "critical": 500, "warning": 300 },
          },
          {
            "title": "Error Rate",
            "datasource": "Sentry",
            "targets": [{ "expr": "sentry_error_rate" }],
            "thresholds": { "critical": 0.001, "warning": 0.0005 },
          },
          {
            "title": "Video Playback Success Rate",
            "datasource": "Mux Data",
            "targets": [{ "expr": "mux_video_success_rate" }],
            "thresholds": { "critical": 0.995 },
          },
        ],
    },
}
```

## Monitoring Checklist

- [ ] Sentry projects created for all apps
- [ ] Sentry alerts configured and tested
- [ ] BetterStack monitors setup for all critical endpoints
- [ ] BetterStack alerts trigger correctly
- [ ] Slack integration working for all alert types
- [ ] SMS alerts configured for P1 incidents
- [ ] Vercel Analytics enabled and tracking Web Vitals
- [ ] Mux Data dashboards accessible and populated
- [ ] Neon monitoring enabled and alerts configured
- [ ] QStash job monitoring setup
- [ ] Health check endpoint returning correct status
- [ ] On-call rotation established
- [ ] Runbooks written and accessible
- [ ] Team trained on dashboards and alert response
- [ ] Escalation procedures documented and tested

## Success Metrics

- **MTTR** (Mean Time To Recovery): < 15 minutes for P1
- **Alert Accuracy**: > 90% alerts are actionable (< 10% false positives)
- **Detection Time**: Critical issues detected < 2 minutes
- **Coverage**: All critical systems monitored
- **False Positives**: < 5% of alerts

## Timeline

- **Week 1**: Sentry, BetterStack, Slack setup
- **Week 2**: Vercel Analytics, Mux Data, Neon monitoring
- **Week 3**: QStash, health checks, escalation rules
- **Week 4**: Dashboard setup, runbooks, team training
- **Week 5**: Testing and tuning before launch

## Post-Launch Activities

- **Day 1**: 24/7 monitoring, rapid incident response
- **Day 3**: First retrospective, identify improvements
- **Week 1**: Fine-tune alert thresholds based on baseline
- **Week 2**: Optimize monitoring queries and dashboards
- **Ongoing**: Weekly review of alert logs, continuous improvement
