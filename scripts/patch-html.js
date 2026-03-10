const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const tags = `
  <!-- PWA: ícono para iOS -->
  <link rel="apple-touch-icon" href="/assets/icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icon.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Casa en Orden" />
  <link rel="manifest" href="/manifest.json" />`;

// Insert before closing </head>
html = html.replace('</head>', tags + '\n</head>');

fs.writeFileSync(htmlPath, html);
console.log('✓ dist/index.html parcheado con apple-touch-icon');
