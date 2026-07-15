import Docker from 'dockerode';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PassThrough } from 'node:stream';
import { dockerMountLogLine, dockerWorkspaceBind, needsOneDriveBindHint } from './docker-bind.js';
import { envToDockerList } from './env.js';
import type { ExecutionHandle, ExecutorOptions } from './shell.js';

export interface DockerOptions extends ExecutorOptions {
  image: string;
  platform: string | null;
}

function ignoreKillError(): void {
  return;
}

export function runDocker(opts: DockerOptions): ExecutionHandle {
  mkdirSync(dirname(opts.logPath), { recursive: true });
  const logFile = createWriteStream(opts.logPath, { flags: 'a', encoding: 'utf8' });

  const docker = new Docker();
  let cancelled = false;
  let container: Docker.Container | null = null;
  let exited = false;

  function write(line: string, kind: 'out' | 'err'): void {
    const clean = line.replace(/\r$/, '');
    logFile.write(`${kind}\t${clean}\n`);
    opts.onLine(clean, kind);
  }

  function emitLines(buf: string, kind: 'out' | 'err'): string {
    let rest = buf;
    let idx = rest.indexOf('\n');
    while (idx !== -1) {
      write(rest.slice(0, idx), kind);
      rest = rest.slice(idx + 1);
      idx = rest.indexOf('\n');
    }
    return rest;
  }

  async function start(): Promise<void> {
    try {
      try {
        await docker.getImage(opts.image).inspect();
      } catch (_e: unknown) {
        let pullLine = `pulling ${opts.image}`;
        if (opts.platform !== null) {
          pullLine = `${pullLine} (${opts.platform})`;
        }
        write(`${pullLine}...`, 'out');
        const pullOpts: { platform?: string } = {};
        if (opts.platform !== null) {
          pullOpts.platform = opts.platform;
        }
        const stream = await docker.pull(opts.image, pullOpts);
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(stream, (err: Error | null) => {
            if (err === null) {
              resolve();
              return;
            }
            reject(err);
          });
        });
      }

      write(dockerMountLogLine(opts.cwd), 'out');
      if (needsOneDriveBindHint(opts.cwd)) {
        write(
          '[lotaru] OneDrive folder: enable path in Docker Desktop → Settings → Resources → File sharing',
          'out',
        );
      }

      const createOpts: Docker.ContainerCreateOptions = {
        Image: opts.image,
        Cmd: ['/bin/sh', '-c', opts.command],
        WorkingDir: '/workspace',
        Env: envToDockerList(opts.env),
        HostConfig: {
          AutoRemove: true,
          Binds: [dockerWorkspaceBind(opts.cwd)],
        },
        Tty: false,
      };
      if (opts.platform !== null) {
        createOpts.platform = opts.platform;
      }
      container = await docker.createContainer(createOpts);

      const logStream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
      });

      let outBuf = '';
      let errBuf = '';
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      stdout.on('data', (chunk: Buffer) => {
        outBuf += chunk.toString('utf8');
        outBuf = emitLines(outBuf, 'out');
      });
      stderr.on('data', (chunk: Buffer) => {
        errBuf += chunk.toString('utf8');
        errBuf = emitLines(errBuf, 'err');
      });

      docker.modem.demuxStream(logStream, stdout, stderr);

      await container.start();

      const result = (await container.wait()) as { StatusCode?: number };
      exited = true;
      if (outBuf.length > 0) {
        write(outBuf, 'out');
        outBuf = '';
      }
      if (errBuf.length > 0) {
        write(errBuf, 'err');
        errBuf = '';
      }
      logFile.end();
      let exitCode: number | null = null;
      if (typeof result.StatusCode === 'number') {
        exitCode = result.StatusCode;
      }
      opts.onExit(exitCode, cancelled);
    } catch (e: unknown) {
      if (!exited) {
        exited = true;
        write(`docker error: ${String(e)}`, 'err');
        logFile.end();
        opts.onExit(null, cancelled);
      }
    }
  }

  void start();

  return {
    cancel(): void {
      if (cancelled || exited) {
        return;
      }
      cancelled = true;
      if (container === null) {
        return;
      }
      container.kill().catch(ignoreKillError);
    },
  };
}
