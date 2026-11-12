/** Vite `base` for a Pages site. A user site has an empty base path; a project site does not. */
export function pagesBase(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  if (value === '' || value === '/') return '/';
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
}
