# Performance Benchmarks & Load Testing

## Description

Comprehensive performance testing and optimization strategy to validate Mentor platform meets PRD targets. Includes load testing API endpoints with k6 or Artillery, Web Vitals measurement, mobile cold start profiling, video streaming load testing (100+ concurrent streams), database query optimization, and caching effectiveness validation. Ensures platform can handle launch day traffic while maintaining user experience standards.

## Affected Apps/Packages

- **Learner Web** (Next.js)
- **Mentor Web** (Next.js)
- **Admin Web** (Next.js)
- **Learner Mobile** (React Native Expo)
- **API** (Hono on Vercel)
- **Database** (Neon PostgreSQL)
- **Cache** (Vercel KV, CloudFlare)
- **CDN** (Vercel/Cloudflare)
- **Video Streaming** (Mux)

## Requirements

### Performance Targets (from PRD)

#### API Performance

- **Cached responses**: p95 < 200ms
- **Uncached responses**: p95 < 500ms
- **Search endpoints** (Typesense): < 50ms p95
- **Database queries**: < 100ms average (optimized)

#### Web Application Performance (Core Web Vitals)

- **TTFB** (Time to First Byte): < 800ms globally
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **FCP** (First Contentful Paint): < 1.8s

#### Video Performance

- **Video start**: < 2 seconds
- **Buffering rate**: < 1%
- **Video playback error rate**: < 0.5% (pre-launch load test with 100+ concurrent streams)

#### Mobile Performance

- **Cold start**: < 3 seconds
- **Crash-free rate**: > 99.5%
- **Memory usage**: < 150MB base
- **Battery drain**: < 5% per hour of learning

#### Load Testing Targets

- **Concurrent users**: Handle 500+ simultaneous users
- **RPS**: 5,000+ requests per second
- **Error rate under load**: < 0.1%
- **Database connection pool**: Properly managed with 50-100 connections

### Testing Tools

- **Load Testing**: k6 (preferred for flexibility) or Artillery
- **Web Vitals**: web-vitals library, Chrome DevTools, Lighthouse
- **Mobile Profiling**: Expo DevTools, Instruments (iOS), Android Profiler
- **Database Monitoring**: Neon console, pgBadger, EXPLAIN ANALYZE
- **APM**: Sentry Performance, Vercel Analytics, Mux Data
- **Synthetic Monitoring**: Vercel Edge, scheduled test runs

## Acceptance Criteria

- [ ] API p95 response time < 200ms (cached), < 500ms (uncached) validated under load
- [ ] Search queries consistently < 50ms p95 with 100K+ documents indexed
- [ ] TTFB < 800ms from 5+ global locations (test with latency emulation)
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1 on 90th percentile
- [ ] Video playback start < 2s verified with real Mux assets
- [ ] 100+ concurrent video streams sustain with < 1% buffering
- [ ] Mobile cold start < 3s measured on mid-range device
- [ ] Load test: 500 concurrent users with < 0.1% error rate
- [ ] Database queries optimized with query plans validated
- [ ] Cache hit rates > 80% for frequently accessed data
- [ ] Video playback error rate < 0.5% across 10,000+ simulated streams
- [ ] Memory leaks detected and fixed via heap snapshots
- [ ] Bundle size optimized (< 200KB for main app JS)
- [ ] Lighthouse score > 90 on all pages
- [ ] Performance regression tests integrated into CI

## Dependencies

### Load Testing Infrastructure

- k6 cloud or self-hosted k6
- Artillery for alternative load testing
- AWS/GCP for distributed load generation
- Docker for containerized test runners

### Monitoring & Analytics

- Sentry Performance
- Vercel Analytics
- Mux Data dashboards
- Neon PostgreSQL monitoring
- Datadog or New Relic (optional)

### Tools

- Chrome DevTools & Lighthouse
- web-vitals npm package
- Expo profiler tools
- Android Profiler, Instruments (iOS)
- pgBadger for PostgreSQL analysis
- Node.js v20+

## Technical Notes

### API Load Testing with k6

```javascript
// tests/performance/api-load-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const errorRate = new Rate("errors");
const apiDuration = new Trend("api_duration");
const apiSuccess = new Counter("api_success");

export const options = {
  vus: 100, // Virtual users
  duration: "5m", // 5 minute test
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95th percentile < 500ms
    "http_req_duration{staticAsset:yes}": ["p(99)<200"], // Cached < 200ms
    errors: ["rate<0.01"], // Error rate < 1%
  },
};

const BASE_URL = "https://api.mentor.example.com";
const API_TOKEN = __ENV.API_TOKEN;

export default function () {
  // Test: Get courses list (should be cached)
  let res = http.get(`${BASE_URL}/courses`, {
    headers: { Authorization: `Bearer ${API_TOKEN}`, "static-asset": "yes" },
    tags: { name: "GetCourses", staticAsset: "yes" },
  });

  check(res, { "courses list status is 200": (r) => r.status === 200 });
  apiDuration.add(res.timings.duration, { endpoint: "courses_list" });
  if (res.status !== 200) errorRate.add(1);
  else apiSuccess.add(1);

  sleep(1);

  // Test: Search courses (< 50ms target)
  res = http.get(`${BASE_URL}/search?q=makeup`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    tags: { name: "SearchCourses" },
  });

  check(res, { "search status is 200": (r) => r.status === 200 });
  check(res, { "search response < 50ms": (r) => r.timings.duration < 50 });
  apiDuration.add(res.timings.duration, { endpoint: "search" });
  if (res.status !== 200) errorRate.add(1);

  sleep(1);

  // Test: Get single course (uncached, should be < 500ms p95)
  const courseId = Math.floor(Math.random() * 1000);
  res = http.get(`${BASE_URL}/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    tags: { name: "GetCourse" },
  });

  check(res, { "course detail status is 200": (r) => r.status === 200 });
  apiDuration.add(res.timings.duration, { endpoint: "course_detail" });
  if (res.status !== 200) errorRate.add(1);

  sleep(1);

  // Test: List user enrollments
  res = http.get(`${BASE_URL}/me/enrollments`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    tags: { name: "GetEnrollments" },
  });

  check(res, { "enrollments status is 200": (r) => r.status === 200 });
  apiDuration.add(res.timings.duration, { endpoint: "enrollments" });
  if (res.status !== 200) errorRate.add(1);

  sleep(2);
}

export function teardown(data) {
  console.log("Load test completed");
}
```

**Run load test:**

```bash
k6 run tests/performance/api-load-test.js \
  --vus 500 \
  --duration 10m \
  --rps 5000
```

### Video Streaming Load Test

```javascript
// tests/performance/video-streaming-load-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const videoStartTime = new Trend("video_start_time");
const videoErrors = new Counter("video_errors");
const bufferingEvents = new Counter("buffering_events");

export const options = {
  vus: 100, // Start with 100 concurrent users
  stages: [
    { duration: "1m", target: 100 }, // Ramp up to 100 users
    { duration: "5m", target: 100 }, // Stay at 100
    { duration: "2m", target: 500 }, // Ramp up to 500 concurrent streams
    { duration: "5m", target: 500 }, // Sustain 500
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    video_start_time: ["p(95)<2000"], // Start < 2 seconds
    video_errors: ["rate<0.005"], // Error rate < 0.5%
  },
};

const BASE_URL = "https://image.mux.com";

export default function () {
  // Simulate video playback
  // In real scenario, would track HLS/DASH segment requests

  const playbackId = `test_${Math.floor(Math.random() * 10000)}`;
  const startTime = Date.now();

  // Request video master playlist
  let res = http.get(`${BASE_URL}/v1/${playbackId}/master.m3u8`, {
    tags: { name: "VideoMaster" },
  });

  const playStartTime = Date.now() - startTime;
  videoStartTime.add(playStartTime);

  if (res.status !== 200) {
    videoErrors.add(1);
  }

  check(res, {
    "master playlist is 200": (r) => r.status === 200,
    "video starts < 2s": () => playStartTime < 2000,
  });

  // Simulate segment requests (HLS)
  const segmentCount = Math.floor(Math.random() * 10) + 5; // 5-15 segments

  for (let i = 0; i < segmentCount; i++) {
    res = http.get(`${BASE_URL}/v1/${playbackId}/segment-${i}.ts`, {
      tags: { name: "VideoSegment" },
    });

    if (res.status === 503 || res.status === 504) {
      bufferingEvents.add(1); // Simulate buffering event
    }

    if (res.status !== 200) {
      videoErrors.add(1);
    }

    sleep(2); // Simulate 2 seconds between segment requests
  }

  sleep(1);
}
```

### Web Vitals Testing

```typescript
// tests/performance/web-vitals.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from "web-vitals";

interface VitalsMetrics {
  TTFB: number;
  FCP: number;
  LCP: number;
  FID: number;
  CLS: number;
}

const metrics: VitalsMetrics = {
  TTFB: 0,
  FCP: 0,
  LCP: 0,
  FID: 0,
  CLS: 0,
};

export function initVitalsTracking() {
  onTTFB((metric) => {
    metrics.TTFB = metric.value;
    console.log("TTFB:", metric.value);
  });

  onFCP((metric) => {
    metrics.FCP = metric.value;
    console.log("FCP:", metric.value);
  });

  onLCP((metric) => {
    metrics.LCP = metric.value;
    console.log("LCP:", metric.value);
  });

  onFID((metric) => {
    metrics.FID = metric.value;
    console.log("FID:", metric.value);
  });

  onCLS((metric) => {
    metrics.CLS = metric.value;
    console.log("CLS:", metric.value);
  });
}

export function validateVitals(): boolean {
  const targets = {
    TTFB: 800,
    FCP: 1800,
    LCP: 2500,
    FID: 100,
    CLS: 0.1,
  };

  let passed = true;

  Object.entries(metrics).forEach(([metric, value]) => {
    const target = targets[metric as keyof VitalsMetrics];
    const status = value <= target ? "✓" : "✗";
    console.log(`${status} ${metric}: ${value}ms (target: ${target}ms)`);
    if (value > target) passed = false;
  });

  return passed;
}
```

### Database Query Optimization

```sql
-- Identify slow queries
SELECT
  query,
  calls,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- Queries taking > 100ms on average
ORDER BY mean_time DESC
LIMIT 20;

-- Analyze query plan
EXPLAIN ANALYZE
SELECT c.id, c.title, c.mentor_id, COUNT(e.id) as student_count
FROM courses c
LEFT JOIN enrollments e ON c.id = e.course_id
WHERE c.status = 'published'
GROUP BY c.id
ORDER BY student_count DESC
LIMIT 10;

-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_courses_status_published ON courses(status) WHERE status = 'published';
CREATE INDEX CONCURRENTLY idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX CONCURRENTLY idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX CONCURRENTLY idx_video_events_user_course ON video_events(user_id, course_id, created_at);

-- Monitor index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Caching Strategy Testing

```typescript
// tests/performance/cache-effectiveness.ts
import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

const cacheHitRate = new Counter("cache_hits");
const cacheMissRate = new Counter("cache_misses");
const cachedResponseTime = new Trend("cached_response_time");
const uncachedResponseTime = new Trend("uncached_response_time");

export const options = {
  vus: 50,
  duration: "5m",
};

export default function () {
  const courseId = Math.floor(Math.random() * 100);

  // First request (cache miss)
  let res = http.get(`https://api.mentor.example.com/courses/${courseId}`, {
    tags: { name: "GetCourse" },
  });

  const cacheControl = res.headers["Cache-Control"];
  const cacheHit = res.headers["X-Cache"] === "HIT";

  if (!cacheHit) {
    cacheMissRate.add(1);
    uncachedResponseTime.add(res.timings.duration);
  } else {
    cacheHitRate.add(1);
    cachedResponseTime.add(res.timings.duration);
  }

  check(res, {
    "has cache control header": (r) => !!cacheControl,
    "cache hit for repeated requests": () => cacheHit,
  });
}
```

### Mobile Cold Start Testing

```typescript
// Mobile cold start profiling with React Native
import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function measureColdStart() {
  const [coldStartTime, setColdStartTime] = useState<number | null>(null);

  useEffect(() => {
    // Time from app launch to first meaningful paint
    const navigationTiming = performance.getEntriesByType("navigation")[0];

    if (navigationTiming) {
      const domInteractiveTime = (
        navigationTiming as PerformanceNavigationTiming
      ).domInteractive;
      const startTime = navigationTiming.startTime;
      const coldStart = domInteractiveTime - startTime;

      setColdStartTime(coldStart);

      // Log to analytics/monitoring
      console.log(`Cold start time: ${coldStart}ms`);

      // Alert if exceeds 3 second target
      if (coldStart > 3000) {
        console.warn("Cold start exceeds 3s target");
      }
    }
  }, []);

  return coldStartTime;
}

// Memory leak detection
export function detectMemoryLeaks() {
  const memorySnapshots: number[] = [];

  const interval = setInterval(() => {
    if (global.gc) {
      global.gc();
    }

    const memoryUsage =
      require("react-native").NativeModules?.RNUtilities?.getMemoryUsage?.();
    if (memoryUsage) {
      memorySnapshots.push(memoryUsage.native);
    }
  }, 5000); // Every 5 seconds

  return () => clearInterval(interval);
}
```

### Lighthouse Testing in CI

```javascript
// tests/performance/lighthouse.js
const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");

async function runLighthouse(url, options = {}) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });

  const lighthouseOptions = {
    logLevel: "info",
    output: "json",
    port: chrome.port,
    ...options,
  };

  const runnerResult = await lighthouse(url, lighthouseOptions);
  await chromeLauncher.kill(chrome.pid);

  const scores = {
    performance: runnerResult.lhr.categories.performance.score * 100,
    accessibility: runnerResult.lhr.categories.accessibility.score * 100,
    bestPractices: runnerResult.lhr.categories["best-practices"].score * 100,
    seo: runnerResult.lhr.categories.seo.score * 100,
  };

  return {
    scores,
    metrics: runnerResult.lhr.audits,
  };
}

// Run on key pages
const pages = [
  "https://app.mentor.example.com/learner/dashboard",
  "https://app.mentor.example.com/course/123",
  "https://app.mentor.example.com/learn/lesson/1",
];

pages.forEach(async (page) => {
  const result = await runLighthouse(page);
  console.log(`${page}:`, result.scores);

  // Fail CI if score < 90
  if (result.scores.performance < 90) {
    throw new Error(`Performance score too low: ${result.scores.performance}`);
  }
});
```

### Performance Monitoring Dashboard

Create dashboards in Sentry/Vercel Analytics tracking:

**Key Metrics:**

- API response times (p50, p95, p99)
- Database query times
- Cache hit rates
- Frontend Web Vitals (LCP, FID, CLS)
- Error rates by endpoint
- Video playback success rates

**Alerts:**

- API p95 > 500ms
- Cache hit rate < 70%
- Video error rate > 0.5%
- Lighthouse score < 90

### Bundle Size Optimization

```javascript
// scripts/analyze-bundle.js
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "static",
      reportFilename: "bundle-report.html",
    }),
  ],
};
```

```bash
# Generate bundle analysis
npx next build --analyze

# Check bundle size
npm run bundle-stats
```

### Performance Regression Testing in CI

```yaml
# .github/workflows/performance-tests.yml
name: Performance Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npm run build
      - run: npm run test:lighthouse
      - uses: actions/upload-artifact@v4
        with:
          name: lighthouse-results
          path: lighthouse-results/

  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: tests/performance/api-load-test.js
          token: ${{ secrets.K6_CLOUD_TOKEN }}

  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: bundle-analysis
          path: .next/bundle-analysis/
      - name: Fail if bundle too large
        run: |
          SIZE=$(stat --printf="%s" .next/static/chunks/main-*.js)
          if [ $SIZE -gt 210000 ]; then
            echo "Bundle size ($SIZE bytes) exceeds limit (200KB)"
            exit 1
          fi
```

## Performance Optimization Checklist

- [ ] Remove unused dependencies
- [ ] Code split large bundles
- [ ] Implement lazy loading for routes
- [ ] Optimize images (WebP, responsive sizes)
- [ ] Minify CSS/JS
- [ ] Enable gzip compression
- [ ] Configure Redis/CDN caching headers
- [ ] Optimize database queries with indexes
- [ ] Connection pooling configured
- [ ] API rate limiting implemented
- [ ] Video transcoding in optimal formats
- [ ] Font loading optimized (system fonts for fastest load)
- [ ] Critical CSS inlined

## Implementation Timeline

- **Week 1**: Set up k6 load tests, establish baseline metrics
- **Week 2**: Web Vitals measurement, Lighthouse integration
- **Week 3**: Video streaming load test (100+ concurrent)
- **Week 4**: Database optimization, query analysis
- **Week 5**: Mobile profiling, memory leak detection
- **Week 6**: CI integration, performance monitoring dashboards
- **Week 7**: Final optimization pass, threshold tuning

## Success Metrics

- **100% of targets met** under production-like load
- **API p95 < 200ms** cached, < 500ms uncached
- **LCP < 2.5s** on 90th percentile
- **Video start < 2s** with > 99.5% success rate
- **Mobile cold start < 3s** on mid-range device
- **Zero critical performance regressions** in CI
- **Hourly monitoring dashboards** operational
