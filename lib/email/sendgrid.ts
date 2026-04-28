const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

function getRequiredEnv(name: "SENDGRID_API_KEY" | "SENDGRID_FROM_EMAIL") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function sendHouseholdInviteEmail({
  to,
  householdName,
  inviteUrl,
  expiresAt,
}: {
  to: string;
  householdName: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const apiKey = getRequiredEnv("SENDGRID_API_KEY");
  const from = getRequiredEnv("SENDGRID_FROM_EMAIL");

  const response = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          subject: `You’ve been invited to join ${householdName} on ShelfChef`,
        },
      ],
      from: { email: from },
      content: [
        {
          type: "text/plain",
          value: [
            `You’ve been invited to join the ${householdName} household on ShelfChef.`,
            "",
            `Accept your invite: ${inviteUrl}`,
            "",
            `This link expires on ${expiresAt.toUTCString()} and can only be used once.`,
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid request failed (${response.status}): ${body}`);
  }
}
