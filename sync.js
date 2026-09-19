import fs from 'node:fs';
import path from 'node:path';

const REPOSITORIES = [
  {
    repo: 'Creadores-Program/CreaProDroid',
    package: 'org.CreadoresProgram.CreaProDroid',
    categories: ['Utility', 'System', 'Internet', 'System'],
    antiFeatures: ['NonFreeNet'],
    website: 'https://github.com/Creadores-Program/CreaProDroid',
    screenshotsDir: 'GithubResources'
  },
  {
    repo: 'Creadores-Program/CreaTV',
    package: 'org.CreadoresProgram.CreaTv',
    categories: ['Multimedia', 'Internet'],
    antiFeatures: ['NonFreeNet'],
    website: 'https://github.com/Creadores-Program/CreaTV',
    screenshotsDir: '.github/images'
  },
  {
    repo: 'Creadores-Program/legacysend',
    package: 'com.blithe.legacysend',
    categories: ['Connectivity', 'System', 'Utility'],
    website: 'https://github.com/Creadores-Program/legacysend'
  }
];

const REPO_DIR = path.join(process.cwd(), 'repo');
const METADATA_DIR = path.join(process.cwd(), 'metadata');
const CONFIG_PATH = path.join(process.cwd(), 'config.yml');

if (!fs.existsSync(REPO_DIR)) fs.mkdirSync(REPO_DIR, { recursive: true });
if (!fs.existsSync(METADATA_DIR)) fs.mkdirSync(METADATA_DIR, { recursive: true });

function getHeaders() {
  const headers = {
    'User-Agent': 'FDroid-Repo-Builder',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function getAppId(repoConfig) {
  if (typeof repoConfig !== 'string' && repoConfig.package) {
    return repoConfig.package;
  }
  const repo = typeof repoConfig === 'string' ? repoConfig : repoConfig.repo;
  return repo.split('/')[1];
}

async function generateAppMetadata(repoConfig) {
  const repo = typeof repoConfig === 'string' ? repoConfig : repoConfig.repo;
  const appId = getAppId(repoConfig);
  const categories = repoConfig.categories || ['Utility'];
  const antiFeatures = repoConfig.antiFeatures || [];
  const donate = repoConfig.donate || '';
  const website = repoConfig.website || '';

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: getHeaders() });
    if (!res.ok) return;
    
    const data = await res.json();
    const categoriesYaml = categories.map(c => `  - ${c}`).join('\n');
    
    const antiFeaturesYaml = antiFeatures.length > 0 
      ? `AntiFeatures:\n${antiFeatures.map(a => `  - ${a}`).join('\n')}\n`
      : '';

    const donateYaml = donate ? `Donate: ${donate}\n` : '';
    const websiteYaml = website ? `WebSite: ${website}\n` : `WebSite: ${data.html_url}\n`;

    const yamlContent = `AuthorName: "Creadores Program"
Categories:
${categoriesYaml}
${antiFeaturesYaml}${donateYaml}${websiteYaml}
License: ${data.license?.spdx_id || 'NOASSERTION'}
SourceCode: ${data.html_url}
IssueTracker: ${data.html_url}/issues
Summary: "${data.description || 'Aplicación oficial de Creadores Program'}"
`;

    fs.writeFileSync(path.join(METADATA_DIR, `${appId}.yml`), yamlContent, 'utf8');
    console.log(`[Metadatos] Generado ${appId}.yml con campos avanzados`);
  } catch (error) {
    console.error(`Error creando metadatos para ${repo}:`, error);
  }
}

async function fetchScreenshots(repoConfig) {
  if (typeof repoConfig === 'string' || !repoConfig.screenshotsDir) return;

  const repo = repoConfig.repo;
  const appId = getAppId(repoConfig);
  const targetDir = path.join(METADATA_DIR, appId, 'es-ES', 'phoneScreenshots');

  try {
    const url = `https://api.github.com/repos/${repo}/contents/${repoConfig.screenshotsDir}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return;

    const files = await res.json();
    if (!Array.isArray(files)) return;

    fs.mkdirSync(targetDir, { recursive: true });

    for (const file of files) {
      if (file.type === 'file' && /\.(png|jpg|jpeg|webp)$/i.test(file.name)) {
        const destPath = path.join(targetDir, file.name);
        if (!fs.existsSync(destPath)) {
          console.log(`[Capturas] Descargando ${file.name} para ${appId}...`);
          const imgRes = await fetch(file.download_url);
          const arrayBuffer = await imgRes.arrayBuffer();
          fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
        }
      }
    }
  } catch (error) {
    console.error(`Error descargando capturas de ${repo}:`, error);
  }
}

async function fetchAllApks(repoConfig) {
  const repo = typeof repoConfig === 'string' ? repoConfig : repoConfig.repo;
  const url = `https://api.github.com/repos/${repo}/releases?per_page=50`;

  try {
    const res = await fetch(url, { headers: getHeaders() });
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

      if (apkAssets.length === 0) continue;

      for (const asset of apkAssets) {
        const uniqueFileName = `${repoName}_${tag}_${asset.name}`;
        const filePath = path.join(REPO_DIR, uniqueFileName);

        if (!fs.existsSync(filePath)) {
          console.log(`Descargando ${asset.name} (${tag})...`);
          const apkRes = await fetch(asset.browser_download_url);
          const arrayBuffer = await apkRes.arrayBuffer();
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
          console.log(`Guardado: ${uniqueFileName}`);
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
  for (const item of REPOSITORIES) {
    await fetchAllApks(item);
    await generateAppMetadata(item);
    await fetchScreenshots(item);
  }

  appendPasswordsToConfig();
}

run();
