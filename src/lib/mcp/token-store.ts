/**
 * Token store for MCP provider OAuth connections.
 *
 * This module defines:
 *  - The canonical DB schema types (OAuthConnection, OAuthPendingState)
 *  - A fully-typed in-memory implementation suitable for development/testing
 *
 * ----------------------------------------------------------------------------
 * PRODUCTION NOTE
 * ----------------------------------------------------------------------------
 * Replace the in-memory Maps below with real database queries.  Suggested
 * tables (Postgres / Prisma schema shown for reference):
 *
 *   model OAuthConnection {
 *     id                     String    @id @default(cuid())
 *     userId                 String
 *     providerKey            String
 *     providerType           String    @default("mcp")
 *     resourceUri            String
 *     accessTokenEncrypted   String
 *     refreshTokenEncrypted  String?
 *     expiresAt              DateTime?
 *     scope                  String?
 *     tokenType              String?
 *     createdAt              DateTime  @default(now())
 *     updatedAt              DateTime  @updatedAt
 *     @@unique([userId, providerKey])
 *   }
 *
 *   model OAuthPendingState {
 *     id                    String   @id @default(cuid())
 *     userId                String
 *     providerKey           String
 *     codeVerifierEncrypted String
 *     state                 String   @unique
 *     redirectUri           String
 *     resourceUri           String
 *     createdAt             DateTime @default(now())
 *     expiresAt             DateTime
 *   }
 *
 * Tokens should be encrypted at rest (e.g. AES-GCM with a server-side key).
 * ----------------------------------------------------------------------------
 */

import { generateId } from "@/lib/id";

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export type OAuthConnection = {
  id: string;
  userId: string;
  providerKey: string;
  providerType: "mcp";
  resourceUri: string;
  /** Plain-text access token.  Encrypt before persisting to a real DB. */
  accessToken: string;
  /** Plain-text refresh token.  Encrypt before persisting to a real DB. */
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OAuthPendingState = {
  id: string;
  userId: string;
  providerKey: string;
  /** Plain-text PKCE verifier.  Encrypt before persisting to a real DB. */
  codeVerifier: string;
  state: string;
  redirectUri: string;
  resourceUri: string;
  createdAt: Date;
  expiresAt: Date;
};

// ---------------------------------------------------------------------------
// In-memory store (swap out for DB calls in production)
// ---------------------------------------------------------------------------

// Key: `${userId}:${providerKey}`
const connections = new Map<string, OAuthConnection>();

// Key: state parameter value
const pendingStates = new Map<string, OAuthPendingState>();

// ---------------------------------------------------------------------------
// Connection CRUD
// ---------------------------------------------------------------------------

/** Upsert a completed OAuth connection for a user + provider pair. */
export function upsertConnection(
  params: Omit<OAuthConnection, "id" | "createdAt" | "updatedAt">,
): OAuthConnection {
  const mapKey = `${params.userId}:${params.providerKey}`;
  const existing = connections.get(mapKey);
  const now = new Date();

  const record: OAuthConnection = {
    id: existing?.id ?? generateId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...params,
  };

  connections.set(mapKey, record);
  return record;
}

/** Retrieve a connection for a user + provider pair.  Returns `undefined` if not found. */
export function getConnection(
  userId: string,
  providerKey: string,
): OAuthConnection | undefined {
  return connections.get(`${userId}:${providerKey}`);
}

/** List all connections for a user. */
export function listConnections(userId: string): OAuthConnection[] {
  return [...connections.values()].filter((c) => c.userId === userId);
}

/** Remove a connection. Returns `true` if a record was deleted. */
export function deleteConnection(userId: string, providerKey: string): boolean {
  return connections.delete(`${userId}:${providerKey}`);
}

// ---------------------------------------------------------------------------
// Pending-state CRUD
// ---------------------------------------------------------------------------

/** Persist a pending OAuth state (created at the start of the connect flow). */
export function createPendingState(
  params: Omit<OAuthPendingState, "id" | "createdAt">,
): OAuthPendingState {
  const now = new Date();
  const record: OAuthPendingState = {
    id: generateId(),
    createdAt: now,
    ...params,
  };
  pendingStates.set(params.state, record);
  return record;
}

/** Retrieve and atomically remove a pending state by its `state` parameter. */
export function consumePendingState(
  state: string,
): OAuthPendingState | undefined {
  const record = pendingStates.get(state);
  if (!record) return undefined;
  pendingStates.delete(state);

  // Reject states that have reached or passed their expiry time
  if (record.expiresAt <= new Date()) return undefined;

  return record;
}
