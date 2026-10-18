// Vector source is kept in assets/*.svg. Pass a local sharp module path to render.
// Usage: node scripts/generate-icons.cjs <sharp-module-path>
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const out = path.resolve(__dirname, '../assets');
fs.mkdirSync(out, {recursive:true});
const point = angle => {
  const a = angle * Math.PI / 180;
  return `${(54 + 24 * Math.cos(a)).toFixed(4)} ${(54 + 24 * Math.sin(a)).toFixed(4)}`;
};
const segments = [[-92,-228,'#8D6BEB'],[-256,-344,'#12B9A5'],[-372,-424,'#3366FF']];
const mark = mono => segments.map(([start,end,color]) =>
  `<path d="M ${point(start)} A 24 24 0 0 0 ${point(end)}" fill="none" stroke="${mono?'#FFFFFF':color}" stroke-width="9.6" stroke-linecap="round"/>`).join('') +
  [[45,54.5,7],[51.9,50.5,11],[58.8,46.5,15]].map(([x,y,h])=>`<rect x="${x}" y="${y}" width="4.2" height="${h}" rx="2.1" fill="${mono?'#FFFFFF':'#F4F7FC'}"/>`).join('');
const bg = '<defs><linearGradient id="navy" x1="0" y1="0" x2="0.7" y2="1"><stop stop-color="#1B2536"/><stop offset="1" stop-color="#101723"/></linearGradient></defs><path fill="url(#navy)" d="M0 0h108v108H0z"/>';
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 108 108">${body}</svg>`;
const variants = {
  'icon': svg(bg + `<g transform="translate(54 54) scale(1.14) translate(-54 -54)">${mark(false)}</g>`),
  'icon-foreground': svg(mark(false)),
  'icon-background': svg(bg),
  'icon-monochrome': svg(mark(true)),
};
(async()=>{
  for(const [name,source] of Object.entries(variants)){
    fs.writeFileSync(path.join(out,`${name}.svg`),source+'\n');
    await sharp(Buffer.from(source)).png().toFile(path.join(out,`${name}.png`));
  }
  // Visual QA: Android circular and rounded-square masks plus small launcher sizes.
  const circle = '<circle cx="54" cy="54" r="54"/>';
  const squircle = '<rect width="108" height="108" rx="26"/>';
  for(const [name,mask] of [['circle',circle],['rounded',squircle]]){
    const preview = svg(`<defs><clipPath id="mask">${mask}</clipPath></defs><g clip-path="url(#mask)">${bg}<g transform="translate(54 54) scale(1.4) translate(-54 -54)">${mark(false)}</g></g>`);
    await sharp(Buffer.from(preview)).resize(256,256).png().toFile(path.join(out,`preview-${name}.png`));
  }
  console.log('Rendered four 1024px icon layers and two launcher-mask previews.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
