/**
 * Token store for MCP provider OAuth connections.
 *
 * Persists OAuth connections and pending PKCE states to the database using
 * Prisma.  Tokens are encrypted at rest using AES-256-GCM via the
 * TOKEN_ENCRYPTION_KEY environment variable.
 *
 * See src/lib/mcp/encrypt.ts for the encryption implementation.
 */

import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "./encrypt";

// ---------------------------------------------------------------------------
// Schema types (provider-agnostic view of a stored connection)
// ---------------------------------------------------------------------------

export type OAuthConnection = {
  id: string;
  userId: string;
  providerKey: string;
  providerType: "mcp";
  resourceUri: string;
  /** Plain-text access token (decrypted on retrieval). */
  accessToken: string;
  /** Plain-text refresh token (decrypted on retrieval). */
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
  /** Plain-text PKCE verifier (decrypted on retrieval). */
  codeVerifier: string;
  state: string;
  redirectUri: string;
  resourceUri: string;
  createdAt: Date;
  expiresAt: Date;
};

// ---------------------------------------------------------------------------
// Connection CRUD
// ---------------------------------------------------------------------------

/** Upsert a completed OAuth connection for a user + provider pair. */
export async function upsertConnection(
  params: Omit<OAuthConnection, "id" | "createdAt" | "updatedAt">,
): Promise<OAuthConnection> {
  const record = await prisma.oAuthConnection.upsert({
    where: { userId_providerKey: { userId: params.userId, providerKey: params.providerKey } },
    update: {
      providerType: params.providerType,
      resourceUri: params.resourceUri,
      accessTokenEncrypted: encrypt(params.accessToken),
      refreshTokenEncrypted: params.refreshToken ? encrypt(params.refreshToken) : null,
      expiresAt: params.expiresAt ?? null,
      scope: params.scope ?? null,
      tokenType: params.tokenType ?? null,
    },
    create: {
      userId: params.userId,
      providerKey: params.providerKey,
      providerType: params.providerType,
      resourceUri: params.resourceUri,
      accessTokenEncrypted: encrypt(params.accessToken),
      refreshTokenEncrypted: params.refreshToken ? encrypt(params.refreshToken) : null,
      expiresAt: params.expiresAt ?? null,
      scope: params.scope ?? null,
      tokenType: params.tokenType ?? null,
    },
  });

  return dbRowToConnection(record);
}

/** Retrieve a connection for a user + provider pair. Returns `undefined` if not found. */
export async function getConnection(
  userId: string,
  providerKey: string,
): Promise<OAuthConnection | undefined> {
  const record = await prisma.oAuthConnection.findUnique({
    where: { userId_providerKey: { userId, providerKey } },
  });
  if (!record) return undefined;
  return dbRowToConnection(record);
}

/** List all connections for a user. */
export async function listConnections(userId: string): Promise<OAuthConnection[]> {
  const records = await prisma.oAuthConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return records.map(dbRowToConnection);
}

/** Remove a connection. Returns `true` if a record was deleted. */
export async function deleteConnection(
  userId: string,
  providerKey: string,
): Promise<boolean> {
  const deleted = await prisma.oAuthConnection
    .delete({ where: { userId_providerKey: { userId, providerKey } } })
    .catch(() => null);
  return deleted !== null;
}

// ---------------------------------------------------------------------------
// Pending-state CRUD
// ---------------------------------------------------------------------------

/** Persist a pending OAuth state (created at the start of the connect flow). */
export async function createPendingState(
  params: Omit<OAuthPendingState, "id" | "createdAt">,
): Promise<OAuthPendingState> {
  const record = await prisma.oAuthPendingState.create({
    data: {
      userId: params.userId,
      providerKey: params.providerKey,
      codeVerifierEncrypted: encrypt(params.codeVerifier),
      state: params.state,
      redirectUri: params.redirectUri,
      resourceUri: params.resourceUri,
      expiresAt: params.expiresAt,
    },
  });
  return dbRowToPendingState(record);
}

/** Retrieve and atomically remove a pending state by its `state` parameter. */
export async function consumePendingState(
  state: string,
): Promise<OAuthPendingState | undefined> {
  const record = await prisma.oAuthPendingState
    .delete({ where: { state } })
    .catch(() => null);

  if (!record) return undefined;

  // Reject states that have reached or passed their expiry time
  if (record.expiresAt <= new Date()) return undefined;

  return dbRowToPendingState(record);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

type DbConnection = {
  id: string;
  userId: string;
  providerKey: string;
  providerType: string;
  resourceUri: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
  scope: string | null;
  tokenType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function dbRowToConnection(row: DbConnection): OAuthConnection {
  return {
    id: row.id,
    userId: row.userId,
    providerKey: row.providerKey,
    providerType: "mcp",
    resourceUri: row.resourceUri,
    accessToken: decrypt(row.accessTokenEncrypted),
    refreshToken: row.refreshTokenEncrypted ? decrypt(row.refreshTokenEncrypted) : undefined,
    expiresAt: row.expiresAt ?? undefined,
    scope: row.scope ?? undefined,
    tokenType: row.tokenType ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type DbPendingState = {
  id: string;
  userId: string;
  providerKey: string;
  codeVerifierEncrypted: string;
  state: string;
  redirectUri: string;
  resourceUri: string;
  createdAt: Date;
  expiresAt: Date;
};

function dbRowToPendingState(row: DbPendingState): OAuthPendingState {
  return {
    id: row.id,
    userId: row.userId,
    providerKey: row.providerKey,
    codeVerifier: decrypt(row.codeVerifierEncrypted),
    state: row.state,
    redirectUri: row.redirectUri,
    resourceUri: row.resourceUri,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

