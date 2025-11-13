// Import required packages
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const mongoose = require('mongoose'); 

// Initialize Express app
const app = express();
const PORT = 3000;

// Import routes
const adminRoutes = require('./routes/adminRoutes');

// Connect to database
const dbURI = 'mongodb://127.0.0.1:27017/ccs-airlines';
const connectDB = async () => {
  try {
    await mongoose.connect(dbURI);
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

connectDB();

// Set up Handlebars view engine
app.engine('.hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  helpers: { // Date formats
    formatDate: (date) => {
      if (!date) return '';
      return new Date(date).toISOString().split('T')[0];
    },
    formatDateTime: (date) => {
        if (!date) return '';
        return new Date(date).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }
  }
}));
app.set('view engine', '.hbs');
app.set('views', './views');

// Middleware
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));

// Mount Routes
app.use('/admin', adminRoutes);

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
});