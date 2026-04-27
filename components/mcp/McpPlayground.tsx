"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type McpPlaygroundProvider = {
  key: string;
  label: string;
  mcpServerUrl: string;
  scopes: string[];
  connected: boolean;
  expiresAt: string | null;
  tokenType: string | null;
  grantedScope: string | null;
};

type McpPlaygroundNotice = {
  tone: "success" | "error";
  message: string;
} | null;

type InvokeFeedback = {
  tone: "success" | "error";
  body: string;
};

type McpPlaygroundProps = {
  providers: McpPlaygroundProvider[];
  initialNotice: McpPlaygroundNotice;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No expiry returned by provider";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function McpPlayground({
  providers,
  initialNotice,
}: McpPlaygroundProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<McpPlaygroundNotice>(initialNotice);
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(
    null,
  );
  const [invokingProvider, setInvokingProvider] = useState<string | null>(null);
  const [toolNames, setToolNames] = useState<Record<string, string>>({});
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});
  const [invokeFeedback, setInvokeFeedback] = useState<
    Record<string, InvokeFeedback | undefined>
  >({});

  async function handleDisconnect(providerKey: string) {
    setDisconnectingProvider(providerKey);
    setNotice(null);

    try {
      const response = await fetch(`/api/integrations/mcp/${providerKey}/disconnect`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Disconnect failed.");
      }

      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Disconnect request failed.",
      });
    } finally {
      setDisconnectingProvider(null);
    }
  }

  async function handleInvoke(providerKey: string) {
    const toolName = toolNames[providerKey]?.trim();
    const rawArgs = toolArgs[providerKey]?.trim();

    if (!toolName) {
      setInvokeFeedback((current) => ({
        ...current,
        [providerKey]: {
          tone: "error",
          body: "Enter a tool name before invoking the provider.",
        },
      }));
      return;
    }

    let parsedArgs: Record<string, unknown> | undefined;
    if (rawArgs) {
      try {
        const candidate = JSON.parse(rawArgs) as unknown;
        if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
          throw new Error("Tool arguments must be a JSON object.");
        }
        parsedArgs = candidate as Record<string, unknown>;
      } catch (error) {
        setInvokeFeedback((current) => ({
          ...current,
          [providerKey]: {
            tone: "error",
            body:
              error instanceof Error
                ? error.message
                : "Tool arguments must be valid JSON.",
          },
        }));
        return;
      }
    }

    setInvokingProvider(providerKey);
    setInvokeFeedback((current) => ({ ...current, [providerKey]: undefined }));

    try {
      const response = await fetch(`/api/integrations/mcp/${providerKey}/invoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toolName,
          toolArgs: parsedArgs,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; result?: unknown }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Tool invocation failed.");
      }

      setInvokeFeedback((current) => ({
        ...current,
        [providerKey]: {
          tone: "success",
          body: JSON.stringify(payload?.result ?? null, null, 2),
        },
      }));
    } catch (error) {
      setInvokeFeedback((current) => ({
        ...current,
        [providerKey]: {
          tone: "error",
          body:
            error instanceof Error ? error.message : "Tool invocation failed.",
        },
      }));
    } finally {
      setInvokingProvider(null);
    }
  }

  return (
    <main className="min-h-svh overflow-y-auto bg-muted/30 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit">
            MCP Playground
          </Badge>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
              Test provider connections outside the planner UI
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
              This page is intentionally separate from the main ShelfChef app.
              Connect an MCP provider, inspect its current session state, and run
              direct tool calls against the existing integration routes.
            </p>
          </div>
          {notice ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                notice.tone === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {notice.message}
            </div>
          ) : null}
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          {providers.map((provider) => {
            const feedback = invokeFeedback[provider.key];

            return (
              <Card key={provider.key} className="border border-border/60 bg-background">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{provider.label}</CardTitle>
                      <CardDescription>{provider.mcpServerUrl}</CardDescription>
                    </div>
                    <Badge variant={provider.connected ? "default" : "outline"}>
                      {provider.connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>
                      <p className="font-medium text-foreground">Requested scopes</p>
                      <p>{provider.scopes.join(", ") || "Provider did not declare scopes"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Token state</p>
                      <p>{provider.connected ? formatTimestamp(provider.expiresAt) : "No token stored"}</p>
                    </div>
                  </div>

                  {provider.connected ? (
                    <div className="grid gap-1 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Granted scope:</span>{" "}
                        {provider.grantedScope ?? "Not returned by provider"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Token type:</span>{" "}
                        {provider.tokenType ?? "Unknown"}
                      </p>
                    </div>
                  ) : null}

                  {provider.connected ? (
                    <div className="space-y-3 rounded-xl border border-border/60 p-4">
                      <div className="space-y-1">
                        <h2 className="font-medium text-foreground">Invoke a tool</h2>
                        <p className="text-sm text-muted-foreground">
                          Send a direct request through the existing MCP invoke route.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${provider.key}-tool-name`}>Tool name</Label>
                        <Input
                          id={`${provider.key}-tool-name`}
                          value={toolNames[provider.key] ?? ""}
                          onChange={(event) =>
                            setToolNames((current) => ({
                              ...current,
                              [provider.key]: event.target.value,
                            }))
                          }
                          placeholder="search_pages"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${provider.key}-tool-args`}>
                          Tool arguments JSON
                        </Label>
                        <Textarea
                          id={`${provider.key}-tool-args`}
                          value={toolArgs[provider.key] ?? ""}
                          onChange={(event) =>
                            setToolArgs((current) => ({
                              ...current,
                              [provider.key]: event.target.value,
                            }))
                          }
                          placeholder='{"query":"release notes"}'
                          className="min-h-28 font-mono text-xs"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={() => void handleInvoke(provider.key)}
                        disabled={invokingProvider === provider.key}
                      >
                        {invokingProvider === provider.key ? "Invoking..." : "Invoke tool"}
                      </Button>

                      {feedback ? (
                        <pre
                          className={`overflow-x-auto rounded-xl border px-3 py-2 text-xs whitespace-pre-wrap ${
                            feedback.tone === "success"
                              ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                              : "border-destructive/30 bg-destructive/5 text-destructive"
                          }`}
                        >
                          {feedback.body}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>

                <CardFooter className="justify-between gap-3">
                  <a
                    href={`/api/integrations/mcp/${provider.key}/connect`}
                    className={buttonVariants({ variant: provider.connected ? "outline" : "default" })}
                  >
                    {provider.connected ? "Reconnect" : "Connect"}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleDisconnect(provider.key)}
                    disabled={!provider.connected || disconnectingProvider === provider.key}
                  >
                    {disconnectingProvider === provider.key ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}