const express = require('express');
const canteenRoutes = require('./canteen');

const app = express();
app.use(express.json());
app.use('/api/canteen', canteenRoutes);

module.exports = app;
