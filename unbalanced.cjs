const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.replace(/\r\n/g, '\n').split('\n');

const stack = [];
const curlyStack = [];

let inSingleQuote = false;
let inDoubleQuote = false;
let inBacktick = false;
let inLineComment = false;
let inBlockComment = false;

for (let lineNum = 1; lineNum <= 3883; lineNum++) {
  const line = lines[lineNum - 1];
  inLineComment = false;
  
  for (let col = 0; col < line.length; col++) {
    const char = line[col];
    const nextChar = line[col + 1];
    
    // Handle comments
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        col++;
      }
      continue;
    }
    if (inLineComment) continue;
    
    // Handle strings
    if (inSingleQuote) {
      if (char === "'" && line[col - 1] !== '\\') inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (char === '"' && line[col - 1] !== '\\') inDoubleQuote = false;
      continue;
    }
    if (inBacktick) {
      if (char === '`' && line[col - 1] !== '\\') inBacktick = false;
      continue;
    }
    
    // Check comment / string starts
    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      col++;
      continue;
    }
    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      col++;
      continue;
    }
    if (char === "'") { inSingleQuote = true; continue; }
    if (char === '"') { inDoubleQuote = true; continue; }
    if (char === '`') { inBacktick = true; continue; }
    
    // Track brackets
    if (char === '(') {
      stack.push({ type: 'paren', line: lineNum, col: col + 1, content: line.trim() });
    } else if (char === ')') {
      if (stack.length > 0) {
        stack.pop();
      }
    } else if (char === '{') {
      curlyStack.push({ line: lineNum, col: col + 1, content: line.trim() });
    } else if (char === '}') {
      if (curlyStack.length > 0) {
        curlyStack.pop();
      }
    }
  }
}

console.log(`Scan completed at line 3883.`);
console.log(`Open Parentheses:`, JSON.stringify(stack.filter(s => s.line >= 3430), null, 2));
console.log(`Open Curly Braces:`, JSON.stringify(curlyStack.filter(s => s.line >= 3430), null, 2));
