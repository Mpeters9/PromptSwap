export function logError(message: string, error?: any) {
  console.error(`[ERROR] ${message}`, error || '');
}

export function logInfo(message: string, data?: any) {
  console.log(`[INFO] ${message}`, data || '');
}
