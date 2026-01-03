import type { ReactNode } from 'react';

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
}

/**
 * i18n text definitions for all supported languages
 */
export const WIDGET_TEXTS: Record<WidgetLanguage, WidgetTexts> = {
  en: {
    buttonText: 'Report a bug',
    dialogTitle: 'Let us know what happened',
    dialogDescription: 'What went wrong?',
    placeholder: 'Tell us what you experienced. The more details, the better!',
    submitText: 'Send Report',
    cancelText: 'Close',
    successMessage: 'Got it!',
    successDescription: "Thanks for letting us know. We'll look into this.",
    viewIssue: 'View on GitHub',
    capturedLogs: 'Captured Logs',
    entry: 'entry',
    entries: 'entries',
    privacyNotice: 'Sensitive info like emails and API keys is automatically hidden.',
    submitting: 'Sending...',
  },
  ko: {
    buttonText: '버그 제보',
    dialogTitle: '문제 알리기',
    dialogDescription: '어떤 문제가 있었나요?',
    placeholder: '겪으신 문제를 알려주세요. 구체적일수록 좋아요.',
    submitText: '제보하기',
    cancelText: '닫기',
    successMessage: '제보 완료',
    successDescription: '알려주셔서 감사해요! 빠르게 확인할게요.',
    viewIssue: 'GitHub에서 보기',
    capturedLogs: '수집된 로그',
    entry: '건',
    entries: '건',
    privacyNotice: '이메일, API 키 등 민감한 정보는 자동으로 가려져요.',
    submitting: '제보 중...',
  },
  ja: {
    buttonText: 'バグを報告',
    dialogTitle: '問題を教えてください',
    dialogDescription: 'どんな問題がありましたか？',
    placeholder: '起きた問題を教えてください。詳しいほど助かります。',
    submitText: '送信する',
    cancelText: '閉じる',
    successMessage: '送信完了',
    successDescription: 'お知らせいただきありがとうございます！確認しますね。',
    viewIssue: 'GitHubで見る',
    capturedLogs: '取得したログ',
    entry: '件',
    entries: '件',
    privacyNotice: 'メールやAPIキーなどの機密情報は自動的に隠されます。',
    submitting: '送信中...',
  },
  zh: {
    buttonText: '反馈问题',
    dialogTitle: '告诉我们发生了什么',
    dialogDescription: '遇到了什么问题？',
    placeholder: '请描述您遇到的问题，越详细越好。',
    submitText: '提交反馈',
    cancelText: '关闭',
    successMessage: '已收到',
    successDescription: '感谢反馈！我们会尽快查看。',
    viewIssue: '在 GitHub 查看',
    capturedLogs: '已收集的日志',
    entry: '条',
    entries: '条',
    privacyNotice: '邮箱、API密钥等敏感信息会自动隐藏。',
    submitting: '提交中...',
  },
  es: {
    buttonText: 'Reportar problema',
    dialogTitle: 'Cuéntanos qué pasó',
    dialogDescription: '¿Qué problema encontraste?',
    placeholder: 'Cuéntanos qué ocurrió. Cuantos más detalles, mejor.',
    submitText: 'Enviar',
    cancelText: 'Cerrar',
    successMessage: '¡Recibido!',
    successDescription: 'Gracias por avisarnos. Lo revisaremos pronto.',
    viewIssue: 'Ver en GitHub',
    capturedLogs: 'Logs capturados',
    entry: 'entrada',
    entries: 'entradas',
    privacyNotice: 'Los datos sensibles como emails y claves API se ocultan automáticamente.',
    submitting: 'Enviando...',
  },
};

/**
 * Configuration for the InnerLens Widget
 */
export interface InnerLensConfig {
  /**
   * API endpoint to submit bug reports
   * @default '/api/inner-lens/report'
   */
  endpoint?: string;

  /**
   * GitHub repository in format "owner/repo"
   * Required for creating issues
   */
  repository?: string;

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

  /**
   * Custom CSS styles for the widget
   */
  styles?: {
    buttonColor?: string;
    buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
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
   * Disable the widget entirely
   * @default false
   */
  disabled?: boolean;

  /**
   * Only show widget in development environment (NODE_ENV !== 'production')
   * @default true
   */
  devOnly?: boolean;
}

/**
 * Captured log entry
 */
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  timestamp: number;
  stack?: string;
}

/**
 * Bug report payload sent to the server
 */
export interface BugReportPayload {
  description: string;
  logs: LogEntry[];
  url: string;
  userAgent: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  // Centralized mode fields (for inner-lens API)
  owner?: string;
  repo?: string;
}

/**
 * Server response from bug report submission
 */
export interface BugReportResponse {
  success: boolean;
  issueUrl?: string;
  issueNumber?: number;
  message?: string;
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
