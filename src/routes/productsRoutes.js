const express = require('express');
const productsController = require('../controllers/productsController');

const router = express.Router();

// Specific routes first - before parameterized routes to prevent conflicts

// Search endpoints
router.get('/search/suggestions', productsController.getSuggestions);
router.get('/search', productsController.search);

// Filters
router.get('/filters', productsController.getFilters);

// Similar products (before :id to catch /similar specifically)
router.get('/:id/similar', productsController.getSimilar);

// Slug-based fetch
router.get('/by-slug/:slug', productsController.getBySlug);

// General list and ID-based fetch (parameterized routes last)
router.get('/', productsController.list);
router.get('/:id', productsController.getById);

module.exports = router;
