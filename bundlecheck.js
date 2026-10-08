const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://shinian.test/', pretendToBeVisual: true });
const w = dom.window;
w.HTMLCanvasElement.prototype.getContext = function(){ return new Proxy({}, { get: (t,k)=> (k==='createRadialGradient'||k==='createLinearGradient'||k==='createPattern') ? ()=>({addColorStop(){}}) : (typeof k==='string'? function(){}:undefined) }); };
w.matchMedia = w.matchMedia || function(){ return { matches:false, addEventListener(){}, removeEventListener(){} }; };
const out = [];
try { w.eval(fs.readFileSync('www/assets/bundle.min.js','utf8')); out.push('bundle OK'); }
catch(e){ out.push('bundle FAIL: ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,4).join('\n')); }
out.push('Clouds:' + !!w.ShiNianClouds + ' SunMoon:' + !!w.ShiNianSunMoon + ' App:' + !!w.ShiNianApp + ' Core:' + !!w.ShiNianCore);
fs.writeFileSync('/tmp/stack.out', out.join('\n'));
process.exit(0);
