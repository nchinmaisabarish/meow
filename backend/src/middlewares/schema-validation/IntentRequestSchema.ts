export const IntentRequestSchema = {
  type: 'object',
  properties: {
    intent: { type: 'string', minLength: 1, maxLength: 100 },
    parameters: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['intent'],
  additionalProperties: false,
};
