import fs from 'fs';

const css = fs.readFileSync('dist/assets/index-Bu3_R67a.css', 'utf8');
const js = fs.readFileSync('dist/assets/index-Bh_l2fdn.js', 'utf8');

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
