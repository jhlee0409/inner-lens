import type { ReactNode } from 'react';

declare const __INNER_LENS_VERSION__: string | undefined;
declare const __INNER_LENS_COMMIT__: string | undefined;
declare const __INNER_LENS_RELEASE__: string | undefined;
declare const __INNER_LENS_BUILD_TIME__: string | undefined;

/**
 * AI Provider options for bug analysis
 */
export type AIProvider = 'anthropic' | 'openai' | 'google';

/**
 * Supported languages for widget UI
 */
export type WidgetLanguage = 'en' | 'ko' | 'ja' | 'zh' | 'es';

/**
 * Widget UI text strings for i18n
 */
export interface WidgetTexts {
  buttonText: string;
  dialogTitle: string;
  dialogDescription: string;
  placeholder: string;
  submitText: string;
  cancelText: string;
  successMessage: string;
  successDescription: string;
  viewIssue: string;
  capturedLogs: string;
  entry: string;
  entries: string;
  privacyNotice: string;
  submitting: string;
  dailyLimitExceeded: string;
  rateLimitExceeded: string;
  networkError: string;
  descriptionRequired: string;
  submitError: string;
  timeoutError: string;
  repositoryNotConfigured: string;
}

/**
 * i18n text definitions for all supported languages
 */
export const WIDGET_TEXTS: Record<WidgetLanguage, WidgetTexts> = {
  en: {
    buttonText: 'Report an issue',
    dialogTitle: 'What went wrong?',
    dialogDescription: 'Your feedback helps us improve.',
    placeholder: 'Describe what you were doing and what went wrong...',
    submitText: 'Send Report',
    cancelText: 'Close',
    successMessage: 'Got it!',
    successDescription: "Thanks for letting us know. We'll look into this.",
    viewIssue: 'View on GitHub',
    capturedLogs: 'Captured Logs',
    entry: 'entry',
    entries: 'entries',
    privacyNotice: 'We collect clicks, navigation, and performance data. Sensitive info is automatically hidden.',
    submitting: 'Sending...',
    dailyLimitExceeded: 'Daily limit reached. Please try again tomorrow.',
    rateLimitExceeded: 'Too many requests. Please wait a moment.',
    networkError: 'Network error. Please check your connection and try again.',
    descriptionRequired: 'Please provide a description of the issue.',
    submitError: 'Failed to submit report. Please try again.',
    timeoutError: 'Request timed out. Please try again.',
    repositoryNotConfigured: 'Repository not configured. Please contact the site administrator.',
  },
  ko: {
    buttonText: '문제 신고',
    dialogTitle: '어떤 문제가 있었나요?',
    dialogDescription: '제보해주시면 개선에 큰 도움이 돼요.',
    placeholder: '어떤 상황에서 무엇이 잘못됐는지 알려주세요...',
    submitText: '제보하기',
    cancelText: '닫기',
    successMessage: '제보 완료',
    successDescription: '알려주셔서 감사해요! 빠르게 확인할게요.',
    viewIssue: 'GitHub에서 보기',
    capturedLogs: '수집된 로그',
    entry: '건',
    entries: '건',
    privacyNotice: '클릭, 페이지 이동, 성능 데이터를 수집해요. 민감한 정보는 자동으로 가려져요.',
    submitting: '제보 중...',
    dailyLimitExceeded: '일일 한도에 도달했어요. 내일 다시 시도해주세요.',
    rateLimitExceeded: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
    networkError: '네트워크 오류가 발생했어요. 연결 상태를 확인하고 다시 시도해주세요.',
    descriptionRequired: '문제 설명을 입력해주세요.',
    submitError: '제보에 실패했어요. 다시 시도해주세요.',
    timeoutError: '요청 시간이 초과됐어요. 다시 시도해주세요.',
    repositoryNotConfigured: '저장소가 설정되지 않았어요. 사이트 관리자에게 문의해주세요.',
  },
  ja: {
    buttonText: '問題を報告',
    dialogTitle: '何がうまくいきませんでしたか？',
    dialogDescription: 'フィードバックは改善に役立ちます。',
    placeholder: '何をしていて、何が起きたか教えてください...',
    submitText: '送信する',
    cancelText: '閉じる',
    successMessage: '送信完了',
    successDescription: 'お知らせいただきありがとうございます！確認しますね。',
    viewIssue: 'GitHubで見る',
    capturedLogs: '取得したログ',
    entry: '件',
    entries: '件',
    privacyNotice: 'クリック、ページ遷移、パフォーマンスデータを収集します。機密情報は自動的に隠されます。',
    submitting: '送信中...',
    dailyLimitExceeded: '本日の上限に達しました。明日もう一度お試しください。',
    rateLimitExceeded: 'リクエストが多すぎます。しばらくしてからお試しください。',
    networkError: 'ネットワークエラーが発生しました。接続を確認してもう一度お試しください。',
    descriptionRequired: '問題の説明を入力してください。',
    submitError: '送信に失敗しました。もう一度お試しください。',
    timeoutError: 'リクエストがタイムアウトしました。もう一度お試しください。',
    repositoryNotConfigured: 'リポジトリが設定されていません。サイト管理者にお問い合わせください。',
  },
  zh: {
    buttonText: '反馈问题',
    dialogTitle: '遇到了什么问题？',
    dialogDescription: '您的反馈有助于我们改进。',
    placeholder: '请描述您当时在做什么，以及出了什么问题...',
    submitText: '提交反馈',
    cancelText: '关闭',
    successMessage: '已收到',
    successDescription: '感谢反馈！我们会尽快查看。',
    viewIssue: '在 GitHub 查看',
    capturedLogs: '已收集的日志',
    entry: '条',
    entries: '条',
    privacyNotice: '我们会收集点击、页面跳转和性能数据。敏感信息会自动隐藏。',
    submitting: '提交中...',
    dailyLimitExceeded: '今日已达上限，请明天再试。',
    rateLimitExceeded: '请求过于频繁，请稍后再试。',
    networkError: '网络错误，请检查连接后重试。',
    descriptionRequired: '请输入问题描述。',
    submitError: '提交失败，请重试。',
    timeoutError: '请求超时，请重试。',
    repositoryNotConfigured: '仓库未配置，请联系网站管理员。',
  },
  es: {
    buttonText: 'Reportar problema',
    dialogTitle: '¿Que salio mal?',
    dialogDescription: 'Tu feedback nos ayuda a mejorar.',
    placeholder: 'Describe que estabas haciendo y que salio mal...',
    submitText: 'Enviar',
    cancelText: 'Cerrar',
    successMessage: '¡Recibido!',
    successDescription: 'Gracias por avisarnos. Lo revisaremos pronto.',
    viewIssue: 'Ver en GitHub',
    capturedLogs: 'Logs capturados',
    entry: 'entrada',
    entries: 'entradas',
    privacyNotice: 'Recopilamos clics, navegación y datos de rendimiento. Los datos sensibles se ocultan automáticamente.',
    submitting: 'Enviando...',
    dailyLimitExceeded: 'Límite diario alcanzado. Por favor, inténtalo mañana.',
    rateLimitExceeded: 'Demasiadas solicitudes. Por favor, espera un momento.',
    networkError: 'Error de red. Por favor, verifica tu conexión e inténtalo de nuevo.',
    descriptionRequired: 'Por favor, proporciona una descripción del problema.',
    submitError: 'Error al enviar el reporte. Por favor, inténtalo de nuevo.',
    timeoutError: 'La solicitud ha expirado. Por favor, inténtalo de nuevo.',
    repositoryNotConfigured: 'Repositorio no configurado. Por favor, contacta al administrador del sitio.',
  },
};

/**
 * Reporter information for bug reports
 */
export interface Reporter {
  name: string;
  email?: string;
  id?: string;
}

/**
 * Configuration for the InnerLens Widget
 */
export interface InnerLensConfig {
  /**
   * API endpoint to submit bug reports
   * @default HOSTED_API_ENDPOINT ('https://inner-lens-one.vercel.app/api/report')
   */
  endpoint?: string;

  /**
   * GitHub repository in format "owner/repo"
   * Required for creating issues
   */
  repository?: string;

  /**
   * Git branch name for the deployed environment
   * Used by analysis engine to checkout the correct code version
   * @example 'main', 'dev', 'staging'
   */
  branch?: string;

  /**
   * Custom labels to add to created issues
   * @default ['inner-lens']
   */
  labels?: string[];

  /**
   * Enable/disable console log capture
   * @default true
   */
  captureConsoleLogs?: boolean;

  /**
   * Maximum number of log entries to capture
   * @default 50
   */
  maxLogEntries?: number;

  /**
   * Enable/disable sensitive data masking
   * @default true
   */
  maskSensitiveData?: boolean;

  // ============================================
  // Extended Capture Options
  // ============================================

  /**
   * Enable/disable user action tracking (clicks, inputs, etc.)
   * @default true
   */
  captureUserActions?: boolean;

  /**
   * Enable/disable navigation tracking
   * @default true
   */
  captureNavigation?: boolean;

  /**
   * Enable/disable performance metrics (Core Web Vitals)
   * @default true
   */
  capturePerformance?: boolean;

  /**
   * Enable/disable session replay recording
   * @default false (opt-in due to size)
   */
  captureSessionReplay?: boolean;

  /**
   * Custom CSS styles for the widget
   */
  styles?: {
    buttonColor?: string;
    buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    buttonSize?: 'sm' | 'md' | 'lg';
  };

  /**
   * Widget UI language
   * @default 'en'
   */
  language?: WidgetLanguage;

  // ============================================
  // Convenience Options (top-level shortcuts)
  // ============================================

  /**
   * Button position (convenience option, maps to styles.buttonPosition)
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  /**
   * Button color (convenience option, maps to styles.buttonColor)
   * @default '#6366f1'
   */
  buttonColor?: string;

  /**
   * Button size (convenience option, maps to styles.buttonSize)
   * @default 'lg'
   */
  buttonSize?: 'sm' | 'md' | 'lg';

  // ============================================
  // UI Text Customization
  // ============================================

  /**
   * Trigger button aria-label and title
   * @default 'Report a bug'
   */
  buttonText?: string;

  /**
   * Dialog title text
   * @default 'Report an Issue'
   */
  dialogTitle?: string;

  /**
   * Textarea label text
   * @default 'Describe the issue'
   */
  dialogDescription?: string;

  /**
   * Submit button text
   * @default 'Submit Report'
   */
  submitText?: string;

  /**
   * Cancel button text
   * @default 'Cancel'
   */
  cancelText?: string;

  /**
   * Success message title
   * @default 'Report Submitted'
   */
  successMessage?: string;

  // ============================================
  // Callbacks
  // ============================================

  /**
   * Callback when report is successfully submitted
   */
  onSuccess?: (issueUrl?: string) => void;

  /**
   * Callback when report submission fails
   */
  onError?: (error: Error) => void;

  /**
   * Callback when dialog opens
   */
  onOpen?: () => void;

  /**
   * Callback when dialog closes
   */
  onClose?: () => void;

  /**
   * Custom trigger element (replaces default button)
   */
  trigger?: ReactNode;

  /**
   * Hide the widget completely (not rendered)
   * @default false
   */
  hidden?: boolean;

  /**
   * Disable the widget (button visible but inactive)
   * @default false
   */
  disabled?: boolean;

  reporter?: Reporter;
}

/**
 * Log entry source type for categorization
 */
export type LogEntryType =
  | 'console'
  | 'runtime'
  | 'resource'
  | 'network'
  | 'promise_rejection';

/**
 * Captured log entry
 */
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  timestamp: number;
  stack?: string;
  type?: LogEntryType;
}

// ============================================
// User Action Types
// ============================================

/**
 * Types of user actions that can be captured
 */
export type UserActionType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'focus'
  | 'blur'
  | 'scroll'
  | 'keydown'
  | 'submit'
  | 'copy'
  | 'paste'
  | 'select';

/**
 * Captured user action entry
 */
export interface UserAction {
  type: UserActionType;
  target: string;
  timestamp: number;
  value?: string;
  position?: { x: number; y: number };
  key?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Navigation Types
// ============================================

/**
 * Types of navigation events
 */
export type NavigationType =
  | 'pageload'
  | 'pushstate'
  | 'replacestate'
  | 'popstate'
  | 'hashchange'
  | 'beforeunload';

/**
 * Navigation entry
 */
export interface NavigationEntry {
  type: NavigationType;
  timestamp: number;
  from: string;
  to: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// Performance Types
// ============================================

/**
 * Core Web Vitals metrics
 */
export interface CoreWebVitals {
  /** Largest Contentful Paint (ms) */
  LCP?: number;
  /** First Input Delay (ms) */
  FID?: number;
  /** Cumulative Layout Shift */
  CLS?: number;
  /** Interaction to Next Paint (ms) */
  INP?: number;
  /** Time to First Byte (ms) */
  TTFB?: number;
  /** First Contentful Paint (ms) */
  FCP?: number;
}

/**
 * Performance data summary
 */
export interface PerformanceSummary {
  coreWebVitals: CoreWebVitals;
  timing: {
    domContentLoaded: number;
    loadComplete: number;
    timeToInteractive?: number;
  };
  resourceCount: number;
  memoryUsage?: number;
  score?: number;
}

// ============================================
// Captured Context (Combined)
// ============================================

/**
 * Page context for better bug location identification
 */
export interface PageContext {
  /** Current URL/route when bug occurred */
  route: string;
  /** URL path without query params */
  pathname: string;
  /** URL hash */
  hash: string;
  /** React component stack (from Error Boundary) */
  componentStack?: string;
  /** Document title */
  title: string;
  /** Time spent on current page (ms) */
  timeOnPage: number;
  /** Referrer URL */
  referrer?: string;
}

/**
 * Complete captured context for bug reports
 */
export interface CapturedContext {
  /** Console logs and network requests */
  logs: LogEntry[];
  /** User interaction trail */
  userActions: UserAction[];
  /** Page navigation history */
  navigations: NavigationEntry[];
  /** Performance metrics */
  performance?: PerformanceSummary;
  /** Session replay data (base64 encoded) */
  sessionReplay?: string;
  /** Current page context */
  pageContext?: PageContext;
}

export interface VersionInfo {
  /** Deployed widget bundle version */
  widget?: string;
  /** SDK/core library version */
  sdk?: string;
}

export interface DeploymentInfo {
  /** Deployment environment (prod/staging/dev/etc.) */
  environment?: string;
  /** Commit SHA for the deployed build */
  commit?: string;
  /** Release tag or version label */
  release?: string;
  /** Build time (ISO string) */
  buildTime?: string;
}

export interface RuntimeViewport {
  width: number;
  height: number;
  devicePixelRatio?: number;
}

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type ColorSchemePreference = 'light' | 'dark' | 'no-preference';

export interface RuntimeEnvironment {
  /** Browser locale (e.g., en-US) */
  locale?: string;
  /** Browser language (navigator.language) */
  language?: string;
  /** Timezone offset in minutes from UTC */
  timezoneOffset?: number;
  /** Viewport dimensions */
  viewport?: RuntimeViewport;
  /** Device class inferred from viewport */
  device?: DeviceClass;
  /** User preferred color scheme */
  colorScheme?: ColorSchemePreference;
  /** Online/offline status */
  online?: boolean;
  /** Platform string (e.g., MacIntel) */
  platform?: string;
}

/**
 * Bug report payload sent to the server
 */
export interface BugReportPayload {
  description: string;
  logs?: LogEntry[];
  url?: string;
  userAgent?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  // Version & deployment
  version?: VersionInfo;
  deployment?: DeploymentInfo;
  runtime?: RuntimeEnvironment;
  // Centralized mode fields (for inner-lens API)
  owner?: string;
  repo?: string;
  // Git branch for analysis engine to checkout correct code
  branch?: string;
  // Extended context
  userActions?: UserAction[];
  navigations?: NavigationEntry[];
  performance?: PerformanceSummary;
  sessionReplay?: string;
  pageContext?: PageContext;
  reporter?: Reporter;
}

/**
 * Server response from bug report submission
 */
export interface BugReportResponse {
  success: boolean;
  issueUrl?: string;
  issueNumber?: number;
  message?: string;
  remaining?: number;
  dailyLimit?: number;
  errorCode?: 'DAILY_LIMIT_EXCEEDED' | 'RATE_LIMIT_EXCEEDED';
  resetAt?: number;
}

/**
 * GitHub Issue creation payload
 */
export interface GitHubIssuePayload {
  title: string;
  body: string;
  labels: string[];
  repository: string;
}

// ============================================
// Shared Constants
// ============================================

/**
 * Hosted API endpoint for centralized mode
 * Users don't need to specify this - it's the default when repository is provided
 */
export const HOSTED_API_ENDPOINT =
  'https://inner-lens-one.vercel.app/api/report';

/**
 * Maximum number of log entries to keep
 * Used consistently across Core, Hosted API, and Self-hosted server
 */
export const MAX_LOG_ENTRIES = 50;

/**
 * Maximum session replay size in bytes (5MB)
 * Session replay can be large, this prevents excessive payload sizes
 */
export const MAX_SESSION_REPLAY_SIZE = 5 * 1024 * 1024;

/**
 * Maximum total payload size in bytes (10MB)
 */
export const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

// ============================================
// Hosted API Types (Centralized Mode)
// ============================================

/**
 * Bug report payload for Hosted API (centralized mode)
 * Extends base payload with required owner/repo fields
 */
export interface HostedBugReportPayload {
  // Required: Repository info
  owner: string;
  repo: string;

  // Required: Bug details
  description: string;

  // Optional: Additional context
  logs?: LogEntry[];
  url?: string;
  userAgent?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;

  version?: VersionInfo;
  deployment?: DeploymentInfo;
  runtime?: RuntimeEnvironment;

  // Git branch for analysis engine
  branch?: string;

  // Extended context (user actions, navigation, performance)
  userActions?: UserAction[];
  navigations?: NavigationEntry[];
  performance?: PerformanceSummary;
  sessionReplay?: string; // Base64 encoded rrweb data
  pageContext?: PageContext;
  reporter?: Reporter;
}


