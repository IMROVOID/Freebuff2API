import { Command } from "commander";
import { accountsCommand } from "./commands/accounts";
import { loginCommand } from "./commands/login";
import { startServer } from "./commands/serve";

const program = new Command();

program
  .name("freebuff2api")
  .description("OpenAI-compatible OAuth router & proxy for Freebuff unmetered AI access")
  .version("1.0.0");

program
  .command("serve")
  .description("Start the local OpenAI-compatible HTTP proxy daemon")
  .option("-p, --port <port>", "Port to listen on", "8787")
  .option("-h, --host <host>", "Host address to bind to", "127.0.0.1")
  .option("-t, --token <token>", "Freebuff auth token (overrides env and config)")
  .option("-u, --upstream <url>", "Upstream Freebuff base URL", "https://freebuff.com")
  .action((options) => {
    startServer(options);
  });

program
  .command("login")
  .description("Authenticate with Freebuff via device-code flow")
  .option("-u, --upstream <url>", "Upstream Freebuff base URL", "https://freebuff.com")
  .action(async (options) => {
    await loginCommand(options);
  });

program
  .command("accounts")
  .description("List all discovered and configured Freebuff accounts")
  .action(() => {
    accountsCommand();
  });

program.parse(process.argv);
