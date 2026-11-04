process.env.NODE_ENV = 'test';
process.env.API_JWT_SECRET ??= 'local-test-secret-with-enough-length-0000';
process.env.OTP_PEPPER ??= 'local-test-otp-pepper';
process.env.DATABASE_URL ??= 'postgresql://streetwise:streetwise@localhost:5436/streetwise';
