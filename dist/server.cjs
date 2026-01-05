'use strict';

var rest = require('@octokit/rest');
var zod = require('zod');

// src/server.ts

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

// src/server.ts
var UserActionSchema = zod.z.object({
  type: zod.z.enum([
    "click",
    "dblclick",
    "input",
    "change",
    "focus",
    "blur",
    "scroll",
    "keydown",
    "submit",
    "copy",
    "paste",
    "select"
  ]),
  target: zod.z.string(),
  timestamp: zod.z.number(),
  value: zod.z.string().optional(),
  position: zod.z.object({
    x: zod.z.number(),
    y: zod.z.number()
  }).optional(),
  key: zod.z.string().optional(),
  metadata: zod.z.record(zod.z.unknown()).optional()
});
var NavigationEntrySchema = zod.z.object({
  type: zod.z.enum([
    "pageload",
    "pushstate",
    "replacestate",
    "popstate",
    "hashchange",
    "beforeunload"
  ]),
  timestamp: zod.z.number(),
  from: zod.z.string(),
  to: zod.z.string(),
  duration: zod.z.number().optional(),
  metadata: zod.z.record(zod.z.unknown()).optional()
});
var PerformanceSummarySchema = zod.z.object({
  coreWebVitals: zod.z.object({
    LCP: zod.z.number().optional(),
    FID: zod.z.number().optional(),
    CLS: zod.z.number().optional(),
    INP: zod.z.number().optional(),
    TTFB: zod.z.number().optional(),
    FCP: zod.z.number().optional()
  }),
  timing: zod.z.object({
    domContentLoaded: zod.z.number(),
    loadComplete: zod.z.number(),
    timeToInteractive: zod.z.number().optional()
  }),
  resourceCount: zod.z.number(),
  memoryUsage: zod.z.number().optional(),
  score: zod.z.number().optional()
});
var PageContextSchema = zod.z.object({
  route: zod.z.string(),
  pathname: zod.z.string(),
  hash: zod.z.string(),
  componentStack: zod.z.string().optional(),
  title: zod.z.string(),
  timeOnPage: zod.z.number(),
  referrer: zod.z.string().optional()
});
var BugReportSchema = zod.z.object({
  description: zod.z.string().min(1, "Description is required").max(1e4),
  logs: zod.z.array(
    zod.z.object({
      level: zod.z.enum(["error", "warn", "info", "log"]),
      message: zod.z.string(),
      timestamp: zod.z.number(),
      stack: zod.z.string().optional()
    })
  ),
  url: zod.z.string().url().or(zod.z.string().length(0)),
  userAgent: zod.z.string(),
  timestamp: zod.z.number(),
  metadata: zod.z.object({
    repository: zod.z.string().optional(),
    labels: zod.z.array(zod.z.string()).optional()
  }).optional(),
  // Extended context fields
  userActions: zod.z.array(UserActionSchema).optional(),
  navigations: zod.z.array(NavigationEntrySchema).optional(),
  performance: PerformanceSummarySchema.optional(),
  sessionReplay: zod.z.string().optional(),
  pageContext: PageContextSchema.optional()
});
var ERROR_MESSAGES = {
  INVALID_REPO_FORMAT: (repo) => `Invalid repository format: "${repo}". Expected "owner/repo" format (e.g., "jhlee0409/inner-lens"). See: https://github.com/jhlee0409/inner-lens#troubleshooting`,
  MISSING_TOKEN: "GITHUB_TOKEN is not configured. Create a token at https://github.com/settings/tokens/new?scopes=repo and add it to your environment variables. See: https://github.com/jhlee0409/inner-lens#-backend-setup",
  TOKEN_UNAUTHORIZED: "GITHUB_TOKEN is invalid or expired. Generate a new token at https://github.com/settings/tokens/new?scopes=repo",
  REPO_NOT_FOUND: (repo) => `Repository "${repo}" not found. Check that the repository exists and your token has access. For private repos, ensure the token has "repo" scope.`,
  RATE_LIMITED: "GitHub API rate limit exceeded. Wait a few minutes and try again, or use an authenticated token for higher limits.",
  NETWORK_ERROR: (message) => `Network error connecting to GitHub: ${message}. Check your internet connection and try again.`,
  INTERNAL_ERROR: (message) => `Internal server error: ${message}. If this persists, please report at https://github.com/jhlee0409/inner-lens/issues`
};
async function createGitHubIssue(payload, config) {
  if (!config.githubToken) {
    return {
      success: false,
      message: ERROR_MESSAGES.MISSING_TOKEN
    };
  }
  const [owner, repo] = config.repository.split("/");
  if (!owner || !repo || config.repository.split("/").length !== 2) {
    return {
      success: false,
      message: ERROR_MESSAGES.INVALID_REPO_FORMAT(config.repository)
    };
  }
  const octokit = new rest.Octokit({
    auth: config.githubToken
  });
  const formattedLogs = payload.logs.slice(-50).map((log) => {
    const timestamp = new Date(log.timestamp).toISOString();
    return `[${timestamp}] [${log.level.toUpperCase()}] ${maskSensitiveData(log.message)}${log.stack ? `
${maskSensitiveData(log.stack)}` : ""}`;
  }).join("\n");
  const formattedUserActions = payload.userActions?.length ? payload.userActions.slice(-20).map((action) => {
    const time = new Date(action.timestamp).toISOString();
    const value = action.value ? ` \u2192 "${maskSensitiveData(action.value.slice(0, 50))}"` : "";
    return `[${time}] ${action.type.toUpperCase()} on ${action.target}${value}`;
  }).join("\n") : null;
  const formattedNavigations = payload.navigations?.length ? payload.navigations.slice(-10).map((nav) => {
    const time = new Date(nav.timestamp).toISOString();
    const duration = nav.duration ? ` (${nav.duration}ms)` : "";
    return `[${time}] ${nav.type}: ${maskSensitiveData(nav.from)} \u2192 ${maskSensitiveData(nav.to)}${duration}`;
  }).join("\n") : null;
  const formattedPerformance = payload.performance ? [
    `LCP: ${payload.performance.coreWebVitals.LCP?.toFixed(0) ?? "N/A"}ms`,
    `FID: ${payload.performance.coreWebVitals.FID?.toFixed(0) ?? "N/A"}ms`,
    `CLS: ${payload.performance.coreWebVitals.CLS?.toFixed(3) ?? "N/A"}`,
    `TTFB: ${payload.performance.coreWebVitals.TTFB?.toFixed(0) ?? "N/A"}ms`,
    `DOM Loaded: ${payload.performance.timing.domContentLoaded}ms`,
    `Load Complete: ${payload.performance.timing.loadComplete}ms`,
    `Resources: ${payload.performance.resourceCount}`
  ].join(" | ") : null;
  const formattedPageContext = payload.pageContext ? [
    `**Route:** ${maskSensitiveData(payload.pageContext.pathname)}`,
    `**Title:** ${payload.pageContext.title}`,
    `**Time on Page:** ${(payload.pageContext.timeOnPage / 1e3).toFixed(1)}s`,
    payload.pageContext.componentStack ? `**Component:** ${payload.pageContext.componentStack}` : null
  ].filter(Boolean).join("\n") : null;
  let issueBody = `## Bug Report

### Description
${maskSensitiveData(payload.description)}

### Environment
- **URL:** ${maskSensitiveData(payload.url || "N/A")}
- **User Agent:** ${payload.userAgent || "N/A"}
- **Reported At:** ${new Date(payload.timestamp).toISOString()}
`;
  if (formattedPageContext) {
    issueBody += `
### Page Context
${formattedPageContext}
`;
  }
  if (formattedPerformance) {
    issueBody += `
### Performance
${formattedPerformance}
`;
  }
  issueBody += `
### Console Logs
\`\`\`
${formattedLogs || "No logs captured"}
\`\`\`
`;
  if (formattedUserActions) {
    issueBody += `
### User Actions (Last 20)
\`\`\`
${formattedUserActions}
\`\`\`
`;
  }
  if (formattedNavigations) {
    issueBody += `
### Navigation History
\`\`\`
${formattedNavigations}
\`\`\`
`;
  }
  if (payload.sessionReplay) {
    issueBody += `
### Session Replay
\u{1F4F9} Session replay data attached (${(payload.sessionReplay.length / 1024).toFixed(1)}KB compressed)
`;
  }
  issueBody += `
---
*This issue was automatically created by [inner-lens](https://github.com/jhlee0409/inner-lens).*
*Awaiting AI analysis...*
`;
  const title = `${payload.description.slice(0, 80)}${payload.description.length > 80 ? "..." : ""}`;
  try {
    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body: issueBody,
      labels: [
        ...config.defaultLabels ?? ["inner-lens"],
        ...payload.metadata?.labels ?? []
      ]
    });
    return {
      success: true,
      issueUrl: response.data.html_url,
      issueNumber: response.data.number
    };
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes("bad credentials") || errorMessage.includes("401")) {
        return {
          success: false,
          message: ERROR_MESSAGES.TOKEN_UNAUTHORIZED
        };
      }
      if (errorMessage.includes("not found") || errorMessage.includes("404")) {
        return {
          success: false,
          message: ERROR_MESSAGES.REPO_NOT_FOUND(config.repository)
        };
      }
      if (errorMessage.includes("rate limit") || errorMessage.includes("403")) {
        return {
          success: false,
          message: ERROR_MESSAGES.RATE_LIMITED
        };
      }
      if (errorMessage.includes("enotfound") || errorMessage.includes("econnrefused") || errorMessage.includes("network")) {
        return {
          success: false,
          message: ERROR_MESSAGES.NETWORK_ERROR(error.message)
        };
      }
      return {
        success: false,
        message: ERROR_MESSAGES.INTERNAL_ERROR(error.message)
      };
    }
    return {
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR("Unknown error occurred")
    };
  }
}
function validateBugReport(payload) {
  const result = BugReportSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
  return { success: false, error: errorMessages };
}
async function handleBugReport(body, config) {
  const validation = validateBugReport(body);
  if (!validation.success) {
    return {
      status: 400,
      body: { success: false, message: validation.error }
    };
  }
  const result = await createGitHubIssue(validation.data, config);
  return {
    status: result.success ? 201 : 500,
    body: result
  };
}
function createFetchHandler(config) {
  return async (request) => {
    try {
      const body = await request.json();
      const result = await handleBugReport(body, config);
      return Response.json(result.body, { status: result.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      return Response.json({ success: false, message }, { status: 500 });
    }
  };
}
var createReportHandler = createFetchHandler;
function createExpressHandler(config) {
  return async (req, res) => {
    try {
      const result = await handleBugReport(req.body, config);
      res.status(result.status).json(result.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ success: false, message });
    }
  };
}
function createFastifyHandler(config) {
  return async (request, reply) => {
    try {
      const result = await handleBugReport(request.body, config);
      reply.status(result.status).send(result.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      reply.status(500).send({ success: false, message });
    }
  };
}
function createKoaHandler(config) {
  return async (ctx) => {
    try {
      const result = await handleBugReport(ctx.request.body, config);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      ctx.status = 500;
      ctx.body = { success: false, message };
    }
  };
}
function createNodeHandler(config) {
  return async (req, res) => {
    const chunks = [];
    return new Promise((resolve) => {
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const bodyStr = Buffer.concat(chunks).toString();
          const body = JSON.parse(bodyStr);
          const result = await handleBugReport(body, config);
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result.body));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Internal server error";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, message }));
        }
        resolve();
      });
    });
  };
}

exports.BugReportSchema = BugReportSchema;
exports.createExpressHandler = createExpressHandler;
exports.createFastifyHandler = createFastifyHandler;
exports.createFetchHandler = createFetchHandler;
exports.createGitHubIssue = createGitHubIssue;
exports.createKoaHandler = createKoaHandler;
exports.createNodeHandler = createNodeHandler;
exports.createReportHandler = createReportHandler;
exports.handleBugReport = handleBugReport;
exports.maskSensitiveData = maskSensitiveData;
exports.maskSensitiveObject = maskSensitiveObject;
exports.validateBugReport = validateBugReport;
//# sourceMappingURL=server.cjs.map
//# sourceMappingURL=server.cjs.map