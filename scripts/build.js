const fs = require('fs');
const { execSync } = require('child_process');

if (fs.existsSync('frontend')) {
  console.log('Building from root: compiling frontend...');
  execSync('npm --prefix frontend install && npm --prefix frontend run build', { stdio: 'inherit' });
  if (fs.existsSync('frontend/dist') && !fs.existsSync('dist')) {
    fs.cpSync('frontend/dist', 'dist', { recursive: true });
  }
} else {
  console.log('Building from inside frontend directory...');
  execSync('npm run build', { stdio: 'inherit' });
}
