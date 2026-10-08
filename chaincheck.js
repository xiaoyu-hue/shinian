const fs = require('fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><body><canvas></canvas></body>', { runScripts: 'outside-only', url: 'https://x.test/?t=12:30', pretendToBeVisual: true });
const w = dom.window;
w.HTMLCanvasElement.prototype.getContext = function(){ return new Proxy({}, { get: (t,k)=> (k==='createRadialGradient'||k==='createLinearGradient'||k==='createPattern') ? ()=>({addColorStop(){}}) : (typeof k==='string'? function(){}:undefined) }); };
const ORDER = ['cities','lunar','season','sky','weather','suncalc','sunmoon','notifications','decor','clouds','intro','app'];
const out = [];
for (const n of ORDER) {
  try { w.eval(fs.readFileSync('assets/' + n + '.js', 'utf8')); out.push('OK   ' + n); }
  catch (e) { out.push('FAIL ' + n + ' -> ' + e.message); break; }
}
fs.writeFileSync('/tmp/chain.out', out.join('\n') || '无输出');
process.exit(0);
