# 1StopMandi Backend

B2B food supply platform API – Node, Express, PostgreSQL (NeonDB).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env and add your NeonDB DATABASE_URL
   ```

3. **Run migrations**

   ```bash
   npm run migrate
   ```

4. **Seed data** (cities, categories)

   ```bash
   npm run seed
   ```

5. **Start server**

   ```bash
   npm run dev    # development with watch
   npm start      # production
   ```

## Project structure

```
src/
├── index.js           # App entry, routes
├── routes/            # Route handlers
├── controllers/       # Request handlers
├── services/          # Business logic
├── middleware/        # Auth, error handler, etc.
├── db/
│   ├── index.js       # NeonDB pool
│   ├── migrate.js     # Migration runner
│   ├── seed.js        # Seed runner
│   ├── migrations/    # SQL migrations
│   └── seeds/         # Seed SQL
└── utils/             # Helpers (jwt, etc.)
```

## API

- `GET /health` – Health check
- `POST /api/auth/send-otp` – Send OTP to phone
- `POST /api/auth/verify-otp` – Verify OTP, get JWT
- `GET /api/auth/me` – Current user (auth required)
- `POST /api/auth/logout` – Logout
- `PATCH /api/auth/me` – Update name (auth required)
- `GET /api/cities` – List cities
- `GET /api/cities/:id` – Get city by id
- `GET /api/categories` – List categories (optional: ?city_id=, ?city_slug=)
- `GET /api/categories/:id` – Get category by id
- `GET /api/setup/status` – Setup status (auth)
- `POST /api/setup/step1` – Outlet details (auth)
- `POST /api/setup/step2` – GST/FSSAI (auth)
- `POST /api/setup/complete` – Complete setup (auth)
- `GET /api/products` – List products (?category_id=, ?city_id=, ?page=, ?limit=)
- `GET /api/products/:id` – Get product by id
- `GET /api/cart` – Get cart (auth + setup)
- `POST /api/cart/items` – Add/update item (auth + setup)
- `DELETE /api/cart/items/:productId` – Remove item (auth + setup)
- `POST /api/cart/clear` – Clear cart (auth + setup)
- `POST /api/orders` – Create order from cart (auth + setup). Optional body: `{ saved_list_id }` or `{ uploaded_order_id }` for source tracking
- `GET /api/orders` – List orders (auth + setup)
- `GET /api/orders/:id` – Get order by id (auth + setup)
- `GET /api/orders/last` – Get last order (auth + setup)
- `POST /api/orders/last/add-to-cart` – Repeat last order into cart (auth + setup)
- `GET /api/saved-lists` – List saved lists (auth + setup)
- `POST /api/saved-lists` – Create list (auth + setup)
- `GET /api/saved-lists/:id` – Get list with items (auth + setup)
- `POST /api/saved-lists/:id/items` – Add item (auth + setup)
- `PATCH /api/saved-lists/:id/items/:itemId` – Update qty (auth + setup)
- `DELETE /api/saved-lists/:id/items/:itemId` – Remove item (auth + setup)
- `POST /api/saved-lists/:id/order-all` – Add all to cart (auth + setup, ?merge=true to merge)
- `POST /api/uploaded-orders` – Upload order image (auth + setup)
- `GET /api/uploaded-orders` – List uploads (auth + setup)
- `GET /api/uploaded-orders/:id` – Get upload detail (auth + setup)
- `POST /api/uploaded-orders/:id/add-to-cart` – Add to cart when ready (auth + setup)
- `GET /api/admin/uploaded-orders` – List pending (admin)
- `PATCH /api/admin/uploaded-orders/:id/ready` – Mark ready + set items (admin)
- `PATCH /api/admin/uploaded-orders/:id/rejected` – Reject (admin)
- `GET /api/admin/users` – List users (?search=, ?page=, ?limit=) (admin)
- `PATCH /api/admin/users/:id/role` – Set role (body: `{ role: "admin" }`) (admin)

## SMS (OTP)

- **Mock** (default): OTP logged to console. Set `SMS_PROVIDER=mock`
- **Twilio**: Real SMS. Set `SMS_PROVIDER=twilio` and add:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER` (your Twilio number, e.g. +1234567890)

---

## Admin Users

- **First admin:** User logs in via OTP first, then run:
  ```bash
  npm run promote-admin -- 919876543210
  ```
- **Promote via API:** An existing admin can `PATCH /api/admin/users/:id/role` with `{ role: "admin" }`
- **Roles:** `buyer` (default), `admin`

---

## Specs

- [AUTH-LOGIN-SPEC](../docs/AUTH-LOGIN-SPEC.md)
- [CITIES-CATEGORIES-SPEC](../docs/CITIES-CATEGORIES-SPEC.md)
