import { invokeMcpTool, McpHttpError } from "@/src/lib/mcp/invoke";
import { getMcpProvider } from "@/src/lib/mcp/providers";
import { INSTAMART_PROVIDER_KEY } from "@/src/lib/instamart/workflow";

const SWIGGY_REAUTHORIZE_MESSAGE =
  "Swiggy authorization expired or invalid. Reconnect Swiggy and retry.";

export class SwiggyReauthorizeRequiredError extends Error {
  constructor() {
    super(SWIGGY_REAUTHORIZE_MESSAGE);
    this.name = "SwiggyReauthorizeRequiredError";
  }
}

export function createInstamartToolCaller(userId: string) {
  const provider = getMcpProvider(INSTAMART_PROVIDER_KEY);
  if (!provider) {
    throw new Error(`Missing MCP provider config for ${INSTAMART_PROVIDER_KEY}.`);
  }

  return async (toolName: string, toolArgs?: Record<string, unknown>) => {
    try {
      return await invokeMcpTool({
        userId,
        providerKey: INSTAMART_PROVIDER_KEY,
        mcpServerUrl: provider.mcpServerUrl,
        toolName,
        toolArgs,
      });
    } catch (error) {
      if (error instanceof McpHttpError && error.status === 401) {
        throw new SwiggyReauthorizeRequiredError();
      }
      throw error;
    }
  };
}

export { SWIGGY_REAUTHORIZE_MESSAGE };
