const configuredGithub = import.meta.env.PUBLIC_GITHUB_URL?.trim();
const github = configuredGithub && /^https?:\/\//.test(configuredGithub)
  ? configuredGithub
  : 'https://github.com/Plain-Workshop/pixcut';

export const GITHUB_URL = github.replace(/\/$/, '');
export const RELEASES_URL = `${GITHUB_URL}/releases/latest`;
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const DISCUSSIONS_URL = `${GITHUB_URL}/discussions`;
export const CONTRIBUTING_URL = `${GITHUB_URL}/blob/main/CONTRIBUTING.md`;
export const SECURITY_URL = `${GITHUB_URL}/security/policy`;
export const LICENSE_LABEL = 'MIT OR Apache-2.0';
