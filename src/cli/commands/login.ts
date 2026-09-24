import { executeDeviceCodeLogin } from "../../auth/device-login";

export interface LoginCommandOptions {
  upstream?: string;
}

export async function loginCommand(options: LoginCommandOptions): Promise<void> {
  console.log("Initiating Freebuff device-code authentication...");
  try {
    const user = await executeDeviceCodeLogin({
      upstreamBase: options.upstream,
    });
    console.log(`\n✅ Successfully logged in as ${user.name || user.email || user.id}!`);
    console.log(`   Token stored in ~/.freebuff2api/config.json\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Login failed: ${message}\n`);
    process.exit(1);
  }
}
