import { expect, test } from 'vitest';
import { pagesBase } from '../shared/pages-base.ts';

test('pagesBase keeps a root site at / and prefixes a project site', () => {
  expect(pagesBase(undefined)).toBe('/');
  expect(pagesBase('')).toBe('/');
  expect(pagesBase('/')).toBe('/');
  expect(pagesBase('/color-mix')).toBe('/color-mix/');
  expect(pagesBase('/color-mix/')).toBe('/color-mix/');
  expect(pagesBase('color-mix')).toBe('/color-mix/');
});
