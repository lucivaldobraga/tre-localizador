const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\04365894277\\.gemini\\antigravity\\brain\\07a5fcfb-6b08-460c-b4d3-365f5451faac\\.system_generated\\steps\\11\\content.md', 'utf8');

const regex = /<option value="(\d+);(\d+)">(\d+) - (.*?)<\/option>/g;
let match;
const zones = [];

while ((match = regex.exec(html)) !== null) {
  zones.push({
    value: `${match[1]};${match[2]}`,
    zona: parseInt(match[1], 10),
    codMunic: parseInt(match[2], 10),
    label: `${match[3]} - ${match[4]}`
  });
}

fs.writeFileSync('src/zones.json', JSON.stringify(zones, null, 2));
console.log('Extracted ' + zones.length + ' zones');
