import { beforeAll, afterAll, vi } from 'vitest';

// Mock fs/promises para tests unitarios
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  copyFile: vi.fn()
}));

// Mock xlsx
vi.mock('xlsx', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
    json_to_sheet: vi.fn(),
    book_append_sheet: vi.fn(),
    book_new: vi.fn(),
    write: vi.fn()
  }
}));

// Configuración global de timeouts
vi.setConfig({ testTimeout: 10000 });