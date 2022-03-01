// app.js

const express = require('express');
const connectDB = require('./config/db');
var cors = require('cors');
// var favicon = require('serve-favicon');
// var path = require('path');
// routes
const user = require('./routes/api/user');

const app = express();

// Connect Database
connectDB();

// cors
app.use(cors({ origin: true, credentials: true }));

// Init Middleware
app.use(express.json());

// use Routes

app.use('/', user);
// app.get('/', (req, res) => res.sendFile(__dirname + "/index.html"));

// app.use(favicon(path.join(__dirname, 'favicon.ico')));
//use nexmo

const port = process.env.PORT || 8082;

app.listen(port, () => console.log(`Server running on port ${port}`));