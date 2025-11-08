import fs from 'fs';
import path from 'path';

// 自动查找 dist/assets 目录下的 CSS 和 JS 文件
const assetsDir = 'dist/assets';
const files = fs.readdirSync(assetsDir);
const cssFile = files.find(f => f.endsWith('.css'));
const jsFile = files.find(f => f.endsWith('.js'));

const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
const js = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>图像编辑器</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
${js}
  </script>
</body>
</html>`;

fs.writeFileSync('image-editor-standalone.html', html, 'utf8');
console.log('✅ 单文件HTML已生成: image-editor-standalone.html');
