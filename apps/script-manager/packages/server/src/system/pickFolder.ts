import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type PickFolderResult = { path: string | null } | { error: 'unsupported' };

async function pickFolderWindows(): Promise<string | null> {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$d.Description = "Select project folder"',
    '$d.ShowNewFolderButton = $true',
    'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }',
  ].join('; ');
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-STA', '-Command', script],
    { windowsHide: false },
  );
  const path = stdout.trim();
  if (path.length === 0) {
    return null;
  }
  return path;
}

async function pickFolderMac(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Select project folder")',
    ]);
    const path = stdout.trim();
    if (path.length === 0) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

async function pickFolderLinux(): Promise<PickFolderResult> {
  try {
    const { stdout } = await execFileAsync('zenity', [
      '--file-selection',
      '--directory',
      '--title=Select project folder',
    ]);
    const path = stdout.trim();
    if (path.length === 0) {
      return { path: null };
    }
    return { path };
  } catch (e: unknown) {
    const err = e as { code?: number | string };
    if (err.code === 1) {
      return { path: null };
    }
  }
  try {
    let home = '/';
    const homeEnv = process.env['HOME'];
    if (homeEnv !== undefined) {
      home = homeEnv;
    }
    const { stdout } = await execFileAsync('kdialog', ['--getexistingdirectory', home]);
    const path = stdout.trim();
    if (path.length === 0) {
      return { path: null };
    }
    return { path };
  } catch (e: unknown) {
    const err = e as { code?: number | string };
    if (err.code === 1) {
      return { path: null };
    }
    return { error: 'unsupported' };
  }
}

export async function pickFolder(): Promise<PickFolderResult> {
  if (process.platform === 'win32') {
    return { path: await pickFolderWindows() };
  }
  if (process.platform === 'darwin') {
    return { path: await pickFolderMac() };
  }
  if (process.platform === 'linux') {
    return pickFolderLinux();
  }
  return { error: 'unsupported' };
}
