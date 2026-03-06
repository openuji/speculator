import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname as pathDirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
    BikeshedRenderInput,
    BikeshedRenderResult,
    BikeshedRenderer,
    RendererDiagnostic,
} from './types.js';

const DEFAULT_IMAGE = 'openuji/bikeshed-renderer:latest';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_BUILD_TIMEOUT_MS = 600_000;

export interface DockerBikeshedRendererOptions {
    image?: string;
    command?: string;
    timeoutMs?: number;
    outputFileName?: string;
    autoBuildImage?: boolean;
    dockerfilePath?: string;
    dockerBuildContext?: string;
}

/**
 * Docker-backed renderer adapter for Bikeshed.
 *
 * Render command:
 *   docker run --rm -v <stagedDir>:/work -w /work <image> bikeshed spec <input.bs> <output.html>
 */
export class DockerBikeshedRenderer implements BikeshedRenderer {
    private readonly image: string;
    private readonly command: string;
    private readonly timeoutMs: number;
    private readonly outputFileName: string;
    private readonly autoBuildImage: boolean;
    private readonly dockerfilePath: string;
    private readonly dockerBuildContext: string;

    constructor(options: DockerBikeshedRendererOptions = {}) {
        const defaultDockerfilePath = fileURLToPath(
            new URL('../../docker/bikeshed-renderer/Dockerfile', import.meta.url),
        );

        this.image = options.image ?? DEFAULT_IMAGE;
        this.command = options.command ?? 'docker';
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.outputFileName = options.outputFileName ?? 'index.html';
        this.autoBuildImage = options.autoBuildImage ?? options.image === undefined;
        this.dockerfilePath = options.dockerfilePath ?? defaultDockerfilePath;
        this.dockerBuildContext =
            options.dockerBuildContext ?? pathDirname(this.dockerfilePath);
    }

    async render(input: BikeshedRenderInput): Promise<BikeshedRenderResult> {
        const logs: string[] = [];

        const imageReady = await this.ensureImageAvailable();
        logs.push(...imageReady.logs);
        if (!imageReady.ok) {
            return {
                html: '',
                logs,
                diagnostics: imageReady.diagnostics,
            };
        }

        const tempRoot = await mkdtemp(join(tmpdir(), 'bikeshed-render-'));
        const workDir = join(tempRoot, 'work');

        try {
            await mkdir(workDir, { recursive: true });

            const inputFileName =
                input.sourcePath && input.sourcePath.trim().length > 0
                    ? basename(input.sourcePath)
                    : 'index.bs';

            if (input.sourcePath) {
                await copyDirectoryContents(pathDirname(input.sourcePath), workDir);
            }

            await writeFile(join(workDir, inputFileName), input.bsContent, 'utf-8');

            const args = [
                'run',
                '--rm',
                '-v',
                `${workDir}:/work`,
                '-w',
                '/work',
                this.image,
                'bikeshed',
                'spec',
                inputFileName,
                this.outputFileName,
            ];

            const commandResult = await runCommand(this.command, args, this.timeoutMs);
            logs.push(`$ ${this.command} ${args.join(' ')}`);
            logs.push(...splitLines(commandResult.stdout));
            logs.push(...splitLines(commandResult.stderr));

            if (commandResult.timedOut) {
                return {
                    html: '',
                    logs,
                    diagnostics: [
                        {
                            level: 'error',
                            code: 'DOCKER_RENDER_TIMEOUT',
                            message: `Bikeshed render timed out after ${this.timeoutMs}ms.`,
                        },
                    ],
                };
            }

            if (commandResult.error) {
                return {
                    html: '',
                    logs,
                    diagnostics: [
                        {
                            level: 'error',
                            code: 'DOCKER_RENDER_FAILED_TO_START',
                            message: commandResult.error.message,
                        },
                    ],
                };
            }

            if (commandResult.exitCode !== 0) {
                const diagnostics = stderrToDiagnostics(commandResult.stderr);
                diagnostics.unshift({
                    level: 'error',
                    code: 'DOCKER_RENDER_EXIT_NON_ZERO',
                    message: `Docker renderer exited with code ${commandResult.exitCode}.`,
                });

                return {
                    html: '',
                    logs,
                    diagnostics,
                };
            }

            const htmlPath = join(workDir, this.outputFileName);
            let html = '';
            try {
                html = await readFile(htmlPath, 'utf-8');
            } catch {
                return {
                    html: '',
                    logs,
                    diagnostics: [
                        {
                            level: 'error',
                            code: 'DOCKER_RENDER_NO_OUTPUT',
                            message: `Bikeshed renderer did not produce ${this.outputFileName}.`,
                        },
                    ],
                };
            }

            return {
                html,
                logs,
                diagnostics: stderrToDiagnostics(commandResult.stderr),
            };
        } catch (error) {
            return {
                html: '',
                logs,
                diagnostics: [
                    {
                        level: 'error',
                        code: 'DOCKER_RENDER_RUNTIME_ERROR',
                        message: (error as Error).message,
                    },
                ],
            };
        } finally {
            await rm(tempRoot, { recursive: true, force: true });
        }
    }

    private async ensureImageAvailable(): Promise<ImageEnsureResult> {
        const logs: string[] = [];

        const inspectArgs = ['image', 'inspect', this.image];
        const inspect = await runCommand(this.command, inspectArgs, 30_000);
        logs.push(`$ ${this.command} ${inspectArgs.join(' ')}`);
        logs.push(...splitLines(inspect.stdout));
        logs.push(...splitLines(inspect.stderr));

        if (inspect.exitCode === 0) {
            return { ok: true, logs, diagnostics: [] };
        }

        if (!this.autoBuildImage) {
            return {
                ok: false,
                logs,
                diagnostics: [
                    {
                        level: 'error',
                        code: 'DOCKER_IMAGE_NOT_FOUND',
                        message: `Docker image ${this.image} is not available locally and autoBuildImage is disabled.`,
                    },
                ],
            };
        }

        const buildArgs = [
            'build',
            '-t',
            this.image,
            '-f',
            this.dockerfilePath,
            this.dockerBuildContext,
        ];
        const build = await runCommand(this.command, buildArgs, DEFAULT_BUILD_TIMEOUT_MS);
        logs.push(`$ ${this.command} ${buildArgs.join(' ')}`);
        logs.push(...splitLines(build.stdout));
        logs.push(...splitLines(build.stderr));

        if (build.timedOut) {
            return {
                ok: false,
                logs,
                diagnostics: [
                    {
                        level: 'error',
                        code: 'DOCKER_IMAGE_BUILD_TIMEOUT',
                        message: `Building renderer image timed out after ${DEFAULT_BUILD_TIMEOUT_MS}ms.`,
                    },
                ],
            };
        }

        if (build.error || build.exitCode !== 0) {
            return {
                ok: false,
                logs,
                diagnostics: [
                    {
                        level: 'error',
                        code: 'DOCKER_IMAGE_BUILD_FAILED',
                        message:
                            build.error?.message ??
                            `Failed to build Docker image ${this.image} (exit code ${build.exitCode}).`,
                    },
                    ...stderrToDiagnostics(build.stderr),
                ],
            };
        }

        return { ok: true, logs, diagnostics: [] };
    }
}

interface CommandResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
    timedOut: boolean;
}

interface ImageEnsureResult {
    ok: boolean;
    logs: string[];
    diagnostics: RendererDiagnostic[];
}

function runCommand(
    command: string,
    args: string[],
    timeoutMs: number,
): Promise<CommandResult> {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        let done = false;
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer | string) => {
            stdout += String(chunk);
        });

        child.stderr.on('data', (chunk: Buffer | string) => {
            stderr += String(chunk);
        });

        child.on('error', (error) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({
                exitCode: null,
                stdout,
                stderr,
                error,
                timedOut,
            });
        });

        child.on('close', (exitCode) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({
                exitCode,
                stdout,
                stderr,
                timedOut,
            });
        });
    });
}

function splitLines(value: string): string[] {
    return value
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function stderrToDiagnostics(stderr: string): RendererDiagnostic[] {
    const lines = splitLines(stderr);
    return lines.map((line) => ({
        level: /\berror\b/i.test(line) ? 'error' : 'warning',
        message: line,
    }));
}

async function copyDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
    const entries = await readdir(sourceDir);
    await Promise.all(
        entries.map((entryName) =>
            cp(join(sourceDir, entryName), join(targetDir, entryName), {
                recursive: true,
                force: true,
                errorOnExist: false,
            }),
        ),
    );
}
