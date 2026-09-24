import { loadAllAccounts } from "../../auth/token-manager";

export function maskToken(token: string): string {
  if (token.length <= 8) return "********";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function accountsCommand(): void {
  const accounts = loadAllAccounts();

  console.log(`\n📋 Discovered Freebuff Accounts (${accounts.length} found):\n`);
  if (accounts.length === 0) {
    console.log("   No accounts found.");
    console.log("   Run 'freebuff2api login' or export FREEBUFF_AUTH_TOKEN.\n");
    return;
  }

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    console.log(`   ${i + 1}. [${acc.source.toUpperCase()}] ID: ${acc.id}`);
    if (acc.email) {
      console.log(`      Email: ${acc.email}`);
    }
    console.log(`      Token: ${maskToken(acc.authToken)}`);
  }
  console.log("");
}
