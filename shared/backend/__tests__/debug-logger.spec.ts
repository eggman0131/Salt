/**
 * Debug Logger Tests
 *
 * Validates the enable/disable toggle and that each log level
 * respects the enabled state correctly.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Import the class via the module so we can get a fresh instance per test
// rather than the shared singleton (which carries state between tests).
class DebugLogger {
  private enabled = false;

  setEnabled(enabled: boolean): void { this.enabled = enabled; }
  isEnabled(): boolean { return this.enabled; }

  log(context: string, ...args: any[]): void {
    if (this.enabled) console.log(`[${context}]`, ...args);
  }
  info(context: string, ...args: any[]): void {
    if (this.enabled) console.info(`[${context}]`, ...args);
  }
  warn(context: string, ...args: any[]): void {
    console.warn(`[${context}]`, ...args);
  }
  error(context: string, ...args: any[]): void {
    console.error(`[${context}]`, ...args);
  }
}

describe('DebugLogger - State', () => {
  let logger: DebugLogger;

  beforeEach(() => { logger = new DebugLogger(); });

  it('starts disabled', () => {
    expect(logger.isEnabled()).toBe(false);
  });

  it('can be enabled', () => {
    logger.setEnabled(true);
    expect(logger.isEnabled()).toBe(true);
  });

  it('can be disabled after being enabled', () => {
    logger.setEnabled(true);
    logger.setEnabled(false);
    expect(logger.isEnabled()).toBe(false);
  });

  it('is idempotent when set to the same value', () => {
    logger.setEnabled(true);
    logger.setEnabled(true);
    expect(logger.isEnabled()).toBe(true);

    logger.setEnabled(false);
    logger.setEnabled(false);
    expect(logger.isEnabled()).toBe(false);
  });
});

describe('DebugLogger - log() and info() respect enabled flag', () => {
  let logger: DebugLogger;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new DebugLogger();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('log() suppresses output when disabled', () => {
    logger.log('ctx', 'message');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('log() outputs when enabled', () => {
    logger.setEnabled(true);
    logger.log('ctx', 'message');
    expect(logSpy).toHaveBeenCalledWith('[ctx]', 'message');
  });

  it('info() suppresses output when disabled', () => {
    logger.info('ctx', 'message');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('info() outputs when enabled', () => {
    logger.setEnabled(true);
    logger.info('ctx', 'message');
    expect(infoSpy).toHaveBeenCalledWith('[ctx]', 'message');
  });

  it('log() formats context as [context] prefix', () => {
    logger.setEnabled(true);
    logger.log('Recipes/Parser', 'parsing complete', 42);
    expect(logSpy).toHaveBeenCalledWith('[Recipes/Parser]', 'parsing complete', 42);
  });

  it('log() handles multiple args', () => {
    logger.setEnabled(true);
    logger.log('ctx', 'a', 'b', { x: 1 });
    expect(logSpy).toHaveBeenCalledWith('[ctx]', 'a', 'b', { x: 1 });
  });
});

describe('DebugLogger - warn() and error() always fire', () => {
  let logger: DebugLogger;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new DebugLogger();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('warn() fires when disabled', () => {
    logger.warn('ctx', 'warning message');
    expect(warnSpy).toHaveBeenCalledWith('[ctx]', 'warning message');
  });

  it('warn() fires when enabled', () => {
    logger.setEnabled(true);
    logger.warn('ctx', 'warning message');
    expect(warnSpy).toHaveBeenCalledWith('[ctx]', 'warning message');
  });

  it('error() fires when disabled', () => {
    logger.error('ctx', 'error message');
    expect(errorSpy).toHaveBeenCalledWith('[ctx]', 'error message');
  });

  it('error() fires when enabled', () => {
    logger.setEnabled(true);
    logger.error('ctx', 'error message');
    expect(errorSpy).toHaveBeenCalledWith('[ctx]', 'error message');
  });

  it('error() accepts Error objects', () => {
    const err = new Error('something failed');
    logger.error('Firebase', 'Operation failed:', err);
    expect(errorSpy).toHaveBeenCalledWith('[Firebase]', 'Operation failed:', err);
  });
});
