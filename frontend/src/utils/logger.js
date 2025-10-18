export function serializeError(err) {
  if (!err) return undefined;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

export function logError({ module = 'frontend', location = 'unknown', message = 'Error', context = {} }, err) {
  const payload = {
    context,
    error: serializeError(err),
  };
  // Consistent formatting across frontend
  console.error(`[ERROR] ${module}:${location} - ${message}`);
  console.error(payload);
}