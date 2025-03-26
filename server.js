// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const locationsRoutes = require('./routes/locationsRoutes'); // Add this line

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://your-production-domain.com']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/categories', require('./routes/categoriesRoutes'));
app.use('/api/category-details', require('./routes/categoryDetailsRoutes'));

// Other routes...
app.use('/api/controls', (req, res) => {
    res.json({ message: 'Controls API - Coming soon' });
});

app.use('/api/documents', (req, res) => {
    res.json({ message: 'Documents API - Coming soon' });
});

app.use('/api/reports', (req, res) => {
    res.json({ message: 'Reports API - Coming soon' });
});

// Add test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});