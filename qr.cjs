const QRCode = require('qrcode');
const value = process.argv[2] || '';
QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#1C4B8F', light: '#FFFDF7' } })
  .then(svg => process.stdout.write(svg))
  .catch(error => { console.error(error.message); process.exit(1); });
