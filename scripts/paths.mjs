import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');
export const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
export const artifacts = path.join(root, 'artifacts');
export const windowsOutput = path.join(artifacts, 'windows');
export const validationOutput = path.join(windowsOutput, 'validation');
export const testCache = path.join(artifacts, 'test-cache');
export const portableFilename = 'SF-Tools-' + version + '-windows-x64.exe';
export const installerFilename = 'SF-Tools-' + version + '-windows-x64-setup.exe';
