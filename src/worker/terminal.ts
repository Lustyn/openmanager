import { execa } from "execa";

export async function attachToSession(containerId: string): Promise<void> {
  const subprocess = execa("docker", ["attach", containerId], {
    stdio: "inherit",
  });

  try {
    await subprocess;
  } catch (error) {
    const exitCode =
      typeof error === "object" && error !== null && "exitCode" in error
        ? (error as { exitCode?: number }).exitCode
        : undefined;
    if (exitCode !== undefined) {
      throw new Error(
        `Failed to attach to container ${containerId} (exit code ${exitCode}).`,
      );
    }
    throw error;
  }
}

export async function waitForContainer(containerId: string): Promise<void> {
  try {
    await execa("docker", ["wait", containerId], {
      stdio: "inherit",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to wait for container ${containerId}: ${message}`);
  }
}
