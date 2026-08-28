const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'build', 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.log('build/index.html not found, skipping optimization.');
  process.exit(0);
}

let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Convert blocking CSS link tags into async preloaded stylesheet tags
// Google PageSpeed / Lighthouse recommendation for eliminating render-blocking stylesheets
html = html.replace(
  /<link href="(\/static\/css\/[^"\s>]+\.css)" rel="stylesheet">/g,
  '<link rel="preload" href="$1" as="style" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="$1"></noscript>'
);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully optimized build/index.html to eliminate render-blocking CSS requests!');
