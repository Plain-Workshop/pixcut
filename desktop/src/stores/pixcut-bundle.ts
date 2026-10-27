import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { persistProjectAssets, storeAssetBytes, loadAssetBlob } from './assets';
import { projectAssetRefs } from './missing-assets';
import { validateProject, type Project } from './model';

const FORMAT = 'pixcut';
const FORMAT_VERSION = 1;
const MANIFEST = 'manifest.json';

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v',
};

type BundleAsset = { id: string; path: string; name: string; mime: string; bytes: number };
type BundleManifest = { format: string; formatVersion: number; createdWith: string; project: Project; assets: BundleAsset[] };

/** Builds the same binary `.pixcut` package shape the native app writes. */
export async function projectToPixcut(project: Project): Promise<Uint8Array> {
  const portable = await persistProjectAssets(validateProject(project));
  const files: Record<string, Uint8Array> = {};
  const assets: BundleAsset[] = [];
  for (const reference of projectAssetRefs(portable)) {
    const id = reference.slice('pixcut-asset:'.length);
    const blob = await loadAssetBlob(id);
    const extension = EXTENSIONS[blob.type];
    if (!extension) throw new Error('A project asset has an unsupported type.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const path = `assets/${id}.${extension}`;
    files[path] = bytes;
    assets.push({ id, path, name: `${id}.${extension}`, mime: blob.type, bytes: bytes.length });
  }
  const manifest: BundleManifest = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    createdWith: 'PixCut browser',
    project: portable,
    assets,
  };
  files[MANIFEST] = strToU8(JSON.stringify(manifest));
  return zipSync(files, { level: 0 });
}

/** Reads a native or browser `.pixcut` package without creating data URLs. */
export async function readPixcutBundle(data: Uint8Array): Promise<Project> {
  let archive: Record<string, Uint8Array>;
  try { archive = unzipSync(data); }
  catch { throw new Error('This .pixcut package could not be opened.'); }
  const manifestBytes = archive[MANIFEST];
  if (!manifestBytes) throw new Error('The .pixcut package is missing its manifest.');
  if (manifestBytes.length > 5_000_000) throw new Error('The .pixcut manifest is too large.');
  let manifest: BundleManifest;
  try { manifest = JSON.parse(strFromU8(manifestBytes)) as BundleManifest; }
  catch { throw new Error('Invalid .pixcut manifest.'); }
  if (manifest.format !== FORMAT || manifest.formatVersion !== FORMAT_VERSION) {
    throw new Error('This .pixcut package version is not supported.');
  }
  let total = 0;
  const ids = new Set<string>();
  for (const asset of manifest.assets) {
    if (!asset.path.startsWith('assets/') || asset.path.includes('..')) throw new Error('The .pixcut package contains an unsafe asset path.');
    if (!EXTENSIONS[asset.mime]) throw new Error('The .pixcut package contains an unsupported asset type.');
    const bytes = archive[asset.path];
    if (!bytes) throw new Error('The .pixcut package is missing an asset.');
    if (bytes.length > 50_000_000) throw new Error('A .pixcut asset exceeds the 50 MB limit.');
    total += bytes.length;
    if (total > 200_000_000) throw new Error('The .pixcut package exceeds the 200 MB asset budget.');
    await storeAssetBytes(bytes, asset.name, asset.mime, asset.id);
    ids.add(asset.id);
  }
  const project = validateProject(manifest.project);
  for (const reference of projectAssetRefs(project)) {
    if (!ids.has(reference.slice('pixcut-asset:'.length))) throw new Error('A project asset is missing from the package.');
  }
  return project;
}
