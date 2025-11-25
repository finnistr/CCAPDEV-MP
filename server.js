import 'dotenv/config';
import express from 'express';
import expresshbs from 'express-handlebars';
import { connectToMongo, getDb } from './db/conn.js';

const port = 3000;
const app = express();

// Step 1. Establish MongoDB server connection and functionality
connectToMongo((err => {
    if (err) {
        console.log("Error: Failed to establish connection with MongoDB!");
        console.error(err);
        process.exit();
    }
    console.log("Successfully connected to MongoDB server!");

    const db = getDb();
}))


// Step 2. Setup Express Handlebars
app.use(express.static(process.cwd() + "/public"));
app.engine("hbs", expresshbs.engine({extname: 'hbs'}));
app.set("view engine", "hbs");
app.set("views", "./views");


// Step 3. Handlebars stuff

// index.hbs
app.get('/', (req, res) => {
  res.render('partials/index');
});

// search.hbs
app.get('/flights/search', (req, res) => {
  res.render('partials/search');
});

// list.hbs
app.get('/reservation/list', (req, res) => {
  res.render('partials/list');
});

// reservation.hbs
app.get('/reservation/form', (req, res) => {
  res.render('partials/reservation');
});

// admin_flights.hbs
app.get('/admin/flights', (req, res) => {
  res.render('partials/admin_flights.hbs');
});

// admin_users.hbs
app.get('/admin/users', (req, res) => {
  res.render('partials/admin_users.hbs');
});


// Step END. Establish local server via Express
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});