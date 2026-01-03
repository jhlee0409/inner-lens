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
    dialogTitle: 'Report an Issue',
    dialogDescription: 'Describe the issue',
    placeholder: 'What went wrong? Please be as specific as possible...',
    submitText: 'Submit Report',
    cancelText: 'Cancel',
    successMessage: 'Report Submitted',
    successDescription: 'Thank you for your feedback! Our team will look into this.',
    viewIssue: 'View Issue on GitHub',
    capturedLogs: 'Captured Logs',
    entry: 'entry',
    entries: 'entries',
    privacyNotice: 'Privacy Notice: Sensitive data (emails, API keys, tokens) is automatically masked before submission.',
    submitting: 'Submitting...',
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
    dialogTitle: '問題を報告',
    dialogDescription: '問題を説明してください',
    placeholder: '何が問題でしたか？できるだけ具体的に説明してください...',
    submitText: '報告する',
    cancelText: 'キャンセル',
    successMessage: '報告完了',
    successDescription: 'フィードバックありがとうございます！チームが確認します。',
    viewIssue: 'GitHubで確認',
    capturedLogs: 'キャプチャされたログ',
    entry: '件',
    entries: '件',
    privacyNotice: 'プライバシー: メール、APIキー、トークンなどの機密データは送信前に自動的にマスクされます。',
    submitting: '送信中...',
  },
  zh: {
    buttonText: '报告问题',
    dialogTitle: '报告问题',
    dialogDescription: '描述问题',
    placeholder: '发生了什么问题？请尽可能具体地描述...',
    submitText: '提交报告',
    cancelText: '取消',
    successMessage: '报告已提交',
    successDescription: '感谢您的反馈！我们的团队会尽快处理。',
    viewIssue: '在 GitHub 上查看',
    capturedLogs: '捕获的日志',
    entry: '条',
    entries: '条',
    privacyNotice: '隐私提示：邮箱、API密钥、令牌等敏感数据在提交前会自动脱敏。',
    submitting: '提交中...',
  },
  es: {
    buttonText: 'Reportar error',
    dialogTitle: 'Reportar un problema',
    dialogDescription: 'Describe el problema',
    placeholder: '¿Qué salió mal? Por favor, sé lo más específico posible...',
    submitText: 'Enviar reporte',
    cancelText: 'Cancelar',
    successMessage: 'Reporte enviado',
    successDescription: '¡Gracias por tu feedback! Nuestro equipo lo revisará.',
    viewIssue: 'Ver en GitHub',
    capturedLogs: 'Logs capturados',
    entry: 'entrada',
    entries: 'entradas',
    privacyNotice: 'Aviso de privacidad: Los datos sensibles (emails, claves API, tokens) se enmascaran automáticamente antes del envío.',
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
