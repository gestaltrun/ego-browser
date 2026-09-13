/** Paths and child environment for this plugin's independent Ego runtime. */
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Read the private runtime directory without adopting an external Ego profile. */
export function managedRuntimeRoot(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolve(env.DSH_HOME || join(homedir(), '.dsh')), 'ego-browser')
}

/** Exact state directory shared by this plugin's CLI and capture worker. */
export function managedStateDirectory(env: NodeJS.ProcessEnv = process.env): string {
  return join(managedRuntimeRoot(env), 'state')
}

/** Build a child-only environment; external Ego endpoints and profiles are never inherited. */
export function managedRuntimeEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...base }
  delete env.EGO_LINUX_CDP_URL
  delete env.EGO_LINUX_CHROME
  delete env.EGO_LINUX_PROFILE
  delete env.EGO_LINUX_STATE_DIR
  delete env.EGO_LINUX_DATA_DIR
  delete env.EGO_BROWSER_AGENT_WORKSPACE
  env.EGO_BROWSER_AGENT_WORKSPACE = join(managedRuntimeRoot(base), 'agent')
  env.EGO_LINUX_REAP_ORPHANS = '0'
  env.EGO_LINUX_STATE_DIR = managedStateDirectory(base)
  env.EGO_LINUX_DATA_DIR = managedRuntimeRoot(base)
  env.EGO_LINUX_PROFILE = join(managedRuntimeRoot(base), 'profile')
  if (base.DSH_EGO_CHROME_PATH) env.EGO_LINUX_CHROME = base.DSH_EGO_CHROME_PATH
  return env
}
