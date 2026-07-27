import fs from 'fs';
import path from 'path';

const distClient = path.resolve('dist/client');
const assetsDir = path.join(distClient, 'assets');

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  
  // Sort files by mtimeMs so the NEWEST generated bundle is always picked
  const jsFiles = files
    .filter(f => f.startsWith('index-') && f.endsWith('.js'))
    .map(f => ({ name: f, time: fs.statSync(path.join(assetsDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  const cssFiles = files
    .filter(f => f.startsWith('styles-') && f.endsWith('.css'))
    .map(f => ({ name: f, time: fs.statSync(path.join(assetsDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  const mainJs = jsFiles.length > 0 ? jsFiles[0].name : null;
  const cssFile = cssFiles.length > 0 ? cssFiles[0].name : null;

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
