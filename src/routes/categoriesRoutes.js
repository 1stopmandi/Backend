const express = require('express');
const categoriesController = require('../controllers/categoriesController');

const router = express.Router();

router.get('/', categoriesController.list);
router.get('/:id', categoriesController.getById);

module.exports = router;
