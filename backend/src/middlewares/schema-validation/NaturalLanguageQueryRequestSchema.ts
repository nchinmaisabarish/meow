export const NaturalLanguageQueryRequestSchema = {
  type: 'object',
  required: ['query'],
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      maxLength: 1000,
    },
  },
  additionalProperties: false,
};
