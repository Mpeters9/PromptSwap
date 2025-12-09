// lib/email.ts
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM || "PromptSwap <no-reply@example.com>";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const resend =
  resendApiKey && resendApiKey.trim().length > 0
    ? new Resend(resendApiKey)
    : null;

type CreatorSaleEmailParams = {
  to: string;
  creatorName?: string | null;
  promptTitle: string;
  amount: number;
  buyerEmail?: string | null;
};

export async function sendCreatorSaleEmail({
  to,
  creatorName,
  promptTitle,
  amount,
  buyerEmail,
}: CreatorSaleEmailParams): Promise<void> {
  if (!resend) {
    console.warn("Resend not configured. Skipping sale email.");
    return;
  }

  const displayName = creatorName || "creator";
  const formattedAmount = `$${amount.toFixed(2)}`;

  const subject = `You sold "${promptTitle}" on PromptSwap`;

  const buyerText = buyerEmail
    ? `Buyer: ${buyerEmail}\n`
    : "";

  const text = [
    `Hi ${displayName},`,
    "",
    `Good news! You just made a sale on PromptSwap.`,
    "",
    `Prompt: ${promptTitle}`,
    `Amount: ${formattedAmount}`,
    buyerText,
    "",
    `You can view your analytics here: ${siteUrl}/creator/analytics`,
    "",
    `Thanks for using PromptSwap!`,
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
      <p>Hi ${displayName},</p>
      <p>Good news! You just made a sale on <strong>PromptSwap</strong>.</p>
      <ul>
        <li><strong>Prompt:</strong> ${escapeHtml(promptTitle)}</li>
        <li><strong>Amount:</strong> ${formattedAmount}</li>
        ${
          buyerEmail
            ? `<li><strong>Buyer:</strong> ${escapeHtml(buyerEmail)}</li>`
            : ""
        }
      </ul>
      <p>
        You can view your analytics and more details in your creator dashboard:<br />
        <a href="${siteUrl}/creator/analytics" style="color: #0f172a; text-decoration: underline;">View analytics</a>
      </p>
      <p>Thanks for using PromptSwap!</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Failed to send sale email:", err);
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
