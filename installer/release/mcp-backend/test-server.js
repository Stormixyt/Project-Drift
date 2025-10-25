// Simple test server
import express from 'express';

const app = express();
const PORT = 3551;

app.get('/test', (req, res) => {
  res.json({ status: 'working' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});
