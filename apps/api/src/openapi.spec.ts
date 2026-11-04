import { shouldExposeSwaggerUi } from './openapi';

describe('shouldExposeSwaggerUi', () => {
  it('is off in production even when enabled', () => {
    expect(shouldExposeSwaggerUi({ nodeEnv: 'production', swaggerUiEnabled: true })).toBe(false);
  });

  it('is on in development when enabled', () => {
    expect(shouldExposeSwaggerUi({ nodeEnv: 'development', swaggerUiEnabled: true })).toBe(true);
  });
});
