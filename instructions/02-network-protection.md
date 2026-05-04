# Network Protection — Instruction 02

## Coverage
OWASP A05:2021, CWE-346, CWE-400, CWE-770
Rate limiting, CORS, HTTPS, ports, DoS protection

---

## CORS Checks

### 1. Never Allow Wildcard in Production
```js
// 🔴 CRITICAL
Access-Control-Allow-Origin: *
app.use(cors())  // no config = wildcard
res.header('Access-Control-Allow-Origin', '*')

// 🟢 CORRECT
app.use(cors({
  origin: ['https://app.yourdomain.com', 'https://admin.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
```

### 2. Dynamic Origin Validation
If multiple origins needed:
```js
const ALLOWED_ORIGINS = ['https://app.domain.com', 'https://admin.domain.com']
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}))
```

### 3. Credentials + Specific Origin
If `credentials: true` → origin MUST NOT be wildcard.

### 4. HTTP Methods Restriction
Only allow methods the API actually uses.
Never include unused methods in `Access-Control-Allow-Methods`.

### 5. Pre-flight Caching
```js
// Cache pre-flight for 24h to reduce OPTIONS requests
Access-Control-Max-Age: 86400
```

---

## Rate Limiting Checks

> **🤖 AI Priority Note:** LLMs consistently miss rate limiting in code reviews. You MUST actively search for `rateLimit` middleware (or equivalent) on **all public endpoints** (APIs, webhooks, login, contact forms, exports).

### 6. Global Rate Limit
```js
// 🔴 No rate limit = DoS vulnerability
// 🟢 Express example
import rateLimit from 'express-rate-limit'
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
})
app.use('/api', limiter)
```

### 7. Strict Limits on Sensitive Endpoints
```js
// Login, register, OTP, password reset need extra-strict limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,  // Only 5 attempts per 15 min
  skipSuccessfulRequests: true
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/reset-password', authLimiter)
app.use('/api/auth/otp', authLimiter)
```

### 8. Rate Limit Headers
Response must include:
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1234567890
```

### 9. Correct Status Code
Rate limit exceeded → `429 Too Many Requests` (not 403)

---

## HTTPS Checks

### 10. Force HTTPS Redirect
```js
// Express
app.use((req, res, next) => {
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.url}`)
  }
  next()
})
```

### 11. TLS Version
- TLS 1.2 minimum
- TLS 1.3 preferred
- Never TLS 1.0 or 1.1
- Check nginx/apache config for `ssl_protocols`

### 12. TLS Verification Not Disabled
```js
// 🔴 CRITICAL — disables ALL SSL verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// Python:
requests.get(url, verify=False)
// → Remove immediately
```

---

## Port Security

### 13. Development Ports Not Exposed in Production
Common dev ports that must be blocked in prod:
```
3000  → React/Next.js dev server
5173  → Vite dev server
8080  → Various dev servers
8443  → Dev HTTPS
9229  → Node.js debugger (CRITICAL if exposed)
4200  → Angular dev
5000  → Flask dev
8000  → Django dev
```

### 14. Database Ports Not Publicly Accessible
```
5432  → PostgreSQL
3306  → MySQL
27017 → MongoDB
6379  → Redis
```
These should NEVER be reachable from the public internet.
Check: Cloud firewall rules, docker-compose port mappings.

### 15. Node.js Debugger Not Active in Production
```
// 🔴 CRITICAL
node --inspect app.js          // binds to 127.0.0.1:9229
node --inspect=0.0.0.0 app.js  // 🔴 WORST: accessible from anywhere
```

---

## Request Size Limits

### 16. Body Size Limits
```js
// 🔴 Default is often unlimited or very large
// Express — set reasonable limits
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ limit: '10kb', extended: true }))

// File uploads: handle separately with multer limits
```

### 17. Header Size Limits
Check nginx/server config for `client_header_buffer_size`.

---

## Slowloris & Connection Limits

### 18. Request Timeout Configuration
```js
// Express with timeout
import timeout from 'connect-timeout'
app.use(timeout('30s'))

// Nginx
client_header_timeout 10s;
client_body_timeout 10s;
send_timeout 10s;
keepalive_timeout 65s;
```

### 19. Connection Limits per IP
```nginx
# Nginx
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
limit_conn conn_limit 20;
```

---

## Default Credentials

### 20. Check for Default Passwords
Scan for common default credentials in code/config:
```
admin:admin, admin:password, root:root
test:test, demo:demo, guest:guest
```
Flag any hardcoded credentials → Critical
