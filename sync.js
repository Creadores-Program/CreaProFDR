import fs from 'node:fs';
import path from 'node:path';

const REPOSITORIES = [
  'Creadores-Program/CreaProDroid',
  'Creadores-Program/CreaTV',
  'Creadores-Program/legacysend'
];

const REPO_DIR = path.join(process.cwd(), 'repo');
const CONFIG_PATH = path.join(process.cwd(), 'config.yml');

if (!fs.existsSync(REPO_DIR)) {
  fs.mkdirSync(REPO_DIR, { recursive: true });
}

async function fetchAllApks(repo) {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=50`;
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

    const releases = await res.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      console.log(`No se encontraron releases en ${repo}`);
      return;
    }

    for (const release of releases) {
      const tag = release.tag_name || 'unknown';
      const repoName = repo.split('/')[1];
      
      const apkAssets = release.assets.filter(asset => asset.name.endsWith('.apk'));

      if (apkAssets.length === 0) {
        continue;
      }

      for (const asset of apkAssets) {
        const uniqueFileName = `${repoName}_${tag}_${asset.name}`;
        const filePath = path.join(REPO_DIR, uniqueFileName);

        if (!fs.existsSync(filePath)) {
          console.log(`Descargando ${asset.name} (Tag: ${tag})...`);
          const apkRes = await fetch(asset.browser_download_url);
          const arrayBuffer = await apkRes.arrayBuffer();
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
          console.log(`Guardado exitosamente: ${uniqueFileName}`);
        } else {
          console.log(`El archivo ${uniqueFileName} ya existe. Omitiendo.`);
        }
      }
    }
  } catch (error) {
    console.error(`Error procesando ${repo}:`, error);
  }
}

function appendPasswordsToConfig() {
  const password = process.env.CREAPROFDRKEYCONTRE;

  if (!password) {
    console.error('Error: No se encontró la variable de entorno con la contraseña.');
    return;
  }

  const yamlContent = `\nkeypass: "${password}"\nkeystorepass: "${password}"\n`;

  try {
    fs.appendFileSync(CONFIG_PATH, yamlContent, 'utf8');
    console.log('Contraseñas clave agregadas exitosamente a config.yml');
  } catch (err) {
    console.error('Error al actualizar config.yml:', err);
  }
}

async function run() {
  for (const repo of REPOSITORIES) {
    await fetchAllApks(repo);
  }

  appendPasswordsToConfig();
}

run();
