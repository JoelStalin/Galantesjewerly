import { sendTransactionalMail } from '@/lib/mailer';
import { getPublicBaseUrl, resolveGoogleEnvironmentFromHost } from '@/lib/google-login';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCustomerVerificationUrl(request: Request, token: string) {
  const baseUrl = getPublicBaseUrl(request);
  return `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendCustomerVerificationEmail(input: {
  request: Request;
  email: string;
  name: string;
  token: string;
}) {
  const host = input.request.headers.get('host') || '';
  const environment = resolveGoogleEnvironmentFromHost(host);
  const verificationUrl = buildCustomerVerificationUrl(input.request, input.token);
  const safeName = escapeHtml(input.name || 'there');
  const safeUrl = escapeHtml(verificationUrl);
  const subject = 'Verify your Galantes Jewelry account';
  const text = [
    `Hello ${input.name || 'there'},`,
    '',
    'Verify your Galantes Jewelry account by opening the link below:',
    verificationUrl,
    '',
    'If you did not create this account, you can ignore this email.',
  ].join('\n');
  const html = [
    `<p>Hello ${safeName},</p>`,
    '<p>Verify your Galantes Jewelry account by clicking the link below:</p>',
    `<p><a href="${safeUrl}">Verify my account</a></p>`,
    `<p>If the button does not work, copy and paste this URL into your browser:</p>`,
    `<p>${safeUrl}</p>`,
    '<p>If you did not create this account, you can ignore this email.</p>',
  ].join('');

  return sendTransactionalMail({
    environment,
    to: input.email,
    subject,
    text,
    html,
  });
}
