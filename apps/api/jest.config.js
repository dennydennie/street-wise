
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      setupFiles: ['<rootDir>/src/test-support/jest-env.ts'],
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.e2e\\.spec\\.ts$', '\\.integration\\.spec\\.ts$'],
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            tsconfig: {
              module: 'commonjs',
              moduleResolution: 'node',
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
            },
          },
        ],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@streetwise/shared$': '<rootDir>/../../packages/shared/src',
      },
    },
  ],
};
