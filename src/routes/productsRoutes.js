const express = require('express');
const productsController = require('../controllers/productsController');

const router = express.Router();

router.get('/', productsController.list);
router.get('/:id', productsController.getById);

module.exports = router;
