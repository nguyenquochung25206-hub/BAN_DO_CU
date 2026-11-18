'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

// Chỉ xử lý ảnh trong server/uploads/products (theo server/server.js hiện tại).
function resolveProductUpload(imageUrl, projectRoot = path.resolve(__dirname, '../..')) {
  if (typeof imageUrl !== 'string' ||
      !/^\/uploads\/products\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpg|jpeg|png|webp)$/i.test(imageUrl)) {
    return null;
  }
  const filename = imageUrl.slice('/uploads/products/'.length);
  if (filename.includes('..')) return null;
  return path.join(projectRoot, 'server', 'uploads', 'products', filename);
}

async function cleanupProductImages(imageUrls, projectRoot) {
  const failures = [];
  for (const url of imageUrls) {
    const filePath = resolveProductUpload(url, projectRoot);
    if (!filePath) { failures.push(url); continue; }
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') failures.push(url);
    }
  }
  return failures;
}

module.exports = { resolveProductUpload, cleanupProductImages };
