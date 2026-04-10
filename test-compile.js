const fs = require('fs');
const content = fs.readFileSync('Frontend/components/places/LocationBottomSheet.tsx', 'utf8');
try {
  require('@babel/core').transformSync(content, {
    presets: ['@babel/preset-typescript', '@babel/preset-react']
  });
  console.log('Syntax OK');
} catch(e) {
  console.error(e.message);
}
