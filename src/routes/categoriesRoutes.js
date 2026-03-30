const express = require('express');
const categoriesController = require('../controllers/categoriesController');

const router = express.Router();

router.get('/', categoriesController.list);
router.get('/:slug/products', categoriesController.getProducts); // must be BEFORE /:slug
router.get('/:slug', categoriesController.getBySlug);

module.exports = router;