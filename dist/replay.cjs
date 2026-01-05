'use strict';

// src/utils/session-replay.ts
var currentState = "idle";
var stopFn = null;
var eventsBuffer = [[]];
var recordingStartTime = null;
var config;
var DEFAULT_CONFIG = {
  maxBufferDuration: 6e4,
  checkoutInterval: 3e4,
  maskInputs: true,
  blockSelectors: [],
  maskSelectors: [".sensitive", "[data-sensitive]", ".pii"],
  sampling: {
    mousemove: 50,
    // Sample every 50ms
    mouseInteraction: true,
    scroll: 150,
    // Sample every 150ms
    media: 800,
    input: "last"
  },
  onStart: () => {
  },
  onStop: () => {
  },
  onError: () => {
  }
};
async function loadRrweb() {
  try {
    const rrweb = await import('rrweb');
    return rrweb;
  } catch (error) {
    throw new Error(
      "Failed to load rrweb. Make sure it is installed: npm install rrweb"
    );
  }
}
async function startSessionReplay(userConfig = {}) {
  if (typeof window === "undefined") {
    console.warn("Session replay is only available in browser environment");
    return;
  }
  if (currentState === "recording") {
    console.warn("Session replay is already recording");
    return;
  }
  config = { ...DEFAULT_CONFIG, ...userConfig };
  try {
    const { record } = await loadRrweb();
    eventsBuffer = [[]];
    recordingStartTime = Date.now();
    currentState = "recording";
    const recordOptions = {
      emit: (event, isCheckout) => {
        if (isCheckout) {
          eventsBuffer.push([]);
          const maxBuffers = Math.ceil(
            config.maxBufferDuration / config.checkoutInterval
          );
          if (eventsBuffer.length > maxBuffers + 1) {
            eventsBuffer.shift();
          }
        }
        const currentBuffer = eventsBuffer[eventsBuffer.length - 1];
        if (currentBuffer) {
          currentBuffer.push(event);
        }
      },
      checkoutEveryNms: config.checkoutInterval,
      maskAllInputs: config.maskInputs,
      blockSelector: config.blockSelectors.join(", ") || void 0,
      maskTextSelector: config.maskSelectors.join(", ") || void 0,
      sampling: config.sampling,
      // Privacy: don't record cross-origin iframes
      recordCrossOriginIframes: false,
      // Collect fonts for accurate replay
      collectFonts: true,
      // Inline styles for self-contained replay
      inlineStylesheet: true,
      // Inline images as base64 (careful with size)
      inlineImages: false
    };
    stopFn = record(recordOptions) ?? null;
    config.onStart();
  } catch (error) {
    currentState = "error";
    const err = error instanceof Error ? error : new Error(String(error));
    config.onError(err);
    throw err;
  }
}
function stopSessionReplay() {
  if (currentState !== "recording" || !stopFn) {
    console.warn("Session replay is not recording");
    return null;
  }
  stopFn();
  stopFn = null;
  currentState = "idle";
  const endTime = Date.now();
  const events = eventsBuffer.flat();
  const eventsJson = JSON.stringify(events);
  const data = {
    events,
    startTime: recordingStartTime ?? endTime,
    endTime,
    duration: endTime - (recordingStartTime ?? endTime),
    sizeBytes: new Blob([eventsJson]).size,
    eventCount: events.length
  };
  config.onStop();
  recordingStartTime = null;
  eventsBuffer = [[]];
  return data;
}
function getSessionReplaySnapshot() {
  if (currentState !== "recording") {
    return null;
  }
  const now = Date.now();
  const events = eventsBuffer.flat();
  const eventsJson = JSON.stringify(events);
  return {
    events,
    startTime: recordingStartTime ?? now,
    endTime: now,
    duration: now - (recordingStartTime ?? now),
    sizeBytes: new Blob([eventsJson]).size,
    eventCount: events.length
  };
}
function isRecording() {
  return currentState === "recording";
}
function getRecordingState() {
  return currentState;
}
async function compressReplayData(data) {
  const jsonString = JSON.stringify(data.events);
  const blob = new Blob([jsonString], { type: "application/json" });
  if (typeof CompressionStream !== "undefined") {
    const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(stream).blob();
  }
  return blob;
}
function createReplayUrl(data) {
  const eventsJson = JSON.stringify(data.events);
  if (eventsJson.length < 5e4) {
    const encoded = btoa(encodeURIComponent(eventsJson));
    return `https://rrweb.io/player?events=${encoded}`;
  }
  return "https://rrweb.io/player (events too large for URL)";
}
function calculateReplayQualityScore(data) {
  const factors = {
    hasFullSnapshot: {
      value: data.events.some((e) => e.type === 2) ? 100 : 0,
      // type 2 = FullSnapshot
      weight: 0.3
    },
    hasMutations: {
      value: data.events.some((e) => e.type === 3) ? 100 : 50,
      // type 3 = IncrementalSnapshot
      weight: 0.2
    },
    hasUserInteractions: {
      value: data.events.filter(
        (e) => e.type === 3 && e.data.source !== void 0 && [1, 2, 5].includes(e.data.source)
        // MouseInteraction, Scroll, Input
      ).length > 0 ? 100 : 30,
      weight: 0.25
    },
    duration: {
      value: Math.min(100, data.duration / 5e3 * 100),
      // 5+ seconds = full score
      weight: 0.15
    },
    eventDensity: {
      value: Math.min(100, data.eventCount / 50 * 100),
      // 50+ events = full score
      weight: 0.1
    }
  };
  const score = Object.values(factors).reduce(
    (sum, f) => sum + f.value * f.weight,
    0
  );
  return { score: Math.round(score), factors };
}

exports.calculateReplayQualityScore = calculateReplayQualityScore;
exports.compressReplayData = compressReplayData;
exports.createReplayUrl = createReplayUrl;
exports.getRecordingState = getRecordingState;
exports.getSessionReplaySnapshot = getSessionReplaySnapshot;
exports.isRecording = isRecording;
exports.startSessionReplay = startSessionReplay;
exports.stopSessionReplay = stopSessionReplay;
//# sourceMappingURL=replay.cjs.map
//# sourceMappingURL=replay.cjs.map