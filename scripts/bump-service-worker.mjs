#!/usr/bin/env node
/**
 * Bump Service Worker Build Version
 * 
 * Automatically increments the BUILD_VERSION in service-worker.js
 * Also versions PWA icons to force Android to refresh
 * 
 * Format: YYYY-MM-DD-XX where XX is a daily counter (01-99)
 * 
 * Usage:
 *   node scripts/bump-service-worker.mjs              (offline mode - no versioning)
 *   node scripts/bump-service-worker.mjs --production (version for deployment)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SW_PATH = path.join(__dirname, '../public/service-worker.js');
const MANIFEST_PATH = path.join(__dirname, '../public/manifest.json');
const INDEX_HTML_PATH = path.join(__dirname, '../index.html');
const ICONS_DIR = path.join(__dirname, '../public/icons');
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

function getTodayVersion() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function bumpIconVersion(buildVersion) {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('❌ Manifest not found:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];

  const sampleIcon = icons.find((icon) => typeof icon.src === 'string' && icon.src.includes('icon-192x192'));
  const versionMatch = sampleIcon?.src?.match(/-v([\w-]+)\.png$/);
  const currentVersion = versionMatch ? versionMatch[1] : '0';
  const newVersion = buildVersion;

  const makeSrc = (size) => `/icons/icon-${size}x${size}-v${newVersion}.png`;

  manifest.icons = icons.map((icon) => {
    const sizeMatch = String(icon.sizes || '').match(/^(\d+)x\1$/);
    if (!sizeMatch) return icon;
    const size = parseInt(sizeMatch[1], 10);
    if (!ICON_SIZES.includes(size)) return icon;
    return { ...icon, src: makeSrc(size) };
  });

  if (Array.isArray(manifest.shortcuts)) {
    manifest.shortcuts = manifest.shortcuts.map((shortcut) => {
      if (!Array.isArray(shortcut.icons)) return shortcut;
      return {
        ...shortcut,
        icons: shortcut.icons.map((icon) => {
          const sizeMatch = String(icon.sizes || '').match(/^(\d+)x\1$/);
          if (!sizeMatch) return icon;
          const size = parseInt(sizeMatch[1], 10);
          if (!ICON_SIZES.includes(size)) return icon;
          return { ...icon, src: makeSrc(size) };
        }),
      };
    });
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  if (fs.existsSync(INDEX_HTML_PATH)) {
    let indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    indexHtml = indexHtml.replace(/\/icons\/icon-192x192(-v\d+)?\.png/g, makeSrc(192));
    indexHtml = indexHtml.replace(/\/icons\/icon-512x512(-v\d+)?\.png/g, makeSrc(512));
    fs.writeFileSync(INDEX_HTML_PATH, indexHtml, 'utf-8');
  }

  for (const size of ICON_SIZES) {
    const basePath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    const fallbackPath = path.join(ICONS_DIR, `icon-${size}x${size}-v${currentVersion}.png`);
    const sourcePath = fs.existsSync(basePath) ? basePath : fallbackPath;
    const targetPath = path.join(ICONS_DIR, `icon-${size}x${size}-v${newVersion}.png`);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️  Missing icon source for ${size}x${size}: ${basePath}`);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }

  console.log(`✅ PWA icons versioned: v${newVersion}`);
}

function bumpVersion() {
  if (!fs.existsSync(SW_PATH)) {
    console.error('❌ Service worker file not found:', SW_PATH);
    process.exit(1);
  }

  let content = fs.readFileSync(SW_PATH, 'utf-8');
  
  // Match BUILD_VERSION = "YYYY-MM-DD-XX"
  const versionRegex = /const BUILD_VERSION = "([\d]{4}-[\d]{2}-[\d]{2}-[\d]{2})";/;
  const match = content.match(versionRegex);

  if (!match) {
    console.error('❌ Could not find BUILD_VERSION in service-worker.js');
    process.exit(1);
  }

  const currentVersion = match[1];
  const parts = currentVersion.split('-');
  const currentDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
  const currentCounter = parseInt(parts[3] || '0', 10);

  const todayDate = getTodayVersion();
  
  let newCounter;
  if (currentDate === todayDate) {
    // Same day, increment counter
    newCounter = String(currentCounter + 1).padStart(2, '0');
  } else {
    // New day, reset to 01
    newCounter = '01';
  }

  const newVersion = `${todayDate}-${newCounter}`;
  const newContent = content.replace(versionRegex, `const BUILD_VERSION = "${newVersion}";`);

  fs.writeFileSync(SW_PATH, newContent, 'utf-8');

  console.log('✅ Service Worker version bumped');
  console.log(`   ${currentVersion} → ${newVersion}`);
  return newVersion;
}

// Check if running in production mode (for deployment)
const isProduction = process.argv.includes('--production');

if (isProduction) {
  const buildVersion = bumpVersion();
  bumpIconVersion(buildVersion);
  console.log('\n🚀 Ready for production deployment');
} else {
  console.log('ℹ️  Development build (no versioning)');
  console.log('   Use --production flag for deployment: node scripts/bump-service-worker.mjs --production');
}
