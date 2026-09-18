export const AgentRequestSchema = {
  type: 'object',
  properties: {
    input: { type: 'string', minLength: 1, maxLength: 2000 },
  },
  required: ['input'],
  additionalProperties: false,
};
