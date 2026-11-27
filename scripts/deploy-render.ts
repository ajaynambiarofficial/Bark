import "dotenv/config";

const hookValue = process.env.RENDER_DEPLOY_HOOK_URL?.trim();

if (!hookValue) {
  console.error("RENDER_DEPLOY_HOOK_URL is not configured. Add the Render deploy hook URL to .env.");
  process.exitCode = 1;
} else {
  let hook: URL;
  try {
    hook = new URL(hookValue);
  } catch {
    console.error("RENDER_DEPLOY_HOOK_URL is not a valid URL.");
    process.exitCode = 1;
    process.exit();
  }

  if (hook.protocol !== "https:" || hook.hostname !== "api.render.com" || !hook.pathname.startsWith("/deploy/") || !hook.searchParams.get("key") || hook.searchParams.has("ref")) {
    console.error("Use a Render service deploy hook URL for latest-commit deploys. Do not include a specific commit ref.");
    process.exitCode = 1;
  } else {
    try {
      const response = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(15_000) });
      if (response.status === 200 || response.status === 202) {
        console.log(response.status === 200 ? "Render accepted the deploy." : "Render queued the deploy behind an active deployment.");
      } else {
        console.error(`Render rejected the deploy request (HTTP ${response.status}). Check the hook and service status in Render.`);
        process.exitCode = 1;
      }
    } catch {
      console.error("Could not reach Render. Check the network and try again.");
      process.exitCode = 1;
    }
  }
}
