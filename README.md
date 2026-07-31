# Bottled Bloom API

A Node.js/TypeScript/Express backend for an online fragrance (perfume) store — with product catalog, cart, checkout, order tracking, driver delivery management, real-time notifications, and admin analytics.

## Tech Stack

- **Runtime / Framework:** Node.js, Express, TypeScript
- **Database:** MongoDB with Mongoose
- **Validation:** Zod
- **Auth:** JWT (with OTP-based 2-factor login), bcryptjs password hashing
- **Real-time:** Socket.IO (cookie-based JWT handshake auth)
- **Uploads:** Multer (disk storage) + `file-type` signature verification
- **Email:** Nodemailer (Gmail transport)
- **Security middleware:** Helmet, CORS, `express-mongo-sanitize`, `express-rate-limit`, custom CSRF origin check

## Features

### Auth & Accounts

- Registration with strong password rules (Zod-enforced complexity)
- Login is two-step: password check → email OTP → session JWT
- Account lockout after repeated failed password attempts, separate lockout for OTP attempts
- Generic error responses across login/reset flows to prevent user-enumeration, plus dummy-hash comparisons to keep response timing constant
- Password reset via emailed 6-digit code
- Profile update, image upload, FCM token storage, account deletion (password-confirmed)
- `tokenVersion` invalidation — password changes / role changes immediately invalidate old JWTs

### Products

- Full CRUD (admin-only create/update/delete/restock)
- Text search (weighted Mongo text index on name/category) with regex category filter
- Recently added / trending (by sales) / most popular (by views) / top rated listings
- Ratings, comments, and favorites per user
- Image upload with MIME allow-list + file-signature verification, and cleanup of orphaned files on update/delete

### Cart & Checkout

- Per-user cart (get-or-create), add/update/remove items, clear cart
- Checkout creates an immutable order snapshot (name/price/image at time of purchase) inside a MongoDB transaction, decrements stock atomically, and clears the cart

### Orders & Delivery

- User order history, order lookup with ownership/role checks
- Admin order listing with search + tab filters (paid/unpaid/status/open/closed)
- Admin status updates, driver assignment
- Driver-side status updates (`shipped` → `delivered`) inside a transaction, with product `totalSold`/`totalRevenue` updates on delivery
- Order cancellation (pending-only) restocks products

### Notifications

- Persisted notification records (driver assigned, order shipped/delivered, product added, system)
- Delivered in real time over Socket.IO to the recipient's room
- Falls back to FCM push notification when the user is offline

### Admin Analytics

- KPIs (revenue, order count, AOV, unique customers) over a date range
- Earnings grouped daily/weekly/monthly
- Revenue share by category
- Top products by revenue, top viewed products
- Driver performance stats (assigned/delivered/shipped/cancelled, delivery rate)

## Project Structure

```
src/
├── app.ts                     # Express app: middleware, routes, error handler
├── index.ts                   # Server bootstrap (HTTP + Socket.IO)
├── config/                    # Env config, email transport, socket setup, safe-user serializer
├── database/                  # Mongo connection
├── models/                    # Mongoose schemas (User, Product, Cart, Order, Notification)
├── types/                     # Zod schemas / inferred types
├── dtos/                      # Request validation DTOs (Zod)
├── repositories/               # Data-access layer per domain (+ admin/ subfolder)
├── services/                  # Business logic (+ admin/ subfolder)
├── controllers/                # Request handlers (+ admin/ subfolder)
├── routes/                    # Express routers (+ admin/ subfolder)
├── middleware/                # Auth, admin/driver guards, rate limiting, uploads, CSRF
├── utils/                     # Helpers: params, regex escaping, file cleanup, image verification
└── errors/                    # HttpError class
```

## Getting Started

### Prerequisites

- Node.js (LTS)
- MongoDB instance (local or hosted)
- A Gmail account + app password (for `nodemailer`), or swap the transport in `src/config/email.ts`

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/bottled-bloom
JWT_SECRET=replace-with-a-long-random-secret

EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASSWORD=your-gmail-app-password

# Number of reverse-proxy hops in front of this server (0 for local dev)
TRUST_PROXY=0
```

> `JWT_SECRET` and `MONGODB_URI` have insecure local fallbacks in `src/config/index.ts` — always set real values outside of local development. `EMAIL_USER`/`EMAIL_PASSWORD` are required and will throw on startup if missing.

### Run

```bash
npm run dev     # development (adjust to your actual script name)
npm run build   # compile TypeScript
npm start        # run compiled output
```

## API Overview

All routes are mounted under `/api`.

| Base path              | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `/api/auth`            | Register, login (+ OTP verify), profile, password reset, FCM token |
| `/api/products`        | Catalog browse/search, ratings, favorites, comments, admin CRUD    |
| `/api/cart`            | Cart items (auth required)                                         |
| `/api/orders`          | Checkout, order history, admin management, driver status updates   |
| `/api/driver`          | Driver status, assigned-order status, driver stats                 |
| `/api/notifications`   | User notification inbox, admin/system notification creation        |
| `/api/admin/users`     | Admin user management                                              |
| `/api/admin/analytics` | KPIs, earnings, category share, top products, driver analytics     |

Most routes require a `Bearer` JWT (`authorizedMiddleware`); admin- and driver-only routes are further gated by `adminMiddleware` / `driverMiddleware`.

## Security Notes

- Passwords hashed with bcrypt; login/reset flows use constant-time-style dummy comparisons and uniform error messages to resist enumeration and timing attacks
- Login requires email OTP as a second factor before a session token is issued
- Separate lockout counters for password attempts vs. OTP attempts
- JWTs carry a `tokenVersion`; it's bumped on password change, invalidating older tokens
- Uploaded images are MIME-checked and signature-verified before being trusted
- NoSQL injection sanitization on body/params/query; CSRF origin allow-list on unsafe methods
- Helmet CSP, rate limiting (global + endpoint-specific), and `trust proxy` is env-configurable rather than blindly trusting `X-Forwarded-For`

## License
