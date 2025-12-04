const isProd = process.env.NODE_ENV === 'production';

function safeLog(method: 'log' | 'error', message: string, meta?: any) {
  const prefix = isProd ? '[server] ' : '';

  try {
    if (typeof meta !== 'undefined') {
      console[method](`${prefix}${message}`, meta);
    } else {
      console[method](`${prefix}${message}`);
    }
  } catch {
    // Never let logging crash the app.
  }
}

export function logInfo(message: string, meta?: any) {
  safeLog('log', message, meta);
}

export function logError(message: string, meta?: any) {
  safeLog('error', message, meta);
}
