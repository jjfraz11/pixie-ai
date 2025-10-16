import sdk from './opentelemetry';
sdk.start();
import app from './app';
const port = 3030;
app.listen(port, () => {
    console.log(`Feathers server listening on http://localhost:${port}`);
});
