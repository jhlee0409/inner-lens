/**
 * inner-lens Core Module
 * Framework-agnostic core functionality for bug reporting
 *
 * @packageDocumentation
 */

export * from './types';
export * from './utils/masking';
export * from './utils/log-capture';

// Core InnerLens class for framework-agnostic usage
export { InnerLensCore, type InnerLensCoreConfig } from './core/InnerLensCore';
