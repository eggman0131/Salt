const DEBUG_FLAG = 'salt_debug';

export const isDebugEnabled = (): boolean => {
  try {
    if (import.meta.env.DEV) return true;
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DEBUG_FLAG) === 'true' || Boolean((window as any).__SALT_DEBUG__);
  } catch (e) {
    return false;
  }
};

export const setDebug = (on: boolean) => {
  try {
    if (typeof window !== 'undefined') {
      if (on) localStorage.setItem(DEBUG_FLAG, 'true');
      else localStorage.removeItem(DEBUG_FLAG);
      (window as any).__SALT_DEBUG__ = on;
    }
  } catch (e) {
    // ignore
  }
};

export const logger = {
  log: (...args: any[]) => { if (isDebugEnabled()) console.log(...args); },
  info: (...args: any[]) => { if (isDebugEnabled()) console.info(...args); },
  warn: (...args: any[]) => { if (isDebugEnabled()) console.warn(...args); },
  error: (...args: any[]) => { console.error(...args); }
};

export default logger;
