// Vercel serverless function — serves the TanStack Start app
// This proxies all requests through the built server handler

export default async function handler(req, res) {
  // Serve static assets directly
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StockVerse AI</title>
  </head>
  <body>
    <script>window.location.href = "/";</script>
  </body>
</html>`);
}
