import * as vue from 'vue';
import { PropType } from 'vue';
import { ReactNode } from 'react';

/**
 * AI Provider options for bug analysis
 */
type AIProvider = 'anthropic' | 'openai' | 'google';
/**
 * Supported languages for widget UI
 */
type WidgetLanguage = 'en' | 'ko' | 'ja' | 'zh' | 'es';
/**
 * Configuration for the InnerLens Widget
 */
interface InnerLensConfig {
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
    hidden?: boolean;
}
/**
 * Captured log entry
 */
interface LogEntry {
    level: 'error' | 'warn' | 'info' | 'log';
    message: string;
    timestamp: number;
    stack?: string;
}
/**
 * Types of user actions that can be captured
 */
type UserActionType = 'click' | 'dblclick' | 'input' | 'change' | 'focus' | 'blur' | 'scroll' | 'keydown' | 'submit' | 'copy' | 'paste' | 'select';
/**
 * Captured user action entry
 */
interface UserAction {
    type: UserActionType;
    target: string;
    timestamp: number;
    value?: string;
    position?: {
        x: number;
        y: number;
    };
    key?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Types of navigation events
 */
type NavigationType = 'pageload' | 'pushstate' | 'replacestate' | 'popstate' | 'hashchange' | 'beforeunload';
/**
 * Navigation entry
 */
interface NavigationEntry {
    type: NavigationType;
    timestamp: number;
    from: string;
    to: string;
    duration?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Core Web Vitals metrics
 */
interface CoreWebVitals {
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
interface PerformanceSummary {
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
/**
 * Page context for better bug location identification
 */
interface PageContext {
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
 * Bug report payload sent to the server
 */
interface BugReportPayload {
    description: string;
    logs: LogEntry[];
    url: string;
    userAgent: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
    owner?: string;
    repo?: string;
    userActions?: UserAction[];
    navigations?: NavigationEntry[];
    performance?: PerformanceSummary;
    sessionReplay?: string;
    pageContext?: PageContext;
}
/**
 * Server response from bug report submission
 */
interface BugReportResponse {
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
interface GitHubIssuePayload {
    title: string;
    body: string;
    labels: string[];
    repository: string;
}

type ButtonSize = 'sm' | 'md' | 'lg';
interface StyleConfig {
    buttonColor?: string;
    buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    buttonSize?: ButtonSize;
}

/**
 * InnerLens Core Class
 * Framework-agnostic implementation of the bug reporting widget
 */

interface InnerLensCoreConfig {
    /**
     * API endpoint to submit bug reports
     * @default HOSTED_API_ENDPOINT (for hosted mode)
     */
    endpoint?: string;
    /**
     * GitHub repository in format "owner/repo"
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
    styles?: StyleConfig;
    /**
     * Widget UI language
     * @default 'en'
     */
    language?: WidgetLanguage;
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
    hidden?: boolean;
    /**
     * Custom container element (defaults to document.body)
     */
    container?: HTMLElement;
}
/**
 * InnerLens Core - Framework-agnostic bug reporting widget
 *
 * @example
 * ```ts
 * import { InnerLensCore } from 'inner-lens';
 *
 * const innerLens = new InnerLensCore({
 *   endpoint: '/api/bug-report',
 *   repository: 'owner/repo',
 * });
 *
 * innerLens.mount();
 * ```
 */
declare class InnerLensCore {
    private config;
    private container;
    private widgetRoot;
    private isOpen;
    private submissionState;
    private description;
    private logs;
    private userActions;
    private navigations;
    private performance;
    private sessionReplayData;
    private pageContext;
    private pageLoadTime;
    private errorMessage;
    private issueUrl;
    private styleElement;
    private mounted;
    constructor(config?: InnerLensCoreConfig);
    /**
     * Get i18n texts for the current language
     */
    private getTexts;
    private isHidden;
    /**
     * Mount the widget to the DOM
     */
    mount(container?: HTMLElement): void;
    /**
     * Unmount the widget from the DOM
     */
    unmount(): void;
    /**
     * Programmatically open the dialog
     */
    open(): void;
    private capturePageContext;
    private getReactComponentStack;
    /**
     * Programmatically close the dialog
     */
    close(): void;
    /**
     * Check if widget is currently open
     */
    get isDialogOpen(): boolean;
    private handleKeyDown;
    private injectStyles;
    private renderTrigger;
    private render;
    private renderSuccess;
    private renderForm;
    private renderLogs;
    private attachEventListeners;
    private submit;
    private styleToString;
    private escapeHtml;
    private getBugIcon;
    private getCloseIcon;
    private getCheckIcon;
}

/**
 * Console Log Capture Utility
 * Hooks into console methods to capture error and warning logs
 */

type LogLevel = 'error' | 'warn' | 'info' | 'log';
interface LogCaptureOptions {
    maxEntries: number;
    maskSensitiveData: boolean;
}
/**
 * Initializes log capture by hooking into console methods
 */
declare function initLogCapture(options?: Partial<LogCaptureOptions>): void;
/**
 * Gets all captured logs
 */
declare function getCapturedLogs(): LogEntry[];
/**
 * Clears all captured logs
 */
declare function clearCapturedLogs(): void;
/**
 * Restores original console methods, fetch, and removes listeners
 */
declare function restoreConsole(): void;
/**
 * Manually adds a log entry (for custom integrations)
 */
declare function addCustomLog(level: LogLevel, message: string, stack?: string): void;

/**
 * Sensitive Data Masking Engine
 * Security-first approach to prevent PII leakage in bug reports
 */
/**
 * Masks sensitive data in the provided text
 * @param text - The text to mask
 * @returns The masked text with sensitive data redacted
 */
declare function maskSensitiveData(text: string): string;
/**
 * Masks sensitive data in an object recursively
 * @param obj - The object to mask
 * @returns A new object with sensitive data masked
 */
declare function maskSensitiveObject<T>(obj: T): T;
/**
 * Validates that no obvious sensitive data remains
 * Returns true if text appears safe, false if potential leaks detected
 */
declare function validateMasking(text: string): boolean;

/**
 * Vue 3 composable for programmatic control
 *
 * @example
 * ```vue
 * <script setup>
 * import { useInnerLens } from 'inner-lens/vue';
 *
 * const { open, close, isOpen } = useInnerLens({
 *   endpoint: '/api/bug-report',
 * });
 * </script>
 * ```
 */
declare function useInnerLens(config?: InnerLensCoreConfig): {
    open: () => void;
    close: () => void;
    isOpen: vue.Ref<boolean, boolean>;
    instance: vue.Ref<{
        mount: (container?: HTMLElement) => void;
        unmount: () => void;
        open: () => void;
        close: () => void;
        readonly isDialogOpen: boolean;
    } | null, InnerLensCore | {
        mount: (container?: HTMLElement) => void;
        unmount: () => void;
        open: () => void;
        close: () => void;
        readonly isDialogOpen: boolean;
    } | null>;
};
/**
 * Vue 3 InnerLens Widget Component
 */
declare const InnerLensWidget: vue.DefineComponent<vue.ExtractPropTypes<{
    endpoint: {
        type: StringConstructor;
        default: string;
    };
    repository: {
        type: StringConstructor;
        default: undefined;
    };
    labels: {
        type: PropType<string[]>;
        default: () => string[];
    };
    captureConsoleLogs: {
        type: BooleanConstructor;
        default: boolean;
    };
    maxLogEntries: {
        type: NumberConstructor;
        default: number;
    };
    maskSensitiveData: {
        type: BooleanConstructor;
        default: boolean;
    };
    styles: {
        type: PropType<StyleConfig>;
        default: undefined;
    };
    language: {
        type: PropType<"en" | "ko" | "ja" | "zh" | "es">;
        default: string;
    };
    hidden: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, ("open" | "close" | "success" | "error")[], "open" | "close" | "success" | "error", vue.PublicProps, Readonly<vue.ExtractPropTypes<{
    endpoint: {
        type: StringConstructor;
        default: string;
    };
    repository: {
        type: StringConstructor;
        default: undefined;
    };
    labels: {
        type: PropType<string[]>;
        default: () => string[];
    };
    captureConsoleLogs: {
        type: BooleanConstructor;
        default: boolean;
    };
    maxLogEntries: {
        type: NumberConstructor;
        default: number;
    };
    maskSensitiveData: {
        type: BooleanConstructor;
        default: boolean;
    };
    styles: {
        type: PropType<StyleConfig>;
        default: undefined;
    };
    language: {
        type: PropType<"en" | "ko" | "ja" | "zh" | "es">;
        default: string;
    };
    hidden: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onOpen?: ((...args: any[]) => any) | undefined;
    onClose?: ((...args: any[]) => any) | undefined;
    onSuccess?: ((...args: any[]) => any) | undefined;
    onError?: ((...args: any[]) => any) | undefined;
}>, {
    endpoint: string;
    repository: string;
    labels: string[];
    captureConsoleLogs: boolean;
    maxLogEntries: number;
    maskSensitiveData: boolean;
    styles: StyleConfig;
    language: "en" | "ko" | "ja" | "zh" | "es";
    hidden: boolean;
}, {}, {}, {}, string, vue.ComponentProvideOptions, true, {}, any>;

export { type AIProvider, type BugReportPayload, type BugReportResponse, type GitHubIssuePayload, type InnerLensConfig, InnerLensWidget, type LogEntry, type WidgetLanguage, addCustomLog, clearCapturedLogs, getCapturedLogs, initLogCapture, maskSensitiveData, maskSensitiveObject, restoreConsole, useInnerLens, validateMasking };
