/**
 * Debug Logger - Centralized logging system
 * 
 * Can be enabled/disabled via the Admin interface.
 * When enabled, logs are output to console with contextual prefixes.
 * When disabled, all debug logs are suppressed (errors still show).
 */

class DebugLogger {
  private enabled: boolean = false;

  /**
   * Set the debug state (called when settings change)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if debug logging is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Log a debug message (only shows if enabled)
   */
  log(context: string, ...args: any[]): void {
    if (this.enabled) {
      console.log(`[${context}]`, ...args);
    }
  }

  /**
   * Log an info message (only shows if enabled)
   */
  info(context: string, ...args: any[]): void {
    if (this.enabled) {
      console.info(`[${context}]`, ...args);
    }
  }

  /**
   * Log a warning (always shows, but with context)
   */
  warn(context: string, ...args: any[]): void {
    console.warn(`[${context}]`, ...args);
  }

  /**
   * Log an error (always shows)
   */
  error(context: string, ...args: any[]): void {
    console.error(`[${context}]`, ...args);
  }
}

// Export singleton instance
export const debugLogger = new DebugLogger();
