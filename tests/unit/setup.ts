import '@testing-library/jest-dom';
import { vi } from 'vitest';

// @ts-expect-error - Global flag for React 19 testing environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  const mock = {
    ...actual,
    randomBytes: () => ({
      toString: () => 'mocked-hex',
    }),
  };
  return { ...mock, default: mock };
});

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  const mock = {
    ...actual,
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

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  const mock = {
    ...actual,
    resolve: (...args: string[]) => args.filter(Boolean).join('/'),
    join: (...args: string[]) => args.filter(Boolean).join('/'),
  };
  return { ...mock, default: mock };
});

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  const mock = {
    ...actual,
    resolve: (...args: string[]) => args.filter(Boolean).join('/'),
    join: (...args: string[]) => args.filter(Boolean).join('/'),
  };
  return { ...mock, default: mock };
});
