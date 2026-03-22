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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`1StopMandi API running on http://localhost:${PORT}`);
});
