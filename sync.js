import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const REPOSITORIES = [
  {
    repo: 'Creadores-Program/CreaProDroid',
    package: 'org.CreadoresProgram.CreaProDroid',
    categories: ['Utility', 'System', 'Internet', 'System'],
    antiFeatures: ['NonFreeNet'],
    website: 'https://discord.com/invite/mrmHcwxXff',
    screenshotsDir: 'GithubResources'
  },
  {
    repo: 'Creadores-Program/CreaTV',
    package: 'org.CreadoresProgram.CreaTv',
    categories: ['Multimedia', 'Internet'],
    antiFeatures: ['NonFreeNet'],
    website: 'https://discord.com/invite/mrmHcwxXff',
    screenshotsDir: '.github/images'
  },
  {
    repo: 'Creadores-Program/legacysend',
    package: 'com.blithe.legacysend',
    customIconColor: [21, 101, 192],
    categories: ['Connectivity', 'System', 'Utility'],
    website: 'https://discord.com/invite/mrmHcwxXff'
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

async function fetchChangelogs(repoConfig) {
  const repo = typeof repoConfig === 'string' ? repoConfig : repoConfig.repo;
  const appId = getAppId(repoConfig);
  const url = `https://api.github.com/repos/${repo}/releases?per_page=50`;

  try {
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return;

    const releases = await res.json();
    if (!Array.isArray(releases)) return;

    const changelogDir = path.join(METADATA_DIR, appId, 'es-ES', 'changelogs');

    for (const release of releases) {
      if (!release.body || release.body.trim() === '') continue;

      const changelogContent = release.body.trim();

      fs.mkdirSync(changelogDir, { recursive: true });

      const fileName = `${release.tag_name.replace(/^v/, '')}.txt`;
      const filePath = path.join(changelogDir, fileName);

      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, changelogContent, 'utf8');
        console.log(`[Changelog] Creado ${fileName} para ${appId}`);
      }
    }
  } catch (error) {
    console.error(`Error guardando changelogs de ${repo}:`, error);
  }
}
async function generateSimplePngIcon(repoConfig) {
  if (!repoConfig.customIconColor) return;

  const appId = getAppId(repoConfig);
  const repoIconsDir = path.join(REPO_DIR, 'icons');
  const repoIconPath = path.join(repoIconsDir, `${appId}.png`);
  const iconPath = path.join(METADATA_DIR, `${appId}.png`);

  if (fs.existsSync(iconPath)) {
    console.log(`[Icono] El icono estático para ${appId} ya existe. Omitiendo.`);
    return;
  }

  try {
    const SIZE = 512;
    const png = new PNG({ width: SIZE, height: SIZE });

    const [r, g, b] = Array.isArray(repoConfig.customIconColor)
      ? repoConfig.customIconColor
      : [21, 101, 192];

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = (SIZE * y + x) << 2;
        png.data[idx]     = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      }
    }

    const buffer = PNG.sync.write(png);
    fs.writeFileSync(iconPath, buffer);
    fs.writeFileSync(repoIconPath, buffer);
    console.log(`[Icono] Generado PNG de color plano para ${appId} en metadata/`);
  } catch (error) {
    console.error(`Error generando icono plano para ${appId}:`, error);
  }
}

async function run() {
  for (const item of REPOSITORIES) {
    await fetchAllApks(item);
    await generateAppMetadata(item);
    await generateSimplePngIcon(item);
    await fetchScreenshots(item);
    await fetchChangelogs(item);
  }

  appendPasswordsToConfig();
}

run();
