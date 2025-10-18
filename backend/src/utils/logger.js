function serializeError(err) {
  if (!err) return undefined;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

function logError({ module = 'backend', location = 'unknown', message = 'Error', context = {} }, err) {
  const payload = {
    context,
    error: serializeError(err),
  };
  // Consistent formatting across backend
  console.error(`[ERROR] ${module}:${location} - ${message}`);
  console.error(payload);
}

module.exports = { logError };