const fs = require('fs');

function extract() {
  const walk = fs.readFileSync('/Users/siddharth.exe/.gemini/antigravity/brain/cc73cc0b-8020-4e35-8854-3ad1eede358d/walkthrough.md.resolved.1', 'utf8');
  let diffStart = walk.indexOf('```diff:Profile.tsx\n');
  if (diffStart < 0) diffStart = walk.indexOf('```diff\n');
  
  if (diffStart >= 0) {
    const blockStart = walk.indexOf('\n', diffStart) + 1;
    const blockEnd = walk.indexOf('```', blockStart);
    let patchContent = walk.substring(blockStart, blockEnd);
    fs.writeFileSync('patch.diff', patchContent);
    console.log('Saved patch.diff');
  } else {
    console.log('Diff not found');
  }
}
extract();
