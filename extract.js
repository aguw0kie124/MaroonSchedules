const fs = require('fs');
const content = fs.readFileSync('/tmp/siddarth_events.tsx', 'utf8');

function extractBlock(startMarker, stopMarker) {
    const startIdx = content.indexOf(startMarker);
    const endIdx = stopMarker ? content.indexOf(stopMarker, startIdx + 1) : content.length;
    return content.substring(startIdx, endIdx);
}

const lines = content.split('\n');
const startDiscover = lines.findIndex(l => l.includes('const renderHorizontalDiscover = () => ('));
const endDiscover = lines.findIndex((l, i) => i > startDiscover && l === '  );');

console.log(lines.slice(startDiscover, endDiscover + 1).join('\n'));
