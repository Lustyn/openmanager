import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { execa } from "execa";

import type { DockerConfig } from "../../config/session-config.ts";
import {
  DEFAULT_BASE_IMAGE,
  DEFAULT_BUILD_STEPS,
  DEFAULT_IMAGE,
  PROJECT_ROOT,
} from "./shared.ts";
const CACHE_ROOT = resolve(PROJECT_ROOT, ".openmanager", "cache", "docker");

export async function ensureAgentImage(
  dockerConfig?: DockerConfig,
): Promise<string> {
  if (!dockerConfig || isDefaultConfig(dockerConfig)) {
    await ensureDefaultImageBuilt();
    return DEFAULT_IMAGE;
  }

  const baseImage = dockerConfig.baseImage || DEFAULT_BASE_IMAGE;
  const customSteps = dockerConfig.steps ?? [];
  const instructions = buildInstructions(baseImage, customSteps);
  const dockerfileContent = `${instructions.join("\n")}\n`;
  const imageTag = computeImageTag(baseImage, customSteps);

  console.log("Ensuring custom image built", imageTag, instructions);

  if (await imageExists(imageTag)) {
    console.log("Custom image already built");
    return imageTag;
  }

  await buildImageFromContent(imageTag, dockerfileContent);

  return imageTag;
}

async function ensureDefaultImageBuilt(): Promise<void> {
  console.log("Ensuring default image built");
  if (await imageExists(DEFAULT_IMAGE)) {
    console.log("Default image already built");
    return;
  }

  const instructions = buildInstructions(DEFAULT_BASE_IMAGE, []);
  const dockerfileContent = `${instructions.join("\n")}\n`;
  await buildImageFromContent(DEFAULT_IMAGE, dockerfileContent);
}

function isDefaultConfig(config: DockerConfig): boolean {
  const hasBaseImage = Boolean(config.baseImage);
  const hasSteps = Boolean(config.steps && config.steps.length > 0);
  return !hasBaseImage && !hasSteps;
}

function buildInstructions(baseImage: string, customSteps: string[]): string[] {
  return [`FROM ${baseImage}`, ...DEFAULT_BUILD_STEPS, ...customSteps];
}

async function buildImageFromContent(
  imageTag: string,
  dockerfileContent: string,
): Promise<void> {
  const buildDir = resolve(CACHE_ROOT, sanitizeImageTag(imageTag));
  await mkdir(buildDir, { recursive: true });
  const dockerfilePath = resolve(buildDir, "Dockerfile");
  await writeFile(dockerfilePath, dockerfileContent, "utf8");

  await execa(
    "docker",
    ["build", "-f", dockerfilePath, "-t", imageTag, buildDir],
    { cwd: PROJECT_ROOT },
  );
}

function computeImageTag(baseImage: string, steps: string[]): string {
  const hash = createHash("sha256")
    .update(baseImage)
    .update(JSON.stringify(DEFAULT_BUILD_STEPS))
    .update(JSON.stringify(steps))
    .digest("hex")
    .slice(0, 12);
  return `openmanager/opencode:${hash}`;
}

function sanitizeImageTag(tag: string): string {
  return tag.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

async function imageExists(image: string): Promise<boolean> {
  try {
    await execa("docker", ["image", "inspect", image], { cwd: PROJECT_ROOT });
    return true;
  } catch {
    return false;
  }
}
