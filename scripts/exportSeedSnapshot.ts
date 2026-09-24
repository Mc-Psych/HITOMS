import fs from 'fs';
import path from 'path';

// Snapshot extractor for HITOMS
async function run() {
  const seedFilePath = path.join(process.cwd(), 'src', 'data', 'defaultSeedData.json');
  console.log('Validating seed file at:', seedFilePath);
  if (fs.existsSync(seedFilePath)) {
    const raw = fs.readFileSync(seedFilePath, 'utf8');
    console.log('Existing seed file size:', raw.length);
  }
}

run();
