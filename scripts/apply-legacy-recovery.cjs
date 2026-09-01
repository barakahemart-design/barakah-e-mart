const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server.ts');
let source = fs.readFileSync(file, 'utf8');
const original = source;

source = source.replace(
  'if ((cleanEmail && docStore === cleanEmail) || (cleanEmail && docUid === cleanEmail) || allowedIds.includes(docUid)) {',
  'if ((cleanEmail && docStore === cleanEmail) || (cleanEmail && docUid === cleanEmail) || allowedIds.includes(docUid) || allowedIds.includes(docId)) {'
);

source = source.replace(
  'if (docStore === cleanEmail || docUid === cleanEmail || allowedIds.includes(docUid)) {',
  'if (docStore === cleanEmail || docUid === cleanEmail || allowedIds.includes(docUid) || allowedIds.includes(docId)) {'
);

if (source !== original) {
  fs.writeFileSync(file, source, 'utf8');
  console.log('Safe legacy recovery patch applied to server.ts');
} else {
  console.log('Safe legacy recovery patch already applied or target code changed; leaving source untouched.');
}
