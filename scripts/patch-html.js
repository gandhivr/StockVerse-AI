import fs from 'fs';
import path from 'path';

const distClient = path.resolve('dist/client');
const assetsDir = path.join(distClient, 'assets');

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const mainJs = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
  const cssFile = files.find(f => f.startsWith('styles-') && f.endsWith('.css'));

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StockVerse AI — Smart Stock Analysis & Predictions</title>
    ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}">` : ''}
  </head>
  <body class="dark bg-background text-foreground antialiased">
    <div id="root"></div>
    ${mainJs ? `<script type="module" src="/assets/${mainJs}"></script>` : ''}
  </body>
</html>`;

  fs.writeFileSync(path.join(distClient, 'index.html'), htmlContent);
  console.log('Successfully generated dist/client/index.html with mainJs:', mainJs, 'cssFile:', cssFile);
}
