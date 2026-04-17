import '@testing-library/jest-dom';
import { vi } from 'vitest';

// @ts-expect-error - Global flag for React 19 testing environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('crypto', () => {
  const mock = {
    randomBytes: () => ({
      toString: () => 'mocked-hex',
    }),
  };
  return { ...mock, default: mock };
});

vi.mock('node:crypto', () => {
  const mock = {
    randomBytes: () => ({
      toString: () => 'mocked-hex',
    }),
  };
  return { ...mock, default: mock };
});

vi.mock('fs/promises', () => {
  const mock = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  };
  return { ...mock, default: mock };
});

vi.mock('node:fs/promises', () => {
  const mock = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  };
  return { ...mock, default: mock };
});

vi.mock('path', () => {
  const mock = {
    resolve: (...args: string[]) => args.filter(Boolean).join('/'),
    join: (...args: string[]) => args.filter(Boolean).join('/'),
  };
  return { ...mock, default: mock };
});

vi.mock('node:path', () => {
  const mock = {
    resolve: (...args: string[]) => args.filter(Boolean).join('/'),
    join: (...args: string[]) => args.filter(Boolean).join('/'),
  };
  return { ...mock, default: mock };
});
