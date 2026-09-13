const fs = require('fs');
const { execSync } = require('child_process');

console.log('Building StudyOS-AI workspace...');

if (fs.existsSync('frontend')) {
  console.log('Installing frontend dependencies...');
  execSync('npm --prefix frontend install', { stdio: 'inherit' });
  console.log('Building Vite bundle...');
  execSync('npm --prefix frontend run build', { stdio: 'inherit' });
  if (fs.existsSync('frontend/dist')) {
    if (fs.existsSync('dist')) {
      try { fs.rmSync('dist', { recursive: true, force: true }); } catch {}
    }
    fs.cpSync('frontend/dist', 'dist', { recursive: true });
    console.log('Successfully deployed to dist folder.');
  }
} else {
  console.log('Building from inside frontend directory...');
  execSync('npm run build', { stdio: 'inherit' });
}

console.log('Build completed successfully.');
