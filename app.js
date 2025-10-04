const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const routes = require('./routes');

const app = express();
const PORT = 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'devGraphicSecret007',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));


app.use('/', routes);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
