export type PostMediaKind = 'image' | 'gif' | 'video' | 'unknown';

export const POST_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4';
export const MAX_MEDIA_ITEMS_PER_POST = 4;
export const DEFAULT_VIDEO_THUMBNAIL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#374151"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="28" fill="url(#bg)"/>
      <rect x="24" y="24" width="592" height="312" rx="22" fill="none" stroke="rgba(255,255,255,0.14)"/>
      <circle cx="320" cy="180" r="44" fill="rgba(255,255,255,0.16)"/>
      <polygon points="307,156 307,204 347,180" fill="#ffffff"/>
      <text x="40" y="62" fill="rgba(255,255,255,0.78)" font-family="Arial, sans-serif" font-size="26" font-weight="700">
        Video
      </text>
    </svg>
  `);

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_GIF_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

export function getPostMediaKind(file: Pick<File, 'type' | 'name'>): PostMediaKind {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif';
  if (type.startsWith('video/') || name.endsWith('.mp4')) return 'video';
  if (type.startsWith('image/') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp')) return 'image';
  return 'unknown';
}

export function getPostMediaKindFromUrl(url?: string | null): PostMediaKind {
  if (!url) return 'unknown';

  if (url.startsWith('data:image/')) return 'image';
  if (url.startsWith('data:video/')) return 'video';

  const normalized = url.split('?')[0].toLowerCase();

  if (normalized.endsWith('.gif')) return 'gif';
  if (normalized.endsWith('.mp4') || normalized.endsWith('.mov') || normalized.endsWith('.webm') || normalized.includes('/video/')) return 'video';
  if (
    normalized.endsWith('.jpg') ||
    normalized.endsWith('.jpeg') ||
    normalized.endsWith('.png') ||
    normalized.endsWith('.webp') ||
    normalized.endsWith('.bmp') ||
    normalized.endsWith('.avif')
  ) {
    return 'image';
  }

  return 'unknown';
}

export function getPostPreviewUrl(mediaUrl?: string | null, thumbnailUrl?: string | null, optimizedUrl?: string | null): string {
  const kind = getPostMediaKindFromUrl(mediaUrl);
  if (kind === 'video') {
    if (getPostMediaKindFromUrl(thumbnailUrl) === 'image') return thumbnailUrl || '';
    if (getPostMediaKindFromUrl(optimizedUrl) === 'image') return optimizedUrl || '';
    return DEFAULT_VIDEO_THUMBNAIL;
  }
  return optimizedUrl || thumbnailUrl || mediaUrl || '';
}

export function validatePostMediaFiles(files: File[]): string | null {
  if (files.length > MAX_MEDIA_ITEMS_PER_POST) {
    return `A post can contain up to ${MAX_MEDIA_ITEMS_PER_POST} media items.`;
  }

  const kinds: PostMediaKind[] = [];
  for (const file of files) {
    const kind = getPostMediaKind(file);
    const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : kind === 'gif' ? MAX_GIF_BYTES : MAX_IMAGE_BYTES;

    if (kind === 'unknown') {
      return 'Unsupported media type. Allowed: JPG, PNG, WEBP, GIF, MP4.';
    }

    if (file.size > maxBytes) {
      if (kind === 'video') return 'Video file exceeds the 512MB limit.';
      if (kind === 'gif') return 'GIF file exceeds the 15MB limit.';
      return 'Image file exceeds the 20MB limit.';
    }

    kinds.push(kind);
  }

  return null;
}

export function mergeAndValidatePostMedia(existingCount: number, newFiles: File[]): string | null {
  const compositionError = validatePostMediaFiles(newFiles);
  if (compositionError) return compositionError;

  if (existingCount + newFiles.length > MAX_MEDIA_ITEMS_PER_POST) {
    return `A post can contain up to ${MAX_MEDIA_ITEMS_PER_POST} media items.`;
  }

  return null;
}
