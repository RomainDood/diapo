import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  PRESENTATION_IMAGE_MAX_BYTES,
  PRESENTATION_MEDIA_MIME_TYPES,
  type PresentationMediaMimeType,
  type PresentationImageUpload,
  type PresentationImageUploadInput,
} from '../shared/presentation.ts';

const EXTENSIONS: Record<PresentationMediaMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

export class PresentationImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresentationImageError';
  }
}

export type StoredPresentationImage = {
  readonly bytes: Buffer;
  readonly mimeType: PresentationMediaMimeType;
};

function isMimeType(value: string): value is PresentationMediaMimeType {
  return PRESENTATION_MEDIA_MIME_TYPES.includes(value as PresentationMediaMimeType);
}

function decodeDataUrl(dataUrl: string, mimeType: PresentationMediaMimeType): Buffer {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) {
    throw new PresentationImageError('The media payload is not a supported base64 data URL.');
  }

  const base64 = dataUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length === 0) {
    throw new PresentationImageError('The image payload is not valid base64.');
  }

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > PRESENTATION_IMAGE_MAX_BYTES) {
    throw new PresentationImageError('Media files must be smaller than 8 MB.');
  }
  return bytes;
}

export function createPresentationImageStore(directory: string) {
  mkdirSync(directory, { recursive: true });

  return {
    save(input: PresentationImageUploadInput): PresentationImageUpload {
      if (!isMimeType(input.mimeType)) {
        throw new PresentationImageError('This image format is not supported.');
      }

      const bytes = decodeDataUrl(input.dataUrl, input.mimeType);
      const filename = `${randomUUID()}${EXTENSIONS[input.mimeType]}`;
      const destination = join(directory, filename);
      const temporary = join(directory, `.${filename}.upload`);
      writeFileSync(temporary, bytes, { flag: 'wx' });
      renameSync(temporary, destination);

      return {
        url: `/api/presentation-images/${filename}`,
        filename: input.filename.trim() || filename,
        mimeType: input.mimeType,
      };
    },
    read(filename: string): StoredPresentationImage | undefined {
      const safeFilename = basename(filename);
      if (safeFilename !== filename || extname(safeFilename) === '') return undefined;
      const mimeType = (Object.entries(EXTENSIONS).find(([, extension]) => safeFilename.endsWith(extension))?.[0] ?? '') as string;
      if (!isMimeType(mimeType)) return undefined;
      try {
        return { bytes: readFileSync(join(directory, safeFilename)), mimeType };
      } catch {
        return undefined;
      }
    },
  };
}

export type PresentationImageStore = ReturnType<typeof createPresentationImageStore>;
