const express = require('express');
const citiesController = require('../controllers/citiesController');

const router = express.Router();

router.get('/', citiesController.list);
router.get('/:id', citiesController.getById);

module.exports = router;
