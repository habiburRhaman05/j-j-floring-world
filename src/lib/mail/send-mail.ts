import "server-only";

/* ==========================================================================
   send-mail.ts  -  stubbed transactional email
   --------------------------------------------------------------------------
   Invite and password-reset flows are built for real end to end; only the
   "actually send it" step is stubbed, per the current decision to defer
   picking an email provider. Every call is logged to the server console with
   the link a real email would contain, so the flow is fully testable today.

   To go live: install a provider SDK (e.g. `npm install resend`), uncomment
   the block below, set the matching env vars in .env, and delete the console
   branch. Nothing at any call site changes.
   ========================================================================== */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  // --- Real provider (commented out until one is chosen) ------------------
  // import { Resend } from "resend";
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: process.env.MAIL_FROM ?? "no-reply@jjflooringworld.com",
  //   to: message.to,
  //   subject: message.subject,
  //   text: message.text,
  // });
  // --------------------------------------------------------------------------

  console.log(
    `\n[stub email] to=${message.to} subject="${message.subject}"\n${message.text}\n`,
  );
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
