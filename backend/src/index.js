const app = require('./app');

const port = 3030;

app.listen(port, () => {
  console.log(`Feathers server listening on http://localhost:${port}`);
});
