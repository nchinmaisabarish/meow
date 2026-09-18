export const NaturalLanguageQueryRequestSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 1000 },
  },
  required: ['query'],
  additionalProperties: false,
};
