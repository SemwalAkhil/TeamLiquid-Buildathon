import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import pg from 'pg';
import crypto from 'node:crypto';

const app = Fastify({ logger: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const domain = process.env.EMAIL_DOMAIN || 'phonemail.local';
const otpStore = new Map();
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'development-secret' });

const emailFor = phone => `${phone.replace(/\D/g, '')}@${domain}`;
const tokenFor = user => app.jwt.sign({ id: user.id, phone: user.phone_number, email: user.email_address }, { expiresIn: '8h' });
const auth = async request => { await request.jwtVerify(); };

app.get('/health', async () => ({ status: 'ok', service: 'phonemail-api' }));
app.post('/api/auth/register', async (request, reply) => {
  const { phone } = request.body || {};
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(normalized)) return reply.code(400).send({ message: 'Enter a valid phone number.' });
  // Registration never authenticates a caller. Ownership is established only by verify-otp.
  return reply.code(202).send({ message: 'Verify the OTP sent to this phone number to finish registration.', phone: normalized, email: emailFor(normalized) });
});
app.post('/api/auth/request-otp', async (request, reply) => {
  const phone = String(request.body?.phone || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(phone)) return reply.code(400).send({ message: 'Enter a valid phone number.' });
  const otp = process.env.NODE_ENV === 'production' ? String(Math.floor(100000 + Math.random() * 900000)) : '123456';
  otpStore.set(phone, { hash: crypto.createHash('sha256').update(otp).digest('hex'), expires: Date.now() + 5 * 60_000, attempts: 0 });
  return { message: 'OTP sent. Use 123456 in local demo mode.', demoOtp: process.env.NODE_ENV === 'production' ? undefined : otp };
});
app.post('/api/auth/verify-otp', async (request, reply) => {
  const phone = String(request.body?.phone || '').replace(/\D/g, ''); const otp = String(request.body?.otp || ''); const session = otpStore.get(phone);
  if (!session || session.expires < Date.now() || session.attempts >= 5) return reply.code(400).send({ message: 'OTP expired. Request a new code.' });
  session.attempts++;
  if (session.hash !== crypto.createHash('sha256').update(otp).digest('hex')) return reply.code(400).send({ message: 'That code is not correct.' });
  let result = await pool.query('SELECT * FROM users WHERE phone_number=$1', [phone]);
  if (!result.rows[0]) result = await pool.query('INSERT INTO users (phone_number,email_address) VALUES ($1,$2) RETURNING *', [phone, emailFor(phone)]);
  otpStore.delete(phone); const user = result.rows[0];
  return { user: { phone: user.phone_number, email: user.email_address, name: user.name }, token: tokenFor(user) };
});
app.get('/api/users/me', { preHandler: auth }, async request => ({ phone: request.user.phone, email: request.user.email }));
app.get('/api/emails', { preHandler: auth }, async request => {
  const result = await pool.query(`SELECT e.*, COALESCE(json_agg(json_build_object('recipient',r.recipient,'type',r.type)) FILTER (WHERE r.id IS NOT NULL AND (e.sender=$1 OR r.type <> 'BCC')),'[]') recipients FROM emails e LEFT JOIN email_recipients r ON r.email_id=e.id WHERE e.sender=$1 OR EXISTS (SELECT 1 FROM email_recipients x WHERE x.email_id=e.id AND x.recipient=$1) GROUP BY e.id ORDER BY e.created_at DESC`, [request.user.email]);
  return result.rows;
});
app.post('/api/emails', { preHandler: auth }, async (request, reply) => {
  const { to = [], cc = [], bcc = [], subject, body, replyTo } = request.body || {};
  const recipients = [...to, ...cc, ...bcc].map(x => String(x).trim()).filter(Boolean);
  if (!recipients.length || !subject?.trim() || !body?.trim()) return reply.code(400).send({ message: 'To, subject, and message are required.' });
  const threadKey = replyTo || [...[request.user.email, recipients[0]]].sort().join('|'); const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const saved = await pool.query('INSERT INTO emails (message_id,sender,subject,body,folder,thread_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [messageId, request.user.email, subject.trim(), body.trim(), 'sent', threadKey]);
  const types = [[to,'TO'],[cc,'CC'],[bcc,'BCC']];
  for (const [list, type] of types) for (const recipient of list) if (String(recipient).trim()) await pool.query('INSERT INTO email_recipients (email_id,recipient,type) VALUES ($1,$2,$3)', [saved.rows[0].id, String(recipient).trim(), type]);
  return reply.code(201).send(saved.rows[0]);
});
app.patch('/api/emails/:id/read', { preHandler: auth }, async (request, reply) => {
  const result = await pool.query(`UPDATE emails e SET is_read=true WHERE e.id=$1 AND (e.sender=$2 OR EXISTS (SELECT 1 FROM email_recipients r WHERE r.email_id=e.id AND r.recipient=$2)) RETURNING e.id`, [request.params.id, request.user.email]);
  if (!result.rowCount) return reply.code(404).send({ message: 'Email not found.' });
  return { ok: true };
});
app.post('/api/twilio/sms', async request => { const phone = String(request.body?.From || '').replace(/\D/g, ''); if (phone) await pool.query('INSERT INTO users (phone_number,email_address) VALUES ($1,$2) ON CONFLICT DO NOTHING', [phone, emailFor(phone)]); return '<Response><Message>Your PhoneMail account is ready.</Message></Response>'; });
app.post('/api/twilio/voice', async () => '<Response><Gather numDigits="1"><Say>Welcome to PhoneMail. Press 1 to create your phone email account.</Say></Gather></Response>');

app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' });
