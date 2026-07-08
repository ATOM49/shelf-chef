import "server-only";

import { PostHog } from "posthog-node";

const globalForPostHog = globalThis as unknown as {
  posthogClient?: PostHog;
  posthogWarningEmitted?: boolean;
};

function getPostHogClient(): PostHog | null {
  const apiKey =
    process.env.POSTHOG_PROJECT_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!apiKey) {
    return null;
  }

  if (!globalForPostHog.posthogClient) {
    globalForPostHog.posthogClient = new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST,
    });
  }

  return globalForPostHog.posthogClient;
}

function warnOnce(message: string, error?: unknown) {
  if (globalForPostHog.posthogWarningEmitted) {
    return;
  }

  globalForPostHog.posthogWarningEmitted = true;
  console.warn(message, error);
}

export async function isPostHogFeatureEnabled(
  flagKey: string,
  distinctId: string,
): Promise<boolean> {
  const client = getPostHogClient();

  if (!client) {
    return false;
  }

  try {
    return (
      (await client.isFeatureEnabled(flagKey, distinctId, {
        disableGeoip: true,
        sendFeatureFlagEvents: false,
      })) === true
    );
  } catch (error) {
    warnOnce(`PostHog feature flag "${flagKey}" evaluation failed.`, error);
    return false;
  }
}
