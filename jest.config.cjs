/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // 👇 fix the typo (Mapper, not Mapping) and keep the rule
  moduleNameMapper: {
    // let TS files that import with ".js" resolve to the .ts sources in Jest
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // optional but helpful to see TS diagnostics from ts-jest
  globals: {
    'ts-jest': { isolatedModules: false },
  },
};
