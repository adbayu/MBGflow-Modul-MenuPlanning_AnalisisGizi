const DEFAULT_BASE_URL = 'http://localhost:5000';
const DEFAULT_TIMEOUT_MS = 3000;

class RawMaterialServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'RawMaterialServiceError';
    this.code = options.code || 'RAW_MATERIAL_SERVICE_UNAVAILABLE';
    this.status = options.status || null;
    this.details = options.details || null;
  }
}

function getConfig() {
  return {
    baseUrl: (process.env.RAW_MATERIAL_SERVICE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    token: process.env.RAW_MATERIAL_SERVICE_TOKEN || '',
    timeoutMs: Number(process.env.RAW_MATERIAL_SERVICE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

async function requestJson(path) {
  const config = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers = { Accept: 'application/json' };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;

    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_error) {
      body = null;
    }

    if (!response.ok) {
      throw new RawMaterialServiceError(body?.message || body?.error || 'Raw material service error', {
        code: body?.error || 'RAW_MATERIAL_SERVICE_ERROR',
        status: response.status,
        details: body,
      });
    }

    return body;
  } catch (error) {
    if (error instanceof RawMaterialServiceError) throw error;
    throw new RawMaterialServiceError(error.message || 'Raw material service unavailable', {
      code: 'RAW_MATERIAL_SERVICE_UNAVAILABLE',
    });
  } finally {
    clearTimeout(timeout);
  }
}

function validateRawMaterialDto(dto) {
  if (!dto || typeof dto !== 'object') {
    throw new RawMaterialServiceError('Invalid raw material DTO', { code: 'INVALID_RAW_MATERIAL_DTO' });
  }
  if (!dto.id || !dto.name || !dto.unit) {
    throw new RawMaterialServiceError('Invalid raw material DTO', { code: 'INVALID_RAW_MATERIAL_DTO', details: dto });
  }
  return dto;
}

async function getRawMaterialById(id) {
  const body = await requestJson(`/api/v1/raw-materials/${encodeURIComponent(id)}`);
  return validateRawMaterialDto(body?.data);
}

async function checkAvailability(id, params = {}) {
  const query = new URLSearchParams();
  if (params.kitchen_id) query.set('kitchen_id', params.kitchen_id);
  if (params.quantity !== undefined && params.quantity !== null) query.set('quantity', String(params.quantity));
  if (params.unit) query.set('unit', params.unit);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return requestJson(`/api/v1/raw-materials/${encodeURIComponent(id)}/availability${suffix}`);
}

module.exports = {
  RawMaterialServiceError,
  getRawMaterialById,
  checkAvailability,
};
