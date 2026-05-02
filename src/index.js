require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const citiesRoutes = require('./routes/citiesRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const setupRoutes = require('./routes/setupRoutes');
const productsRoutes = require('./routes/productsRoutes');
const cartRoutes = require('./routes/cartRoutes');
const ordersRoutes = require('./routes/ordersRoutes');
const savedListsRoutes = require('./routes/savedListsRoutes');
const uploadedOrdersRoutes = require('./routes/uploadedOrdersRoutes');
const adminUploadedOrdersRoutes = require('./routes/adminUploadedOrdersRoutes');
const adminUsersRoutes = require('./routes/adminUsersRoutes');
const adminPricingRoutes = require('./routes/adminPricingRoutes');
const adminOrdersRoutes = require('./routes/adminOrdersRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const paymentsRoutes = require('./routes/paymentsRoutes');
const billingRoutes = require('./routes/billingRoutes');
const notificationPrefsRoutes = require('./routes/notificationPrefsRoutes');
const productRequestsRoutes = require('./routes/productRequestsRoutes');
const { initializeCleanupCron } = require('./scripts/cleanup-expired-reservations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// ─────────────────────────────────────────────────────────────────────
// ORDER MATTERS — /api/payments must be mounted BEFORE express.json()
// because POST /api/payments/webhook needs a raw Buffer body for Cashfree
// webhook signature verification. A startup assertion below enforces this.
// ─────────────────────────────────────────────────────────────────────
app.use('/api/payments', paymentsRoutes);
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/saved-lists', savedListsRoutes);
app.use('/api/uploaded-orders', uploadedOrdersRoutes);
app.use('/api/admin/uploaded-orders', adminUploadedOrdersRoutes);
app.use('/api/admin', adminPricingRoutes);
app.use('/api/admin', adminOrdersRoutes);
app.use('/api/admin', adminUsersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/account/notifications', notificationPrefsRoutes);
app.use('/api/product-requests', productRequestsRoutes);

app.use(errorHandler);

// Startup assertion: verify /api/payments is mounted before the JSON parser.
// This fails loudly at boot rather than silently at runtime.
(() => {
  const layers = app._router.stack;
  const jsonIdx = layers.findIndex((l) => l.handle?.name === 'jsonParser');
  const payIdx = layers.findIndex((l) => l.regexp?.toString().includes('payments'));
  if (jsonIdx !== -1 && payIdx !== -1 && payIdx > jsonIdx) {
    throw new Error('FATAL: /api/payments must be mounted before express.json(). See paymentsRoutes.js.');
  }
})();

app.listen(PORT, () => {
  console.log(`1StopMandi API running on http://localhost:${PORT}`);
  // Initialize stock reservation cleanup cron job
  initializeCleanupCron();
});
