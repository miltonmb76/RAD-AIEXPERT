const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

const keywords = ['doppler', 'venoso', 'arterial', 'medidas', 'tabla', 'cuadro', 'inferior', 'superior'];

lines.forEach((line, index) => {
  const lower = line.toLowerCase();
  // We want lines that have 'doppler' and 'venoso' or 'arterial', or 'medidas'
  if (lower.includes('doppler') && (lower.includes('medida') || lower.includes('tabla') || lower.includes('cuadro') || lower.includes('venoso') || lower.includes('arterial'))) {
    if (line.length < 200) {
      console.log(`${index + 1}: ${line.trim()}`);
    } else {
      console.log(`${index + 1}: ${line.trim().slice(0, 150)}...`);
    }
  }
});
