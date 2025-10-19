module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/services/SnapshotSelector.ts',
    'src/services/TimelineGenerator.ts',
    'src/services/WaybackCrawler.ts',
    'src/utils/DateFormatter.ts'
  ],
  moduleNameMapper: {
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@views/(.*)$': '<rootDir>/src/views/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^open$': '<rootDir>/src/__mocks__/open.ts'
  },
  coverageThreshold: {
    global: {
      branches: 57,
      functions: 79,
      lines: 68,
      statements: 69
    }
  }
};
