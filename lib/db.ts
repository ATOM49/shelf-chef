import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}

/**
 * Normalize the DATABASE_URL so that deprecated SSL modes ('prefer',
 * 'require', 'verify-ca') are replaced with 'verify-full'.  This avoids the
 * pg-connection-string security warning while preserving the same strong SSL
 * behaviour that these modes currently enforce.
 *
 * See: https://node-postgres.com/announcements and the issue that prompted
 * this change for background on the upcoming pg v9 / pg-connection-string v3
 * semantic shift.
 */
function normalizeConnectionString(url: string): string {
	return url.replace(
		/([?&]sslmode=)(prefer|require|verify-ca)(\b|&|$)/g,
		(_, prefix, _mode, suffix) => `${prefix}verify-full${suffix}`,
	);
}

const connectionString = normalizeConnectionString(process.env.DATABASE_URL);

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter: new PrismaPg({
			connectionString,
		}),
	});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
