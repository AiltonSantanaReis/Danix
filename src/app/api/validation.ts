export const toRequiredString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const toOptionalString = (value: unknown) => {
  const stringValue = toRequiredString(value);
  return stringValue || null;
};

export const toId = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

export const toOptionalId = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  return toId(value);
};

export const toRequiredNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};

export const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  return toRequiredNumber(value);
};

export const allowedDocumentAttachmentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export const isValidDataUrlAttachment = (type: string | null, data: string | null, maxLength = 8_500_000) => {
  return Boolean(type && data && allowedDocumentAttachmentTypes.has(type) && data.startsWith(`data:${type};base64,`) && data.length <= maxLength);
};
