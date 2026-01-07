'use strict';

var vue = require('vue');

// src/vue.ts

// src/types.ts
var WIDGET_TEXTS = {
  en: {
    buttonText: "Report a bug",
    dialogTitle: "Let us know what happened",
    dialogDescription: "What went wrong?",
    placeholder: "Tell us what you experienced. The more details, the better!",
    submitText: "Send Report",
    cancelText: "Close",
    successMessage: "Got it!",
    successDescription: "Thanks for letting us know. We'll look into this.",
    viewIssue: "View on GitHub",
    capturedLogs: "Captured Logs",
    entry: "entry",
    entries: "entries",
    privacyNotice: "We collect clicks, navigation, and performance data. Sensitive info is automatically hidden.",
    submitting: "Sending...",
    dailyLimitExceeded: "Daily limit reached. Please try again tomorrow.",
    rateLimitExceeded: "Too many requests. Please wait a moment."
  },
  ko: {
    buttonText: "\uBC84\uADF8 \uC81C\uBCF4",
    dialogTitle: "\uBB38\uC81C \uC54C\uB9AC\uAE30",
    dialogDescription: "\uC5B4\uB5A4 \uBB38\uC81C\uAC00 \uC788\uC5C8\uB098\uC694?",
    placeholder: "\uACAA\uC73C\uC2E0 \uBB38\uC81C\uB97C \uC54C\uB824\uC8FC\uC138\uC694. \uAD6C\uCCB4\uC801\uC77C\uC218\uB85D \uC88B\uC544\uC694.",
    submitText: "\uC81C\uBCF4\uD558\uAE30",
    cancelText: "\uB2EB\uAE30",
    successMessage: "\uC81C\uBCF4 \uC644\uB8CC",
    successDescription: "\uC54C\uB824\uC8FC\uC154\uC11C \uAC10\uC0AC\uD574\uC694! \uBE60\uB974\uAC8C \uD655\uC778\uD560\uAC8C\uC694.",
    viewIssue: "GitHub\uC5D0\uC11C \uBCF4\uAE30",
    capturedLogs: "\uC218\uC9D1\uB41C \uB85C\uADF8",
    entry: "\uAC74",
    entries: "\uAC74",
    privacyNotice: "\uD074\uB9AD, \uD398\uC774\uC9C0 \uC774\uB3D9, \uC131\uB2A5 \uB370\uC774\uD130\uB97C \uC218\uC9D1\uD574\uC694. \uBBFC\uAC10\uD55C \uC815\uBCF4\uB294 \uC790\uB3D9\uC73C\uB85C \uAC00\uB824\uC838\uC694.",
    submitting: "\uC81C\uBCF4 \uC911...",
    dailyLimitExceeded: "\uC77C\uC77C \uD55C\uB3C4\uC5D0 \uB3C4\uB2EC\uD588\uC5B4\uC694. \uB0B4\uC77C \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
    rateLimitExceeded: "\uC694\uCCAD\uC774 \uB108\uBB34 \uB9CE\uC544\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694."
  },
  ja: {
    buttonText: "\u30D0\u30B0\u3092\u5831\u544A",
    dialogTitle: "\u554F\u984C\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044",
    dialogDescription: "\u3069\u3093\u306A\u554F\u984C\u304C\u3042\u308A\u307E\u3057\u305F\u304B\uFF1F",
    placeholder: "\u8D77\u304D\u305F\u554F\u984C\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002\u8A73\u3057\u3044\u307B\u3069\u52A9\u304B\u308A\u307E\u3059\u3002",
    submitText: "\u9001\u4FE1\u3059\u308B",
    cancelText: "\u9589\u3058\u308B",
    successMessage: "\u9001\u4FE1\u5B8C\u4E86",
    successDescription: "\u304A\u77E5\u3089\u305B\u3044\u305F\u3060\u304D\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u78BA\u8A8D\u3057\u307E\u3059\u306D\u3002",
    viewIssue: "GitHub\u3067\u898B\u308B",
    capturedLogs: "\u53D6\u5F97\u3057\u305F\u30ED\u30B0",
    entry: "\u4EF6",
    entries: "\u4EF6",
    privacyNotice: "\u30AF\u30EA\u30C3\u30AF\u3001\u30DA\u30FC\u30B8\u9077\u79FB\u3001\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u30C7\u30FC\u30BF\u3092\u53CE\u96C6\u3057\u307E\u3059\u3002\u6A5F\u5BC6\u60C5\u5831\u306F\u81EA\u52D5\u7684\u306B\u96A0\u3055\u308C\u307E\u3059\u3002",
    submitting: "\u9001\u4FE1\u4E2D...",
    dailyLimitExceeded: "\u672C\u65E5\u306E\u4E0A\u9650\u306B\u9054\u3057\u307E\u3057\u305F\u3002\u660E\u65E5\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
    rateLimitExceeded: "\u30EA\u30AF\u30A8\u30B9\u30C8\u304C\u591A\u3059\u304E\u307E\u3059\u3002\u3057\u3070\u3089\u304F\u3057\u3066\u304B\u3089\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002"
  },
  zh: {
    buttonText: "\u53CD\u9988\u95EE\u9898",
    dialogTitle: "\u544A\u8BC9\u6211\u4EEC\u53D1\u751F\u4E86\u4EC0\u4E48",
    dialogDescription: "\u9047\u5230\u4E86\u4EC0\u4E48\u95EE\u9898\uFF1F",
    placeholder: "\u8BF7\u63CF\u8FF0\u60A8\u9047\u5230\u7684\u95EE\u9898\uFF0C\u8D8A\u8BE6\u7EC6\u8D8A\u597D\u3002",
    submitText: "\u63D0\u4EA4\u53CD\u9988",
    cancelText: "\u5173\u95ED",
    successMessage: "\u5DF2\u6536\u5230",
    successDescription: "\u611F\u8C22\u53CD\u9988\uFF01\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u67E5\u770B\u3002",
    viewIssue: "\u5728 GitHub \u67E5\u770B",
    capturedLogs: "\u5DF2\u6536\u96C6\u7684\u65E5\u5FD7",
    entry: "\u6761",
    entries: "\u6761",
    privacyNotice: "\u6211\u4EEC\u4F1A\u6536\u96C6\u70B9\u51FB\u3001\u9875\u9762\u8DF3\u8F6C\u548C\u6027\u80FD\u6570\u636E\u3002\u654F\u611F\u4FE1\u606F\u4F1A\u81EA\u52A8\u9690\u85CF\u3002",
    submitting: "\u63D0\u4EA4\u4E2D...",
    dailyLimitExceeded: "\u4ECA\u65E5\u5DF2\u8FBE\u4E0A\u9650\uFF0C\u8BF7\u660E\u5929\u518D\u8BD5\u3002",
    rateLimitExceeded: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002"
  },
  es: {
    buttonText: "Reportar problema",
    dialogTitle: "Cu\xE9ntanos qu\xE9 pas\xF3",
    dialogDescription: "\xBFQu\xE9 problema encontraste?",
    placeholder: "Cu\xE9ntanos qu\xE9 ocurri\xF3. Cuantos m\xE1s detalles, mejor.",
    submitText: "Enviar",
    cancelText: "Cerrar",
    successMessage: "\xA1Recibido!",
    successDescription: "Gracias por avisarnos. Lo revisaremos pronto.",
    viewIssue: "Ver en GitHub",
    capturedLogs: "Logs capturados",
    entry: "entrada",
    entries: "entradas",
    privacyNotice: "Recopilamos clics, navegaci\xF3n y datos de rendimiento. Los datos sensibles se ocultan autom\xE1ticamente.",
    submitting: "Enviando...",
    dailyLimitExceeded: "L\xEDmite diario alcanzado. Por favor, int\xE9ntalo ma\xF1ana.",
    rateLimitExceeded: "Demasiadas solicitudes. Por favor, espera un momento."
  }
};
var HOSTED_API_ENDPOINT = "https://inner-lens-one.vercel.app/api/report";

// src/utils/masking.ts
var MASKING_PATTERNS = [
  // Email addresses
  {
    name: "email",
    pattern: /\b[\w.-]+@[\w.-]+\.\w{2,4}\b/gi,
    replacement: "[EMAIL_REDACTED]"
  },
  // Bearer tokens
  {
    name: "bearer_token",
    pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
    replacement: "Bearer [TOKEN_REDACTED]"
  },
  // Generic API keys (common patterns)
  {
    name: "api_key_param",
    pattern: /(?:api[_-]?key|apikey|api[_-]?token)[=:]["']?[a-zA-Z0-9\-._~+/]{16,}["']?/gi,
    replacement: "api_key=[API_KEY_REDACTED]"
  },
  // Authorization headers
  {
    name: "auth_header",
    pattern: /(?:Authorization|X-API-Key|X-Auth-Token)[:\s]+["']?[a-zA-Z0-9\-._~+/]{8,}["']?/gi,
    replacement: "Authorization: [AUTH_REDACTED]"
  },
  // Credit card numbers (Visa, Mastercard, Amex, etc.)
  {
    name: "credit_card",
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    replacement: "[CARD_REDACTED]"
  },
  // Credit card with spaces/dashes
  {
    name: "credit_card_formatted",
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CARD_REDACTED]"
  },
  // SSN (US Social Security Numbers)
  {
    name: "ssn",
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: "[SSN_REDACTED]"
  },
  // Phone numbers (various formats - US)
  {
    name: "phone",
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: "[PHONE_REDACTED]"
  },
  // IPv4 addresses
  {
    name: "ipv4",
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: "[IP_REDACTED]"
  },
  // IPv6 addresses (full and compressed forms)
  {
    name: "ipv6",
    pattern: /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:)+:(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}|::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}|::1/g,
    replacement: "[IP_REDACTED]"
  },
  // AWS Access Keys
  {
    name: "aws_key",
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
    replacement: "[AWS_KEY_REDACTED]"
  },
  // AWS Secret Keys
  {
    name: "aws_secret",
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[=:\s]+["']?[a-zA-Z0-9/+=]{40}["']?/gi,
    replacement: "aws_secret_access_key=[AWS_SECRET_REDACTED]"
  },
  // GitHub tokens
  {
    name: "github_token",
    pattern: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g,
    replacement: "[GITHUB_TOKEN_REDACTED]"
  },
  // OpenAI API keys
  {
    name: "openai_key",
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    replacement: "[OPENAI_KEY_REDACTED]"
  },
  // Anthropic API keys
  {
    name: "anthropic_key",
    pattern: /sk-ant-[a-zA-Z0-9\-]{20,}/g,
    replacement: "[ANTHROPIC_KEY_REDACTED]"
  },
  // Google API keys
  {
    name: "google_key",
    pattern: /AIza[a-zA-Z0-9\-_]{35}/g,
    replacement: "[GOOGLE_KEY_REDACTED]"
  },
  // Stripe keys
  {
    name: "stripe_key",
    pattern: /(?:sk|pk)_(?:test|live)_[a-zA-Z0-9]{24,}/g,
    replacement: "[STRIPE_KEY_REDACTED]"
  },
  // JWT tokens
  {
    name: "jwt",
    pattern: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_.+/=]*/g,
    replacement: "[JWT_REDACTED]"
  },
  // Generic secrets in environment variable format
  {
    name: "env_secret",
    pattern: /(?:SECRET|PASSWORD|PASSWD|PWD|TOKEN|PRIVATE[_-]?KEY)[=:\s]+["']?[^\s"']{8,}["']?/gi,
    replacement: "[SECRET_REDACTED]"
  },
  // Database connection strings
  {
    name: "database_url",
    pattern: /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi,
    replacement: "[DATABASE_URL_REDACTED]"
  },
  // Private keys (PEM format markers)
  {
    name: "private_key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    replacement: "[PRIVATE_KEY_REDACTED]"
  }
];
function maskSensitiveData(text) {
  if (!text || typeof text !== "string") {
    return text;
  }
  let maskedText = text;
  for (const { pattern, replacement } of MASKING_PATTERNS) {
    maskedText = maskedText.replace(pattern, replacement);
  }
  return maskedText;
}
function maskSensitiveObject(obj) {
  if (obj === null || obj === void 0) {
    return obj;
  }
  if (typeof obj === "string") {
    return maskSensitiveData(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveObject(item));
  }
  if (typeof obj === "object") {
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("password") || lowerKey.includes("secret") || lowerKey.includes("token") || lowerKey.includes("apikey") || lowerKey.includes("api_key") || lowerKey.includes("private")) {
        masked[key] = "[REDACTED]";
      } else {
        masked[key] = maskSensitiveObject(value);
      }
    }
    return masked;
  }
  return obj;
}
function validateMasking(text) {
  const dangerPatterns = [
    /@.*\.\w{2,4}/i,
    // Emails
    /sk-[a-z0-9]/i,
    // API keys
    /eyJ[a-z0-9]/i,
    // JWTs
    /AKIA[A-Z0-9]/i,
    // AWS
    /ghp_[a-z0-9]/i
    // GitHub
  ];
  for (const pattern of dangerPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }
  return true;
}

// src/utils/log-capture.ts
var capturedLogs = [];
var isInitialized = false;
var originalConsole = null;
var originalFetch = null;
var captureOptions = {
  maxEntries: 50,
  maskSensitiveData: true
};
var MAX_RESPONSE_BODY_LENGTH = 1e3;
function formatLogMessage(args) {
  return args.map((arg) => {
    if (arg === null) return "null";
    if (arg === void 0) return "undefined";
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}`;
    }
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(" ");
}
function extractStack(args) {
  for (const arg of args) {
    if (arg instanceof Error && arg.stack) {
      return arg.stack;
    }
  }
  return void 0;
}
function createLogEntry(level, args) {
  let message = formatLogMessage(args);
  let stack = extractStack(args);
  if (captureOptions.maskSensitiveData) {
    message = maskSensitiveData(message);
    if (stack) {
      stack = maskSensitiveData(stack);
    }
  }
  return {
    level,
    message,
    timestamp: Date.now(),
    stack
  };
}
function addLogEntry(entry) {
  capturedLogs.push(entry);
  if (capturedLogs.length > captureOptions.maxEntries) {
    capturedLogs = capturedLogs.slice(-captureOptions.maxEntries);
  }
}
function truncateString(str, maxLength) {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + "... [TRUNCATED]";
}
function extractRequestBody(init) {
  if (!init?.body) {
    return void 0;
  }
  if (typeof init.body === "string") {
    return init.body;
  }
  return void 0;
}
async function safeReadResponseBody(response) {
  try {
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();
    return truncateString(text, MAX_RESPONSE_BODY_LENGTH);
  } catch {
    return "[Unable to read response body]";
  }
}
function createNetworkLogEntry(method, url, requestBody, status, responseBody, duration) {
  const parts = [
    `[NETWORK] ${method} ${url}`,
    `Status: ${status}`,
    `Duration: ${duration}ms`
  ];
  if (requestBody) {
    let maskedRequestBody = captureOptions.maskSensitiveData ? maskSensitiveData(requestBody) : requestBody;
    maskedRequestBody = truncateString(maskedRequestBody, MAX_RESPONSE_BODY_LENGTH);
    parts.push(`Request Body: ${maskedRequestBody}`);
  }
  let maskedResponseBody = captureOptions.maskSensitiveData ? maskSensitiveData(responseBody) : responseBody;
  parts.push(`Response Body: ${maskedResponseBody}`);
  const message = parts.join("\n");
  return {
    level: status >= 400 ? "error" : "info",
    message,
    timestamp: Date.now()
  };
}
function createFetchInterceptor() {
  return async function interceptedFetch(input, init) {
    const startTime = Date.now();
    let method = "GET";
    let url;
    if (input instanceof Request) {
      method = input.method;
      url = input.url;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input;
    }
    if (init?.method) {
      method = init.method;
    }
    const requestBody = extractRequestBody(init);
    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;
      const responseBody = await safeReadResponseBody(response);
      const entry = createNetworkLogEntry(
        method,
        url,
        requestBody,
        response.status,
        responseBody,
        duration
      );
      addLogEntry(entry);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const entry = createNetworkLogEntry(
        method,
        url,
        requestBody,
        0,
        `[Network Error: ${errorMessage}]`,
        duration
      );
      entry.level = "error";
      addLogEntry(entry);
      throw error;
    }
  };
}
function initLogCapture(options) {
  if (typeof window === "undefined") {
    return;
  }
  if (isInitialized) {
    if (options) {
      captureOptions = { ...captureOptions, ...options };
    }
    return;
  }
  if (options) {
    captureOptions = { ...captureOptions, ...options };
  }
  originalConsole = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console)
  };
  console.error = (...args) => {
    const entry = createLogEntry("error", args);
    addLogEntry(entry);
    originalConsole?.error(...args);
  };
  console.warn = (...args) => {
    const entry = createLogEntry("warn", args);
    addLogEntry(entry);
    originalConsole?.warn(...args);
  };
  if (typeof window.fetch === "function") {
    originalFetch = window.fetch.bind(window);
    window.fetch = createFetchInterceptor();
  }
  window.addEventListener("error", (event) => {
    const entry = createLogEntry("error", [
      `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
    ]);
    if (event.error?.stack) {
      entry.stack = captureOptions.maskSensitiveData ? maskSensitiveData(event.error.stack) : event.error.stack;
    }
    addLogEntry(entry);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    let message = "Unhandled Promise Rejection";
    if (reason instanceof Error) {
      message = `Unhandled Promise Rejection: ${reason.message}`;
    } else if (typeof reason === "string") {
      message = `Unhandled Promise Rejection: ${reason}`;
    } else {
      try {
        message = `Unhandled Promise Rejection: ${JSON.stringify(reason)}`;
      } catch {
        message = `Unhandled Promise Rejection: ${String(reason)}`;
      }
    }
    const entry = createLogEntry("error", [message]);
    if (reason instanceof Error && reason.stack) {
      entry.stack = captureOptions.maskSensitiveData ? maskSensitiveData(reason.stack) : reason.stack;
    }
    addLogEntry(entry);
  });
  isInitialized = true;
}
function getCapturedLogs() {
  return [...capturedLogs];
}
function clearCapturedLogs() {
  capturedLogs = [];
}
function restoreConsole() {
  if (!isInitialized || !originalConsole) {
    return;
  }
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.log = originalConsole.log;
  if (originalFetch && typeof window !== "undefined") {
    window.fetch = originalFetch;
    originalFetch = null;
  }
  originalConsole = null;
  isInitialized = false;
}
function addCustomLog(level, message, stack) {
  const entry = {
    level,
    message: captureOptions.maskSensitiveData ? maskSensitiveData(message) : message,
    timestamp: Date.now(),
    stack: stack ? captureOptions.maskSensitiveData ? maskSensitiveData(stack) : stack : void 0
  };
  addLogEntry(entry);
}

// src/utils/user-action-capture.ts
var isInitialized2 = false;
var capturedActions = [];
var config;
var scrollTimeout = null;
var inputTimeouts = /* @__PURE__ */ new Map();
var lastScrollTime = 0;
var eventListeners = [];
var DEFAULT_CONFIG = {
  maxActions: 50,
  maskSensitiveData: true,
  captureActions: ["click", "dblclick", "input", "change", "submit", "scroll"],
  scrollThrottleMs: 250,
  inputDebounceMs: 300,
  ignoreSelectors: []
};
function getElementSelector(element) {
  const parts = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    const meaningfulClasses = Array.from(current.classList).filter((cls) => !cls.match(/^(p-|m-|w-|h-|flex|grid|text-|bg-|border-)/)).slice(0, 2);
    if (meaningfulClasses.length > 0) {
      selector += `.${meaningfulClasses.join(".")}`;
    }
    const dataTestId = current.getAttribute("data-testid") || current.getAttribute("data-test-id");
    if (dataTestId) {
      selector += `[data-testid="${dataTestId}"]`;
    }
    const name = current.getAttribute("name");
    if (name && ["input", "select", "textarea"].includes(current.tagName.toLowerCase())) {
      selector += `[name="${name}"]`;
    }
    const ariaLabel = current.getAttribute("aria-label");
    if (ariaLabel) {
      selector += `[aria-label="${ariaLabel.slice(0, 30)}"]`;
    }
    parts.unshift(selector);
    current = current.parentElement;
    if (parts.length >= 4) break;
  }
  return parts.join(" > ") || element.tagName.toLowerCase();
}
function shouldIgnoreElement(element) {
  return config.ignoreSelectors.some((selector) => {
    try {
      return element.matches(selector) || element.closest(selector) !== null;
    } catch {
      return false;
    }
  });
}
function maskValue(value, element) {
  if (!config.maskSensitiveData) return value;
  if (element instanceof HTMLInputElement && (element.type === "password" || element.type === "hidden")) {
    return "[HIDDEN]";
  }
  const name = element.getAttribute("name")?.toLowerCase() ?? "";
  const id = element.id?.toLowerCase() ?? "";
  const sensitivePatterns = [
    "password",
    "secret",
    "token",
    "api",
    "key",
    "credit",
    "card",
    "cvv",
    "ssn",
    "social"
  ];
  if (sensitivePatterns.some((p) => name.includes(p) || id.includes(p))) {
    return "[SENSITIVE]";
  }
  return maskSensitiveData(value);
}
function addAction(action) {
  capturedActions.push(action);
  if (capturedActions.length > config.maxActions) {
    capturedActions = capturedActions.slice(-config.maxActions);
  }
}
function addEventListener(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  eventListeners.push({
    target,
    type,
    handler,
    options
  });
}
function handleClick(event) {
  const target = event.target;
  if (!target || shouldIgnoreElement(target)) return;
  const action = {
    type: event.type === "dblclick" ? "dblclick" : "click",
    target: getElementSelector(target),
    timestamp: Date.now(),
    position: { x: event.clientX, y: event.clientY }
  };
  const textContent = target.innerText?.slice(0, 50)?.trim();
  const ariaLabel = target.getAttribute("aria-label");
  if (textContent || ariaLabel) {
    action.metadata = { label: textContent || ariaLabel };
  }
  addAction(action);
}
function handleInput(event) {
  const target = event.target;
  if (!target || shouldIgnoreElement(target)) return;
  const selector = getElementSelector(target);
  const existingTimeout = inputTimeouts.get(selector);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  const timeout = setTimeout(() => {
    const value = target.value ?? "";
    const maskedValue = maskValue(value, target);
    addAction({
      type: "input",
      target: selector,
      timestamp: Date.now(),
      value: maskedValue.slice(0, 100)
      // Limit value length
    });
    inputTimeouts.delete(selector);
  }, config.inputDebounceMs);
  inputTimeouts.set(selector, timeout);
}
function handleChange(event) {
  const target = event.target;
  if (!target || shouldIgnoreElement(target)) return;
  let value = "";
  if (target instanceof HTMLSelectElement) {
    value = target.options[target.selectedIndex]?.text ?? "";
  } else if (target instanceof HTMLInputElement) {
    if (target.type === "checkbox" || target.type === "radio") {
      value = target.checked ? "checked" : "unchecked";
    } else {
      value = maskValue(target.value, target);
    }
  }
  addAction({
    type: "change",
    target: getElementSelector(target),
    timestamp: Date.now(),
    value: value.slice(0, 100)
  });
}
function handleScroll() {
  const now = Date.now();
  if (now - lastScrollTime < config.scrollThrottleMs) {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      addScrollAction();
    }, config.scrollThrottleMs);
    return;
  }
  addScrollAction();
  lastScrollTime = now;
}
function addScrollAction() {
  addAction({
    type: "scroll",
    target: "window",
    timestamp: Date.now(),
    position: {
      x: window.scrollX,
      y: window.scrollY
    },
    metadata: {
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollPercent: Math.round(
        window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100
      )
    }
  });
}
function handleSubmit(event) {
  const target = event.target;
  if (!target || shouldIgnoreElement(target)) return;
  addAction({
    type: "submit",
    target: getElementSelector(target),
    timestamp: Date.now(),
    metadata: {
      formAction: target.action,
      formMethod: target.method
    }
  });
}
function handleFocus(event) {
  const target = event.target;
  if (!target || shouldIgnoreElement(target)) return;
  const interactiveElements = ["input", "textarea", "select", "button", "a"];
  if (!interactiveElements.includes(target.tagName.toLowerCase())) return;
  addAction({
    type: "focus",
    target: getElementSelector(target),
    timestamp: Date.now()
  });
}
function handleKeydown(event) {
  const target = event.target;
  if (!target || shouldIgnoreElement(target)) return;
  const specialKeys = ["Enter", "Escape", "Tab", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  if (!specialKeys.includes(event.key)) return;
  addAction({
    type: "keydown",
    target: getElementSelector(target),
    timestamp: Date.now(),
    key: event.key,
    metadata: {
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    }
  });
}
function handleClipboard(event) {
  const target = event.target;
  if (!target || shouldIgnoreElement(target)) return;
  addAction({
    type: event.type,
    target: getElementSelector(target),
    timestamp: Date.now()
    // Don't capture clipboard content for privacy
  });
}
function initUserActionCapture(userConfig = {}) {
  if (typeof window === "undefined") return;
  if (isInitialized2) {
    config = { ...config, ...userConfig };
    return;
  }
  config = { ...DEFAULT_CONFIG, ...userConfig };
  const actions = config.captureActions;
  if (actions.includes("click")) {
    addEventListener(document, "click", handleClick, { capture: true });
  }
  if (actions.includes("dblclick")) {
    addEventListener(document, "dblclick", handleClick, { capture: true });
  }
  if (actions.includes("input")) {
    addEventListener(document, "input", handleInput, { capture: true });
  }
  if (actions.includes("change")) {
    addEventListener(document, "change", handleChange, { capture: true });
  }
  if (actions.includes("scroll")) {
    addEventListener(window, "scroll", handleScroll, { passive: true });
  }
  if (actions.includes("submit")) {
    addEventListener(document, "submit", handleSubmit, { capture: true });
  }
  if (actions.includes("focus")) {
    addEventListener(document, "focusin", handleFocus, { capture: true });
  }
  if (actions.includes("keydown")) {
    addEventListener(document, "keydown", handleKeydown, { capture: true });
  }
  if (actions.includes("copy")) {
    addEventListener(document, "copy", handleClipboard, { capture: true });
  }
  if (actions.includes("paste")) {
    addEventListener(document, "paste", handleClipboard, { capture: true });
  }
  isInitialized2 = true;
}
function getCapturedUserActions() {
  return [...capturedActions];
}
function clearCapturedUserActions() {
  capturedActions = [];
}
function stopUserActionCapture() {
  if (!isInitialized2) return;
  for (const { target, type, handler, options } of eventListeners) {
    target.removeEventListener(type, handler, options);
  }
  eventListeners.length = 0;
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }
  for (const timeout of inputTimeouts.values()) {
    clearTimeout(timeout);
  }
  inputTimeouts.clear();
  isInitialized2 = false;
}

// src/utils/navigation-capture.ts
var isInitialized3 = false;
var capturedNavigations = [];
var config2;
var currentUrl = "";
var pageLoadTime = 0;
var originalPushState = null;
var originalReplaceState = null;
var DEFAULT_CONFIG2 = {
  maxEntries: 20,
  maskSensitiveData: true,
  sensitiveParams: ["token", "key", "secret", "password", "auth", "session", "api_key", "apikey", "access_token"],
  trackHashChanges: true,
  onNavigation: () => {
  }
};
function maskUrl(url) {
  if (!config2.maskSensitiveData) return url;
  try {
    const urlObj = new URL(url, window.location.origin);
    for (const param of config2.sensitiveParams) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, "[REDACTED]");
      }
    }
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (value !== "[REDACTED]") {
        const maskedValue = maskSensitiveData(value);
        if (maskedValue !== value) {
          urlObj.searchParams.set(key, maskedValue);
        }
      }
    }
    return urlObj.toString();
  } catch {
    return maskSensitiveData(url);
  }
}
function addNavigation(entry) {
  capturedNavigations.push(entry);
  if (capturedNavigations.length > config2.maxEntries) {
    capturedNavigations = capturedNavigations.slice(-config2.maxEntries);
  }
  config2.onNavigation(entry);
}
function createHistoryHandler(type, original) {
  return function(data, unused, url) {
    const from = maskUrl(currentUrl);
    original.call(this, data, unused, url);
    const to = maskUrl(window.location.href);
    currentUrl = window.location.href;
    if (from !== to) {
      addNavigation({
        type,
        timestamp: Date.now(),
        from,
        to,
        metadata: {
          stateData: typeof data === "object" ? "[state object]" : data
        }
      });
    }
  };
}
function handlePopState(_event) {
  const from = maskUrl(currentUrl);
  const to = maskUrl(window.location.href);
  currentUrl = window.location.href;
  if (from !== to) {
    addNavigation({
      type: "popstate",
      timestamp: Date.now(),
      from,
      to,
      metadata: {
        historyLength: history.length
      }
    });
  }
}
function handleHashChange(event) {
  addNavigation({
    type: "hashchange",
    timestamp: Date.now(),
    from: maskUrl(event.oldURL),
    to: maskUrl(event.newURL)
  });
}
function handleBeforeUnload() {
  addNavigation({
    type: "beforeunload",
    timestamp: Date.now(),
    from: maskUrl(currentUrl),
    to: "[leaving page]",
    duration: Date.now() - pageLoadTime,
    metadata: {
      timeOnPage: Date.now() - pageLoadTime
    }
  });
}
function initNavigationCapture(userConfig = {}) {
  if (typeof window === "undefined") return;
  if (isInitialized3) {
    config2 = { ...config2, ...userConfig };
    return;
  }
  config2 = { ...DEFAULT_CONFIG2, ...userConfig };
  currentUrl = window.location.href;
  pageLoadTime = Date.now();
  addNavigation({
    type: "pageload",
    timestamp: pageLoadTime,
    from: document.referrer ? maskUrl(document.referrer) : "[direct]",
    to: maskUrl(currentUrl),
    metadata: {
      referrer: document.referrer ? maskUrl(document.referrer) : null,
      documentReadyState: document.readyState
    }
  });
  originalPushState = history.pushState.bind(history);
  history.pushState = createHistoryHandler("pushstate", originalPushState);
  originalReplaceState = history.replaceState.bind(history);
  history.replaceState = createHistoryHandler("replacestate", originalReplaceState);
  window.addEventListener("popstate", handlePopState);
  if (config2.trackHashChanges) {
    window.addEventListener("hashchange", handleHashChange);
  }
  window.addEventListener("beforeunload", handleBeforeUnload);
  isInitialized3 = true;
}
function getCapturedNavigations() {
  return [...capturedNavigations];
}
function clearCapturedNavigations() {
  capturedNavigations = [];
}
function stopNavigationCapture() {
  if (!isInitialized3) return;
  if (originalPushState) {
    history.pushState = originalPushState;
    originalPushState = null;
  }
  if (originalReplaceState) {
    history.replaceState = originalReplaceState;
    originalReplaceState = null;
  }
  window.removeEventListener("popstate", handlePopState);
  window.removeEventListener("hashchange", handleHashChange);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  isInitialized3 = false;
}

// src/utils/performance-capture.ts
var isInitialized4 = false;
var config3;
var metrics = {};
var observers = [];
var DEFAULT_CONFIG3 = {
  trackCoreWebVitals: true,
  trackResources: true,
  maxResourceEntries: 5,
  trackMemory: true,
  onMetric: () => {
  }
};
function createObserver(type, callback) {
  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });
    observer.observe({ type, buffered: true });
    observers.push(observer);
    return observer;
  } catch {
    return null;
  }
}
function initLCP() {
  createObserver("largest-contentful-paint", (entries) => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      metrics.LCP = Math.round(lastEntry.startTime);
      config3.onMetric("LCP", metrics.LCP);
    }
  });
}
function initFID() {
  createObserver("first-input", (entries) => {
    const firstEntry = entries[0];
    if (firstEntry) {
      metrics.FID = Math.round(firstEntry.processingStart - firstEntry.startTime);
      config3.onMetric("FID", metrics.FID);
    }
  });
}
function initCLS() {
  let clsValue = 0;
  let sessionValue = 0;
  let sessionEntries = [];
  createObserver("layout-shift", (entries) => {
    for (const entry of entries) {
      if (!entry.hadRecentInput) {
        const firstSessionEntry = sessionEntries[0];
        const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
        if (sessionEntries.length > 0 && firstSessionEntry && lastSessionEntry && (entry.startTime - lastSessionEntry.startTime > 1e3 || entry.startTime - firstSessionEntry.startTime > 5e3)) {
          if (sessionValue > clsValue) {
            clsValue = sessionValue;
          }
          sessionValue = 0;
          sessionEntries = [];
        }
        sessionEntries.push(entry);
        sessionValue += entry.value;
      }
    }
    metrics.CLS = Math.round(Math.max(clsValue, sessionValue) * 1e3) / 1e3;
    config3.onMetric("CLS", metrics.CLS);
  });
}
function initINP() {
  const interactions = [];
  createObserver("event", (entries) => {
    for (const entry of entries) {
      if (entry.interactionId) {
        interactions.push(entry.duration);
      }
    }
    if (interactions.length > 0) {
      interactions.sort((a, b) => a - b);
      const p98Index = Math.floor(interactions.length * 0.98);
      metrics.INP = interactions[p98Index];
      config3.onMetric("INP", metrics.INP ?? 0);
    }
  });
}
function initFCP() {
  createObserver("paint", (entries) => {
    for (const entry of entries) {
      if (entry.name === "first-contentful-paint") {
        metrics.FCP = Math.round(entry.startTime);
        config3.onMetric("FCP", metrics.FCP);
      }
    }
  });
}
function getTTFB() {
  const navigation = performance.getEntriesByType(
    "navigation"
  )[0];
  if (navigation) {
    const ttfb = Math.round(navigation.responseStart - navigation.requestStart);
    metrics.TTFB = ttfb;
    config3.onMetric("TTFB", ttfb);
    return ttfb;
  }
  return void 0;
}
function initPerformanceCapture(userConfig = {}) {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return;
  }
  if (isInitialized4) {
    config3 = { ...config3, ...userConfig };
    return;
  }
  config3 = { ...DEFAULT_CONFIG3, ...userConfig };
  if (config3.trackCoreWebVitals) {
    initLCP();
    initFID();
    initCLS();
    initINP();
    initFCP();
    if (document.readyState === "complete") {
      getTTFB();
    } else {
      window.addEventListener("load", () => getTTFB(), { once: true });
    }
  }
  isInitialized4 = true;
}
function getCoreWebVitals() {
  return { ...metrics };
}
function getResourceTiming() {
  if (!config3?.trackResources) {
    return {
      total: 0,
      byType: {},
      slowest: [],
      largest: []
    };
  }
  const resources = performance.getEntriesByType(
    "resource"
  );
  const byType = {};
  const resourceTimings = [];
  for (const resource of resources) {
    const type = resource.initiatorType || "other";
    const size = resource.transferSize || 0;
    const duration = resource.duration;
    if (!byType[type]) {
      byType[type] = { count: 0, totalSize: 0, totalDuration: 0 };
    }
    byType[type].count++;
    byType[type].totalSize += size;
    byType[type].totalDuration += duration;
    resourceTimings.push({
      name: resource.name,
      type,
      duration: Math.round(duration),
      size,
      startTime: Math.round(resource.startTime)
    });
  }
  const slowest = [...resourceTimings].sort((a, b) => b.duration - a.duration).slice(0, config3.maxResourceEntries);
  const largest = [...resourceTimings].sort((a, b) => b.size - a.size).slice(0, config3.maxResourceEntries);
  return {
    total: resources.length,
    byType,
    slowest,
    largest
  };
}
function getMemoryInfo() {
  if (!config3?.trackMemory) return void 0;
  const memory = performance.memory;
  if (memory) {
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }
  return void 0;
}
function getConnectionInfo() {
  const nav = navigator;
  if (nav.connection) {
    return {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt,
      saveData: nav.connection.saveData
    };
  }
  return void 0;
}
function getNavigationTiming() {
  const navigation = performance.getEntriesByType(
    "navigation"
  )[0];
  if (navigation) {
    return {
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
      loadComplete: Math.round(navigation.loadEventEnd),
      timeToInteractive: Math.round(navigation.domInteractive)
    };
  }
  const timing = performance.timing;
  if (timing) {
    const navStart = timing.navigationStart;
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - navStart,
      loadComplete: timing.loadEventEnd - navStart,
      timeToInteractive: timing.domInteractive - navStart
    };
  }
  return {
    domContentLoaded: 0,
    loadComplete: 0
  };
}
function getPerformanceData() {
  return {
    coreWebVitals: getCoreWebVitals(),
    timing: getNavigationTiming(),
    resources: getResourceTiming(),
    memory: getMemoryInfo(),
    connection: getConnectionInfo(),
    timestamp: Date.now()
  };
}
function stopPerformanceCapture() {
  if (!isInitialized4) return;
  for (const observer of observers) {
    observer.disconnect();
  }
  observers = [];
  isInitialized4 = false;
}

// src/utils/session-replay.ts
var currentState = "idle";
var stopFn = null;
var eventsBuffer = [[]];
var recordingStartTime = null;
var config4;
var DEFAULT_CONFIG4 = {
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
  config4 = { ...DEFAULT_CONFIG4, ...userConfig };
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
            config4.maxBufferDuration / config4.checkoutInterval
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
      checkoutEveryNms: config4.checkoutInterval,
      maskAllInputs: config4.maskInputs,
      blockSelector: config4.blockSelectors.join(", ") || void 0,
      maskTextSelector: config4.maskSelectors.join(", ") || void 0,
      sampling: config4.sampling,
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
    config4.onStart();
  } catch (error) {
    currentState = "error";
    const err = error instanceof Error ? error : new Error(String(error));
    config4.onError(err);
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
  config4.onStop();
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
async function compressReplayData(data) {
  const jsonString = JSON.stringify(data.events);
  const blob = new Blob([jsonString], { type: "application/json" });
  if (typeof CompressionStream !== "undefined") {
    const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(stream).blob();
  }
  return blob;
}

// src/utils/styles.ts
var getPositionStyles = (position = "bottom-right") => {
  const base = { position: "fixed", zIndex: 9999 };
  switch (position) {
    case "bottom-left":
      return { ...base, bottom: "20px", left: "20px" };
    case "top-right":
      return { ...base, top: "20px", right: "20px" };
    case "top-left":
      return { ...base, top: "20px", left: "20px" };
    case "bottom-right":
    default:
      return { ...base, bottom: "20px", right: "20px" };
  }
};
var BUTTON_SIZES = {
  sm: { button: "40px", icon: 18 },
  md: { button: "48px", icon: 20 },
  lg: { button: "56px", icon: 24 }
};
var createStyles = (config5) => {
  const buttonColor = config5?.buttonColor ?? "#6366f1";
  const sizeConfig = BUTTON_SIZES[config5?.buttonSize ?? "lg"];
  return {
    triggerButton: {
      ...getPositionStyles(config5?.buttonPosition),
      width: sizeConfig.button,
      height: sizeConfig.button,
      borderRadius: "50%",
      backgroundColor: buttonColor,
      color: "#ffffff",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
      outline: "none"
    },
    iconSize: sizeConfig.icon,
    triggerButtonHover: {
      transform: "scale(1.05)",
      boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)"
    },
    // Modal overlay
    overlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1e4,
      padding: "20px"
    },
    // Modal dialog
    dialog: {
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      maxWidth: "500px",
      width: "100%",
      maxHeight: "80vh",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)"
    },
    // Dialog header
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: "1px solid #e5e7eb"
    },
    headerTitle: {
      margin: 0,
      fontSize: "18px",
      fontWeight: 600,
      color: "#111827",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    closeButton: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "8px",
      minWidth: "44px",
      minHeight: "44px",
      color: "#4b5563",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "8px",
      transition: "background-color 0.15s ease"
    },
    closeButtonHover: {
      backgroundColor: "#f3f4f6"
    },
    // Dialog content
    content: {
      padding: "20px",
      overflowY: "auto",
      flex: 1
    },
    // Form elements
    label: {
      display: "block",
      marginBottom: "8px",
      fontSize: "14px",
      fontWeight: 500,
      color: "#374151",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    textarea: {
      width: "100%",
      minHeight: "120px",
      padding: "12px",
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      fontSize: "14px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      resize: "vertical",
      outline: "none",
      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      boxSizing: "border-box",
      color: "#111827",
      backgroundColor: "#ffffff"
    },
    textareaFocus: {
      borderColor: buttonColor,
      boxShadow: `0 0 0 3px ${buttonColor}20`
    },
    // Log preview
    logPreview: {
      marginTop: "16px",
      padding: "12px",
      backgroundColor: "#f9fafb",
      borderRadius: "8px",
      border: "1px solid #e5e7eb"
    },
    logPreviewHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "8px"
    },
    logPreviewTitle: {
      fontSize: "12px",
      fontWeight: 500,
      color: "#4b5563",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    logCount: {
      fontSize: "12px",
      color: "#6b7280",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    logList: {
      maxHeight: "150px",
      overflowY: "auto",
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      fontSize: "12px"
    },
    logEntry: {
      padding: "4px 0",
      borderBottom: "1px solid #e5e7eb",
      wordBreak: "break-word",
      color: "#374151"
    },
    logError: {
      color: "#dc2626"
    },
    logWarn: {
      color: "#d97706"
    },
    // Footer with actions
    footer: {
      display: "flex",
      gap: "12px",
      padding: "16px 20px",
      borderTop: "1px solid #e5e7eb",
      backgroundColor: "#f9fafb"
    },
    submitButton: {
      flex: 1,
      padding: "10px 16px",
      backgroundColor: buttonColor,
      color: "#ffffff",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: 500,
      cursor: "pointer",
      transition: "background-color 0.15s ease, transform 0.1s ease",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    submitButtonDisabled: {
      opacity: 0.5,
      cursor: "not-allowed"
    },
    cancelButton: {
      padding: "10px 16px",
      backgroundColor: "#ffffff",
      color: "#374151",
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: 500,
      cursor: "pointer",
      transition: "background-color 0.15s ease",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    // Success/Error states
    successMessage: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px",
      textAlign: "center"
    },
    successIcon: {
      width: "48px",
      height: "48px",
      borderRadius: "50%",
      backgroundColor: "#dcfce7",
      color: "#16a34a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "16px"
    },
    errorMessage: {
      padding: "12px",
      backgroundColor: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: "8px",
      color: "#dc2626",
      fontSize: "14px",
      marginTop: "12px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    // Loading spinner
    spinner: {
      display: "inline-block",
      width: "16px",
      height: "16px",
      border: "2px solid #ffffff",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "inner-lens-spin 0.8s linear infinite"
    },
    // Privacy notice
    privacyNotice: {
      marginTop: "16px",
      padding: "12px",
      backgroundColor: "#eff6ff",
      borderRadius: "8px",
      fontSize: "12px",
      color: "#1e40af",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }
  };
};
var keyframesCSS = `
@keyframes inner-lens-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Spinner class - ensures animation works regardless of inline style order */
.inner-lens-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: inner-lens-spin 0.8s linear infinite;
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  #inner-lens-widget * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Mobile responsive adjustments */
@media (max-width: 640px) {
  #inner-lens-widget [role="dialog"] > div {
    margin: 10px;
    max-height: 90vh;
  }
}

/* Focus visible for keyboard users */
#inner-lens-widget button:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

#inner-lens-widget textarea:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
`;

// src/core/InnerLensCore.ts
var InnerLensCore = class {
  config;
  container = null;
  widgetRoot = null;
  isOpen = false;
  submissionState = "idle";
  description = "";
  logs = [];
  userActions = [];
  navigations = [];
  performance = null;
  sessionReplayData = null;
  pageContext = null;
  pageLoadTime = Date.now();
  errorMessage = null;
  issueUrl = null;
  styleElement = null;
  mounted = false;
  constructor(config5 = {}) {
    const mergedStyles = {
      ...config5.styles,
      buttonPosition: config5.position ?? config5.styles?.buttonPosition ?? "bottom-right",
      buttonColor: config5.buttonColor ?? config5.styles?.buttonColor ?? "#6366f1",
      buttonSize: config5.buttonSize ?? config5.styles?.buttonSize ?? "lg"
    };
    const lang = config5.language ?? "en";
    const texts = WIDGET_TEXTS[lang] ?? WIDGET_TEXTS.en;
    this.config = {
      endpoint: HOSTED_API_ENDPOINT,
      labels: ["inner-lens"],
      captureConsoleLogs: true,
      maxLogEntries: 50,
      maskSensitiveData: true,
      // Extended capture options
      captureUserActions: true,
      captureNavigation: true,
      capturePerformance: true,
      captureSessionReplay: false,
      hidden: false,
      language: lang,
      // UI Text defaults from i18n (can be overridden by config)
      buttonText: texts.buttonText,
      dialogTitle: texts.dialogTitle,
      dialogDescription: texts.dialogDescription,
      submitText: texts.submitText,
      cancelText: texts.cancelText,
      successMessage: texts.successMessage,
      ...config5,
      styles: mergedStyles
    };
  }
  /**
   * Get i18n texts for the current language
   */
  getTexts() {
    const lang = this.config.language ?? "en";
    return WIDGET_TEXTS[lang] ?? WIDGET_TEXTS.en;
  }
  isHidden() {
    return this.config.hidden === true;
  }
  /**
   * Mount the widget to the DOM
   */
  mount(container) {
    if (this.mounted || this.isHidden()) return;
    if (typeof window === "undefined") {
      console.warn("InnerLens: Cannot mount in non-browser environment");
      return;
    }
    this.container = container ?? this.config.container ?? document.body;
    if (this.config.captureConsoleLogs) {
      initLogCapture({
        maxEntries: this.config.maxLogEntries,
        maskSensitiveData: this.config.maskSensitiveData
      });
    }
    if (this.config.captureUserActions) {
      initUserActionCapture({
        maskSensitiveData: this.config.maskSensitiveData
      });
    }
    if (this.config.captureNavigation) {
      initNavigationCapture({
        maskSensitiveData: this.config.maskSensitiveData
      });
    }
    if (this.config.capturePerformance) {
      initPerformanceCapture();
    }
    if (this.config.captureSessionReplay) {
      startSessionReplay({
        maskInputs: true
      }).catch((err) => {
        console.warn("[inner-lens] Session replay failed to start:", err);
      });
    }
    this.injectStyles();
    this.widgetRoot = document.createElement("div");
    this.widgetRoot.id = "inner-lens-widget";
    this.widgetRoot.setAttribute("data-inner-lens", "true");
    this.container.appendChild(this.widgetRoot);
    this.renderTrigger();
    document.addEventListener("keydown", this.handleKeyDown);
    this.mounted = true;
  }
  /**
   * Unmount the widget from the DOM
   */
  unmount() {
    if (!this.mounted) return;
    document.removeEventListener("keydown", this.handleKeyDown);
    if (this.config.captureConsoleLogs) {
      restoreConsole();
    }
    if (this.config.captureUserActions) {
      stopUserActionCapture();
    }
    if (this.config.captureNavigation) {
      stopNavigationCapture();
    }
    if (this.config.capturePerformance) {
      stopPerformanceCapture();
    }
    if (this.config.captureSessionReplay) {
      stopSessionReplay();
    }
    if (this.widgetRoot) {
      this.widgetRoot.remove();
      this.widgetRoot = null;
    }
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    this.mounted = false;
  }
  /**
   * Programmatically open the dialog
   */
  open() {
    if (this.isHidden() || !this.mounted) return;
    this.isOpen = true;
    this.logs = getCapturedLogs();
    if (this.config.captureUserActions) {
      this.userActions = getCapturedUserActions();
    }
    if (this.config.captureNavigation) {
      this.navigations = getCapturedNavigations();
    }
    if (this.config.capturePerformance) {
      const perfData = getPerformanceData();
      this.performance = {
        coreWebVitals: perfData.coreWebVitals,
        timing: perfData.timing,
        resourceCount: perfData.resources.total,
        memoryUsage: perfData.memory?.usedJSHeapSize
      };
    }
    if (this.config.captureSessionReplay) {
      this.sessionReplayData = getSessionReplaySnapshot();
    }
    this.pageContext = this.capturePageContext();
    this.render();
    this.config.onOpen?.();
  }
  capturePageContext() {
    return {
      route: window.location.href,
      pathname: window.location.pathname,
      hash: window.location.hash,
      title: document.title,
      timeOnPage: Date.now() - this.pageLoadTime,
      referrer: document.referrer || void 0,
      componentStack: this.getReactComponentStack()
    };
  }
  getReactComponentStack() {
    const errorBoundaryStack = window.__INNER_LENS_COMPONENT_STACK__;
    if (errorBoundaryStack) {
      return errorBoundaryStack;
    }
    const reactRoot = document.getElementById("root") || document.getElementById("__next");
    if (reactRoot) {
      const fiberKey = Object.keys(reactRoot).find((key) => key.startsWith("__reactFiber$"));
      if (fiberKey) {
        try {
          const fiber = reactRoot[fiberKey];
          const componentNames = [];
          let current = fiber;
          let depth = 0;
          const MAX_DEPTH = 10;
          while (current && depth < MAX_DEPTH) {
            if (current.type && typeof current.type === "function" && current.type.name) {
              componentNames.push(current.type.name);
            }
            current = current.return;
            depth++;
          }
          if (componentNames.length > 0) {
            return componentNames.reverse().join(" > ");
          }
        } catch {
          return void 0;
        }
      }
    }
    return void 0;
  }
  /**
   * Programmatically close the dialog
   */
  close() {
    this.isOpen = false;
    this.submissionState = "idle";
    this.errorMessage = null;
    this.description = "";
    this.issueUrl = null;
    this.render();
    this.config.onClose?.();
  }
  /**
   * Check if widget is currently open
   */
  get isDialogOpen() {
    return this.isOpen;
  }
  handleKeyDown = (e) => {
    if (e.key === "Escape" && this.isOpen) {
      this.close();
      return;
    }
    if (e.key === "Tab" && this.isOpen && this.widgetRoot) {
      const dialog = this.widgetRoot.querySelector("#inner-lens-dialog");
      if (!dialog) return;
      const focusableElements = dialog.querySelectorAll(
        'button, textarea, input, a[href], [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  injectStyles() {
    if (this.styleElement) return;
    this.styleElement = document.createElement("style");
    this.styleElement.textContent = keyframesCSS;
    this.styleElement.setAttribute("data-inner-lens-styles", "true");
    document.head.appendChild(this.styleElement);
  }
  renderTrigger() {
    if (!this.widgetRoot) return;
    const styles = createStyles(this.config.styles);
    const iconSize = styles.iconSize;
    this.widgetRoot.innerHTML = `
      <button
        type="button"
        id="inner-lens-trigger"
        aria-label="${this.escapeHtml(this.config.buttonText)}"
        title="${this.escapeHtml(this.config.buttonText)}"
        style="${this.styleToString(styles.triggerButton)}"
      >
        ${this.getBugIcon(iconSize)}
      </button>
    `;
    const trigger = this.widgetRoot.querySelector("#inner-lens-trigger");
    trigger?.addEventListener("click", () => this.open());
    trigger?.addEventListener("mouseenter", (e) => {
      const btn = e.target;
      btn.style.transform = "scale(1.05)";
      btn.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
    });
    trigger?.addEventListener("mouseleave", (e) => {
      const btn = e.target;
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    });
  }
  render() {
    if (!this.widgetRoot) return;
    const styles = createStyles(this.config.styles);
    const iconSize = styles.iconSize;
    if (!this.isOpen) {
      this.renderTrigger();
      return;
    }
    const successContent = this.submissionState === "success" ? this.renderSuccess(styles) : "";
    const formContent = this.submissionState !== "success" ? this.renderForm(styles) : "";
    this.widgetRoot.innerHTML = `
      <button
        type="button"
        id="inner-lens-trigger"
        aria-label="${this.escapeHtml(this.config.buttonText)}"
        title="${this.escapeHtml(this.config.buttonText)}"
        style="${this.styleToString(styles.triggerButton)}"
      >
        ${this.getBugIcon(iconSize)}
      </button>
      <div
        id="inner-lens-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inner-lens-title"
        style="${this.styleToString(styles.overlay)}"
      >
        <div id="inner-lens-dialog" style="${this.styleToString(styles.dialog)}">
          <div style="${this.styleToString(styles.header)}">
            <h2 id="inner-lens-title" style="${this.styleToString(styles.headerTitle)}">
              ${this.escapeHtml(this.config.dialogTitle)}
            </h2>
            <button
              type="button"
              id="inner-lens-close"
              aria-label="Close"
              style="${this.styleToString(styles.closeButton)}"
            >
              ${this.getCloseIcon()}
            </button>
          </div>
          ${successContent}
          ${formContent}
        </div>
      </div>
    `;
    this.attachEventListeners(styles);
  }
  renderSuccess(styles) {
    const t = this.getTexts();
    return `
      <div style="${this.styleToString(styles.successMessage)}" role="status" aria-live="polite">
        <div style="${this.styleToString(styles.successIcon)}" aria-hidden="true">
          ${this.getCheckIcon()}
        </div>
        <h3 style="${this.styleToString({ ...styles.headerTitle, marginBottom: "8px" })}">
          ${this.escapeHtml(this.config.successMessage ?? t.successMessage)}
        </h3>
        <p style="color: #4b5563; font-size: 14px; margin-bottom: 16px;">
          ${this.escapeHtml(t.successDescription)}
        </p>
        ${this.issueUrl ? `<a href="${this.issueUrl}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-size: 14px;">
                ${this.escapeHtml(t.viewIssue)}
              </a>` : ""}
      </div>
    `;
  }
  renderForm(styles) {
    const t = this.getTexts();
    const logsHtml = this.logs.length > 0 ? this.renderLogs(styles) : "";
    const errorHtml = this.submissionState === "error" && this.errorMessage ? `<div style="${this.styleToString(styles.errorMessage)}">${this.escapeHtml(this.errorMessage)}</div>` : "";
    return `
      <div style="${this.styleToString(styles.content)}">
        <label style="${this.styleToString(styles.label)}" for="inner-lens-description">
          ${this.escapeHtml(this.config.dialogDescription ?? t.dialogDescription)}
        </label>
        <textarea
          id="inner-lens-description"
          placeholder="${this.escapeHtml(t.placeholder)}"
          style="${this.styleToString(styles.textarea)}"
        >${this.escapeHtml(this.description)}</textarea>

        ${logsHtml}

        <div style="${this.styleToString(styles.privacyNotice)}">
          ${this.escapeHtml(t.privacyNotice)}
        </div>

        ${errorHtml}
      </div>

      <div style="${this.styleToString(styles.footer)}">
        <button
          type="button"
          id="inner-lens-cancel"
          style="${this.styleToString(styles.cancelButton)}"
        >
          ${this.escapeHtml(this.config.cancelText ?? t.cancelText)}
        </button>
        <button
          type="button"
          id="inner-lens-submit"
          ${this.submissionState === "submitting" ? "disabled" : ""}
          style="${this.styleToString({
      ...styles.submitButton,
      ...this.submissionState === "submitting" ? styles.submitButtonDisabled : {}
    })}"
        >
          ${this.submissionState === "submitting" ? `<span style="display: flex; align-items: center; gap: 8px; justify-content: center;" role="status" aria-live="polite">
                  <span class="inner-lens-spinner" aria-hidden="true"></span>
                  ${this.escapeHtml(t.submitting)}
                </span>` : this.escapeHtml(this.config.submitText ?? t.submitText)}
        </button>
      </div>
    `;
  }
  renderLogs(styles) {
    const t = this.getTexts();
    const recentLogs = this.logs.slice(-10);
    const logsHtml = recentLogs.map((log) => {
      const levelStyle = log.level === "error" ? styles.logError : log.level === "warn" ? styles.logWarn : {};
      const message = this.escapeHtml(log.message.slice(0, 100));
      const truncated = log.message.length > 100 ? "..." : "";
      return `
          <div style="${this.styleToString({ ...styles.logEntry, ...levelStyle })}">
            [${log.level.toUpperCase()}] ${message}${truncated}
          </div>
        `;
    }).join("");
    return `
      <div style="${this.styleToString(styles.logPreview)}">
        <div style="${this.styleToString(styles.logPreviewHeader)}">
          <span style="${this.styleToString(styles.logPreviewTitle)}">${this.escapeHtml(t.capturedLogs)}</span>
          <span style="${this.styleToString(styles.logCount)}">
            ${this.logs.length} ${this.logs.length === 1 ? t.entry : t.entries}
          </span>
        </div>
        <div style="${this.styleToString(styles.logList)}">
          ${logsHtml}
        </div>
      </div>
    `;
  }
  attachEventListeners(styles) {
    const overlay = this.widgetRoot?.querySelector("#inner-lens-overlay");
    const dialog = this.widgetRoot?.querySelector("#inner-lens-dialog");
    const closeBtn = this.widgetRoot?.querySelector("#inner-lens-close");
    const cancelBtn = this.widgetRoot?.querySelector("#inner-lens-cancel");
    const submitBtn = this.widgetRoot?.querySelector("#inner-lens-submit");
    const textarea = this.widgetRoot?.querySelector(
      "#inner-lens-description"
    );
    const trigger = this.widgetRoot?.querySelector("#inner-lens-trigger");
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) this.close();
    });
    dialog?.addEventListener("click", (e) => e.stopPropagation());
    closeBtn?.addEventListener("click", () => this.close());
    closeBtn?.addEventListener("mouseenter", () => {
      if (closeBtn) closeBtn.style.backgroundColor = "#f3f4f6";
    });
    closeBtn?.addEventListener("mouseleave", () => {
      if (closeBtn) closeBtn.style.backgroundColor = "transparent";
    });
    cancelBtn?.addEventListener("click", () => this.close());
    submitBtn?.addEventListener("click", () => this.submit());
    trigger?.addEventListener("click", () => this.open());
    textarea?.addEventListener("input", (e) => {
      this.description = e.target.value;
    });
    textarea?.addEventListener("focus", () => {
      if (textarea) {
        textarea.style.borderColor = this.config.styles?.buttonColor ?? "#6366f1";
        textarea.style.boxShadow = `0 0 0 3px ${this.config.styles?.buttonColor ?? "#6366f1"}20`;
      }
    });
    textarea?.addEventListener("blur", () => {
      if (textarea) {
        textarea.style.borderColor = "#d1d5db";
        textarea.style.boxShadow = "none";
      }
    });
    setTimeout(() => textarea?.focus(), 100);
  }
  async submit() {
    if (!this.description.trim()) {
      this.errorMessage = "Please provide a description of the issue.";
      this.render();
      return;
    }
    this.submissionState = "submitting";
    this.errorMessage = null;
    this.render();
    try {
      const [parsedOwner, parsedRepo] = (this.config.repository || "").split("/");
      const owner = parsedOwner ?? "";
      const repo = parsedRepo ?? "";
      if (this.config.endpoint === HOSTED_API_ENDPOINT && (!owner || !repo)) {
        this.submissionState = "error";
        this.errorMessage = 'Repository not configured. Please set the repository option (e.g., "owner/repo").';
        this.render();
        return;
      }
      let sessionReplayBase64;
      if (this.sessionReplayData && this.sessionReplayData.events.length > 0) {
        try {
          const compressed = await compressReplayData(this.sessionReplayData);
          const buffer = await compressed.arrayBuffer();
          sessionReplayBase64 = btoa(
            String.fromCharCode(...new Uint8Array(buffer))
          );
        } catch (error) {
          console.warn("[inner-lens] Session replay compression failed, using uncompressed:", error);
          sessionReplayBase64 = btoa(
            JSON.stringify(this.sessionReplayData.events)
          );
        }
      }
      const payload = {
        description: this.config.maskSensitiveData ? maskSensitiveData(this.description) : this.description,
        logs: this.logs,
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        timestamp: Date.now(),
        // Centralized mode: send owner/repo directly
        owner: owner || void 0,
        repo: repo || void 0,
        // Extended context
        userActions: this.userActions.length > 0 ? this.userActions : void 0,
        navigations: this.navigations.length > 0 ? this.navigations : void 0,
        performance: this.performance ?? void 0,
        sessionReplay: sessionReplayBase64,
        pageContext: this.pageContext ?? void 0,
        // Legacy: keep metadata for backwards compatibility
        metadata: {
          repository: this.config.repository,
          labels: this.config.labels
        }
      };
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const texts = this.getTexts();
        if (data.errorCode === "DAILY_LIMIT_EXCEEDED") {
          throw new Error(texts.dailyLimitExceeded);
        }
        if (data.errorCode === "RATE_LIMIT_EXCEEDED") {
          throw new Error(texts.rateLimitExceeded);
        }
        throw new Error(
          data.message || `Failed to submit report (${response.status})`
        );
      }
      this.submissionState = "success";
      this.issueUrl = data.issueUrl ?? null;
      clearCapturedLogs();
      if (this.config.captureUserActions) {
        clearCapturedUserActions();
      }
      if (this.config.captureNavigation) {
        clearCapturedNavigations();
      }
      if (this.config.captureSessionReplay) {
        stopSessionReplay();
        startSessionReplay({ maskInputs: true }).catch(() => {
        });
      }
      this.config.onSuccess?.(data.issueUrl);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.submissionState = "error";
      this.errorMessage = err.message;
      this.config.onError?.(err);
    }
    this.render();
  }
  styleToString(style) {
    return Object.entries(style).filter(([, value]) => value !== void 0).map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `${cssKey}: ${value}`;
    }).join("; ");
  }
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  getBugIcon(size = 24) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1" />
        <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" />
        <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
      </svg>
    `;
  }
  getCloseIcon() {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    `;
  }
  getCheckIcon() {
    return `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    `;
  }
};

// src/vue.ts
function useInnerLens(config5 = {}) {
  const instance = vue.ref(null);
  const isOpen = vue.ref(false);
  vue.onMounted(() => {
    instance.value = new InnerLensCore({
      ...config5,
      onOpen: () => {
        isOpen.value = true;
        config5.onOpen?.();
      },
      onClose: () => {
        isOpen.value = false;
        config5.onClose?.();
      }
    });
    instance.value.mount();
  });
  vue.onUnmounted(() => {
    instance.value?.unmount();
    instance.value = null;
  });
  const open = () => {
    instance.value?.open();
  };
  const close = () => {
    instance.value?.close();
  };
  return {
    open,
    close,
    isOpen,
    instance
  };
}
var InnerLensWidget = vue.defineComponent({
  name: "InnerLensWidget",
  props: {
    endpoint: {
      type: String,
      default: HOSTED_API_ENDPOINT
    },
    repository: {
      type: String,
      default: void 0
    },
    labels: {
      type: Array,
      default: () => ["inner-lens"]
    },
    captureConsoleLogs: {
      type: Boolean,
      default: true
    },
    maxLogEntries: {
      type: Number,
      default: 50
    },
    maskSensitiveData: {
      type: Boolean,
      default: true
    },
    styles: {
      type: Object,
      default: void 0
    },
    language: {
      type: String,
      default: "en"
    },
    hidden: {
      type: Boolean,
      default: false
    }
  },
  emits: ["success", "error", "open", "close"],
  setup(props, { emit }) {
    const containerRef = vue.ref(null);
    const instance = vue.ref(null);
    const createInstance = () => {
      if (instance.value) {
        instance.value.unmount();
      }
      const config5 = {
        endpoint: props.endpoint,
        repository: props.repository,
        labels: props.labels,
        captureConsoleLogs: props.captureConsoleLogs,
        maxLogEntries: props.maxLogEntries,
        maskSensitiveData: props.maskSensitiveData,
        styles: props.styles,
        language: props.language,
        hidden: props.hidden,
        onSuccess: (url) => emit("success", url),
        onError: (error) => emit("error", error),
        onOpen: () => emit("open"),
        onClose: () => emit("close")
      };
      instance.value = new InnerLensCore(config5);
      if (containerRef.value) {
        instance.value.mount(containerRef.value);
      }
    };
    vue.onMounted(() => {
      createInstance();
    });
    vue.onUnmounted(() => {
      instance.value?.unmount();
      instance.value = null;
    });
    vue.watch(
      () => [
        props.endpoint,
        props.repository,
        props.language,
        props.hidden,
        props.styles?.buttonColor,
        props.styles?.buttonPosition
      ],
      () => {
        createInstance();
      }
    );
    return () => vue.h("div", {
      ref: containerRef,
      "data-inner-lens-container": "true"
    });
  }
});

exports.InnerLensWidget = InnerLensWidget;
exports.addCustomLog = addCustomLog;
exports.clearCapturedLogs = clearCapturedLogs;
exports.getCapturedLogs = getCapturedLogs;
exports.initLogCapture = initLogCapture;
exports.maskSensitiveData = maskSensitiveData;
exports.maskSensitiveObject = maskSensitiveObject;
exports.restoreConsole = restoreConsole;
exports.useInnerLens = useInnerLens;
exports.validateMasking = validateMasking;
//# sourceMappingURL=vue.cjs.map
//# sourceMappingURL=vue.cjs.map