import fs from 'node:fs';
import path from 'node:path';

const REPOSITORIES = [
  'Creadores-Program/CreaProDroid',
  'Creadores-Program/CreaTV',
  'Creadores-Program/legacysend'
];

const REPO_DIR = path.join(process.cwd(), 'repo');

if (!fs.existsSync(REPO_DIR)) {
  fs.mkdirSync(REPO_DIR, { recursive: true });
}

async function fetchLatestApk(repo) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const headers = {
    'User-Agent': 'FDroid-Repo-Builder',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`Error consultando ${repo}: ${res.statusText}`);
      return;
    }

    const release = await res.json();
    const apkAssets = release.assets.filter(asset => asset.name.endsWith('.apk'));

    if (apkAssets.length === 0) {
      console.log(`No se encontraron archivos .apk en la última release de ${repo}`);
      return;
    }

    for (const asset of apkAssets) {
      const filePath = path.join(REPO_DIR, asset.name);

      if (!fs.existsSync(filePath)) {
        console.log(`Descargando ${asset.name} de ${repo}...`);
        const apkRes = await fetch(asset.browser_download_url);
        const arrayBuffer = await apkRes.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
        console.log(`Guardado: ${asset.name}`);
      } else {
        console.log(`El archivo ${asset.name} ya existe. Omitiendo.`);
      }
    }
  } catch (error) {
    console.error(`Error procesando ${repo}:`, error);
  }
}

async function run() {
  for (const repo of REPOSITORIES) {
    await fetchLatestApk(repo);
  }
}

run();
