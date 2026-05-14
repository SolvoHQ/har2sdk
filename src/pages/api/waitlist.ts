import type { APIRoute } from 'astro';
import { getClientIp } from '@/lib/rateLimit';
import { waitlistRateLimit } from '@/lib/waitlistRateLimit';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const methodNotAllowed: APIRoute = () =>
  Response.json({ error: 'Method Not Allowed — POST only.' }, {
    status: 405,
    headers: { allow: 'POST' },
  });

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request.headers);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: 'Invalid email.' }, { status: 400 });
  }

  const rl = waitlistRateLimit(ip);
  if (!rl.ok) {
    const mins = Math.ceil(rl.resetIn / 60000);
    return Response.json(
      { error: `Rate limit hit (5/hr). Try again in ~${mins} min.` },
      { status: 429 },
    );
  }

  const ts = new Date().toISOString();
  const ua = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';
  // Persist-as-log: always emit a structured line, regardless of whether
  // Resend below succeeds. The catch-all alias is the primary persistence,
  // this log line is the fallback that survives a Resend outage.
  console.log(
    `[waitlist] email=${email} ip=${ip} ts=${ts} ua=${JSON.stringify(ua)} referer=${JSON.stringify(referer)}`,
  );

  const apiKey = process.env.RESEND_API_KEY;
  const notificationText = [
    `email: ${email}`,
    `timestamp: ${ts}`,
    `ip: ${ip}`,
    `user-agent: ${ua}`,
    `referer: ${referer}`,
  ].join('\n');

  // Best-effort: inbound notification to the catch-all alias. Failure here
  // does NOT fail the request — the console.log above is the durable record.
  if (apiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: 'waitlist@west0n.top',
          to: ['agent+wl-har2sdk@west0n.top'],
          subject: `har2sdk waitlist: ${email}`,
          text: notificationText,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(
          `waitlist notification non-2xx (${res.status}): ${detail.slice(0, 200)}`,
        );
      }
    } catch (e: any) {
      console.error('waitlist notification threw:', e?.message || e);
    }

    // Auto-reply to the user — isolated try/catch, never propagates. The
    // user-facing reply is a best-effort "personal touch" that also seeds
    // Q3 reply-thread evidence; it must NEVER fail the request.
    try {
      const replyText = [
        'Hi,',
        '',
        "Thanks for joining the har2sdk waitlist — you're in line for v1.1+ (more auth patterns, richer type inference, pagination detection, opt-in error-schema synthesis).",
        '',
        "Quick favor: what API are you trying to wrap right now? Just hit reply with the name (or a sanitized HAR snippet) and I'll prioritize that shape when v1.1 ships. Privacy-paranoid welcome — we already scrub Bearer / JWT / API keys client-side before upload.",
        '',
        '— har2sdk',
      ].join('\n');
      const replyRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: 'har2sdk@west0n.top',
          to: [email],
          subject: 'Welcome to har2sdk — quick question',
          text: replyText,
        }),
      });
      if (!replyRes.ok) {
        const detail = await replyRes.text().catch(() => '');
        console.error(
          `waitlist auto-reply non-2xx (${replyRes.status}): ${detail.slice(0, 200)}`,
        );
      }
    } catch (e: any) {
      console.error('waitlist auto-reply threw:', e?.message || e);
    }
  } else {
    console.error('waitlist: RESEND_API_KEY missing — signup logged only, no email sent');
  }

  return Response.json(
    { ok: true },
    { headers: { 'x-ratelimit-remaining': String(rl.remaining) } },
  );
};
