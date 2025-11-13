import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import morgan from 'morgan';
import methodOverride from 'method-override';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { engine } from 'express-handlebars';

import indexRouter from './routes/index.js';
import flightRouter from './routes/flights.js';
import reservationRouter from './routes/reservations.js';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ccapdev_mp';

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log(`✅ Connected to MongoDB: ${mongoUri}`);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, '../views/layouts'),
    partialsDir: path.join(__dirname, '../views/partials'),
    helpers: {
      currency(value) {
        if (typeof value !== 'number') return value;
        return `₱${value.toFixed(2)}`;
      },
      formatDate(value, options = {}) {
        if (!value) return '';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
          return '';
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
          dateStyle: options.dateStyle || 'medium',
          timeStyle: options.timeStyle || 'short',
        });

        return formatter.format(date);
      },
      json(context) {
        return JSON.stringify(context);
      },
      eq(a, b) {
        return a === b;
      },
      add(...args) {
        const options = args.pop();
        return args.reduce((sum, value) => {
          const numeric = Number(value) || 0;
          return sum + numeric;
        }, 0);
      },
    },
  }),
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(morgan('dev'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ccapdev-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  }),
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

app.use('/', indexRouter);
app.use('/flights', flightRouter);
app.use('/reservations', reservationRouter);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500);
  res.render('errors/500', {
    title: 'Server Error',
    message: err.message || 'Something went wrong on our end.',
  });
});

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
  });
}

export default app;

