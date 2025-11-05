import { execa } from 'execa';

import { SessionContext } from '../session/context.js';

interface LaunchAgentArgs {
  session: SessionContext;
  nonInteractive: boolean;
}

interface LaunchResult {
  containerId: string;
}

export async function launchAgentContainer({ session }: LaunchAgentArgs): Promise<LaunchResult> {
  // TODO: implement Docker launch logic
  const { stdout } = await execa('echo', [`launching container for ${session.sessionId}`]);
  return { containerId: stdout.trim() };
}
