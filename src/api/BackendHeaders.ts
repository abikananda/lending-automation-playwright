export function buildBackendHeaders(apiKey: string, authHeader: string): Record<string, string> {
  const normalizedKey = apiKey.trim();
  const normalizedHeader = authHeader.trim();

  if (!normalizedKey) throw new Error('BACKEND_API_KEY must not be blank');
  if (!normalizedHeader) throw new Error('BACKEND_AUTH_HEADER must not be blank');

  return {
    Accept: '*/*',
    'Content-Type': 'application/json',
    [normalizedHeader]: normalizedKey,
  };
}
