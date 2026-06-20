import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Get git commit hash (short)
  const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  
  // Get commit count (total number of commits)
  const commitCount = execSync('git rev-list --count HEAD').toString().trim();
  
  // Get commit date
  const commitDate = execSync('git log -1 --format=%cd --date=iso').toString().trim();
  
  // Get branch name
  const branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  const versionInfo = {
    commitHash,
    commitCount,
    commitDate,
    branchName,
    version: `${commitCount}-${commitHash}`
  };
  
  // Write to version.json in the public directory
  const publicDir = join(__dirname, '..', 'public');
  const versionPath = join(publicDir, 'version.json');
  
  // Create public directory if it doesn't exist
  mkdirSync(publicDir, { recursive: true });
  
  writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
  
  console.log('Version info generated:', versionInfo.version);
} catch (error) {
  console.error('Error generating version info:', error.message);
  // Fallback version if git commands fail
  const fallbackInfo = {
    commitHash: 'unknown',
    commitCount: '0',
    commitDate: new Date().toISOString(),
    branchName: 'unknown',
    version: 'dev'
  };
  
  const publicDir = join(__dirname, '..', 'public');
  const versionPath = join(publicDir, 'version.json');
  
  // Create public directory if it doesn't exist
  mkdirSync(publicDir, { recursive: true });
  
  writeFileSync(versionPath, JSON.stringify(fallbackInfo, null, 2));
  console.log('Fallback version info generated');
}
