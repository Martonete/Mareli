const fs = require('fs');
const path = require('path');

// 1. Parchear index.html con tags para iOS
const htmlPath = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const tags = `
  <!-- PWA: ícono para iOS -->
  <link rel="apple-touch-icon" href="/assets/icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icon.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Casa en Orden" />
  <link rel="manifest" href="/manifest.json" />`;

html = html.replace('</head>', tags + '\n</head>');
fs.writeFileSync(htmlPath, html);
console.log('✓ dist/index.html parcheado con apple-touch-icon');

// 2. Parchear manifest.json para que los íconos tengan el tamaño correcto (Android Chrome)
const manifestPath = path.join(__dirname, '../dist/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.icons = [
  {
    src: '/assets/icon.png',
    sizes: '2048x2048',
    type: 'image/png',
    purpose: 'any'
  },
  {
    src: '/assets/icon.png',
    sizes: '2048x2048',
    type: 'image/png',
    purpose: 'maskable'
  }
];

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ dist/manifest.json parcheado con tamaño correcto del ícono');
