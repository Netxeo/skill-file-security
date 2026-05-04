# Auth & Sessions — Instruction 04

## Coverage
CWE-287, CWE-384, CWE-620, CWE-640, CWE-352, CWE-521
OWASP A07:2021, ASVS V2, V3

---

## Authentication Checks

### 1. Password Hashing
```js
// 🔴 NEVER
md5(password), sha1(password), sha256(password)
// 🟢 CORRECT
bcrypt.hash(password, 12)  // cost factor >= 12
argon2.hash(password)       // preferred in 2026
```

### 2. Password Policy (NIST 2026)
- Minimum **14 characters** (length > complexity)
- Block common passwords (top 10,000 list)
- Check against HaveIBeenPwned API (k-anonymity - private)
- Never enforce complex rules (uppercase + numbers + symbols) alone
- Password history: can't reuse last 5 passwords
- No masking in API responses: `user.password` never in JSON

### 3. Password Change Requires Current Password
```js
// 🔴 Missing: no currentPassword check
// 🟢 Always verify currentPassword before allowing change
if (!await bcrypt.compare(req.body.currentPassword, user.passwordHash)) {
  return res.status(401).json({ error: 'Current password is incorrect' })
}
```

### 4. Account Enumeration Prevention
```js
// 🔴 Reveals which email exists
if (!user) return res.json({ error: 'User not found' })
if (!valid) return res.json({ error: 'Wrong password' })

// 🟢 Same message always
return res.json({ error: 'Invalid email or password' })
// Same timing too (use constant-time comparison)
```

### 5. Brute Force Protection
- Rate limit: max 5 login attempts per 15 min per IP
- Progressive lockout after failures
- CAPTCHA after 3 failed attempts
- Account lockout after 10 consecutive failures
- Alert user of unusual login activity

### 6. Security Questions — Never Use
```
// 🔴 Security questions are guessable from social media
"What is your mother's maiden name?"
// 🟢 Use only: email link + MFA
```

---

## Session Management

### 7. Session ID Regeneration After Login (Session Fixation)
**Standard Case:** Regenerate upon initial login.
```js
// 🔴 Session fixation vulnerability
req.session.userId = user.id  // reuses pre-login session ID

// 🟢 Regenerate session ID after authentication
req.session.regenerate((err) => {
  req.session.userId = user.id
  res.redirect('/dashboard')
})
```

**Subtle Cases (ASVS Level 3 Focus):**
- **Privilege Escalation:** MUST regenerate session when switching roles (e.g., User → Admin), or when entering "sudo mode" (re-authentication).
- **OAuth Flows:** MUST regenerate session *before* starting the OAuth redirect, and *after* receiving the callback.
- **WebSocket:** Do NOT accept session IDs in WebSocket connection URLs (e.g., `ws://...?session=abc`); pass via secure cookies ONLY to prevent URL-based fixation.

### 8. Session Timeout
```js
// Inactivity timeout: 30 minutes (configurable)
// Absolute timeout: 8 hours max (even if active)
session({
  cookie: {
    maxAge: 30 * 60 * 1000,  // 30 min inactivity
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  },
  rolling: true  // reset on activity
})
```

### 9. Cookie Security Flags
```js
// All session/auth cookies must have:
{
  httpOnly: true,    // 🔴 Missing = XSS can steal token
  secure: true,      // 🔴 Missing = sent over HTTP
  sameSite: 'strict' // 🔴 Missing = CSRF possible
}

// Cookie prefixes (strongest protection)
__Host-session=abc  // bound to current host, no subdomains
__Secure-token=abc  // HTTPS only
```

### 10. Session Destruction on Logout
```js
// 🔴 Just deleting cookie is not enough
res.clearCookie('session')  // attacker can still use old session server-side

// 🟢 Destroy server-side session + clear cookie + clear storage
req.session.destroy()
res.clearCookie('session')
res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"')
```

### 11. Token in URL
```
// 🔴 Tokens in URLs get logged in server logs + referrer headers
/reset-password?token=abc123
/invite?key=secret-key

// 🟢 Tokens via POST body or Authorization header only
```

---

## CSRF Protection

### 12. CSRF Triple Defense
At least ONE of:
1. `SameSite=Strict` cookies (prevents most CSRF)
2. `Sec-Fetch-Site` header validation
3. Explicit CSRF token (double-submit cookie pattern)

```js
// CSRF token middleware
import csrf from 'csurf'
app.use(csrf({ cookie: { sameSite: 'strict', secure: true } }))
```

---

## OAuth & Social Login

### 13. State Parameter (Anti-CSRF)
```js
// 🔴 No state = CSRF on OAuth flow
/auth/callback?code=abc123

// 🟢 State must be random, verified server-side
const state = crypto.randomBytes(16).toString('hex')
req.session.oauthState = state
// Verify: req.query.state === req.session.oauthState
```

### 14. PKCE for Public Clients
```js
// Required for SPAs and mobile apps
const codeVerifier = generateCodeVerifier()
const codeChallenge = await generateCodeChallenge(codeVerifier)
// Send code_challenge in auth request
// Send code_verifier in token exchange
```

### 15. Redirect URI Validation
```js
// 🔴 Wildcard or broad redirect URIs
redirect_uri: 'https://myapp.com/*'

// 🟢 Exact match only
const ALLOWED_REDIRECTS = ['https://myapp.com/callback', 'https://myapp.com/auth']
if (!ALLOWED_REDIRECTS.includes(req.query.redirect_uri)) {
  return res.status(400).json({ error: 'Invalid redirect URI' })
}
```

---

## Password Reset Security

### 16. Reset Token Requirements
```js
// 🔴 Weak/missing requirements
const token = Math.random().toString(36)  // predictable!

// 🟢 All requirements:
const token = crypto.randomBytes(32).toString('hex')  // 256-bit entropy
// Store hash of token, not token itself
const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
// Expire in 15 minutes
const expiry = new Date(Date.now() + 15 * 60 * 1000)
// Single use: invalidate after use
// Bound to user: verify userId matches
// Invalidate on password change
```

### 17. Recovery Codes (MFA Backup)
```js
// 🔴 Stored in plaintext
// 🟢 Hashed with bcrypt before storage
// 🟢 Single use — invalidate after use
// 🟢 Generated with crypto.randomBytes()
// 🟢 Invalidated when new codes generated
```

---

## MFA/2FA Security

### 18. TOTP Implementation
```js
// 🔴 Wide time window = replay attack possible
totp.verify({ token, window: 10 })  // accepts codes from ±5 min ago

// 🟢 Standard window
totp.verify({ token, window: 1 })  // ±30 seconds only
// 🟢 Invalidate used tokens
// 🟢 Rate limit OTP attempts: max 3 per minute
// 🟢 Secret transmitted only once during setup
```

---

## WebAuthn / Passkeys

### 19. Implementation Checks
- Use established library (SimpleWebAuthn, etc.) — never implement manually
- `userVerification: 'required'` always
- `rpID` = exact domain (not too broad)
- Challenge: cryptographically random, single-use
- Verify attestation in high-security contexts
- Account recovery plan in place

---

## Password Masking in UI

```html
<!-- 🔴 Password visible -->
<input type="text" name="password">

<!-- 🟢 Always type="password" -->
<input type="password" name="password" autocomplete="current-password">
<input type="password" name="newPassword" autocomplete="new-password">
```
