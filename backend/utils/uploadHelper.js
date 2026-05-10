const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  jpeg: {
    mime: 'image/jpeg',
    extensions: new Set(['.jpg', '.jpeg', '.jfif']),
    outputExtension: '.jpg'
  },
  png: {
    mime: 'image/png',
    extensions: new Set(['.png']),
    outputExtension: '.png'
  },
  gif: {
    mime: 'image/gif',
    extensions: new Set(['.gif']),
    outputExtension: '.gif'
  },
  webp: {
    mime: 'image/webp',
    extensions: new Set(['.webp']),
    outputExtension: '.webp'
  }
};

const ALLOWED_EXTENSIONS = new Set(
  Object.values(IMAGE_TYPES).flatMap((type) => [...type.extensions])
);

const ALLOWED_MIMES = new Set(
  Object.values(IMAGE_TYPES).map((type) => type.mime)
);

const SCRIPTABLE_EXTENSIONS = new Set([
  '.svg',
  '.svgz',
  '.html',
  '.htm',
  '.xhtml',
  '.xml',
  '.mhtml',
  '.mht'
]);

class UploadValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'UploadValidationError';
    this.statusCode = statusCode;
  }
}

function getSafeUploadDirectory(subdirectory = '') {
  const uploadDir = path.resolve(UPLOAD_ROOT, subdirectory);
  const uploadRoot = path.resolve(UPLOAD_ROOT);

  if (uploadDir !== uploadRoot && !uploadDir.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new Error('Invalid upload directory.');
  }

  return uploadDir;
}

function getOriginalExtension(file) {
  return path.extname(file?.originalname || '').toLowerCase();
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { key: 'jpeg', ...IMAGE_TYPES.jpeg };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { key: 'png', ...IMAGE_TYPES.png };
  }

  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString('ascii');
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return { key: 'gif', ...IMAGE_TYPES.gif };
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { key: 'webp', ...IMAGE_TYPES.webp };
  }

  return null;
}

function validateDeclaredImage(file) {
  const extension = getOriginalExtension(file);

  if (SCRIPTABLE_EXTENSIONS.has(extension)) {
    throw new UploadValidationError('Scriptable upload formats are not allowed.');
  }

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new UploadValidationError('Only JPG, PNG, GIF, and WEBP images are allowed.');
  }

  if (!ALLOWED_MIMES.has(file?.mimetype)) {
    throw new UploadValidationError('Invalid image MIME type.');
  }
}

function validateImageContents(file) {
  validateDeclaredImage(file);

  const detected = detectImageType(file.buffer);
  if (!detected) {
    throw new UploadValidationError('Uploaded file content is not a supported image.');
  }

  const extension = getOriginalExtension(file);
  if (!detected.extensions.has(extension)) {
    throw new UploadValidationError('Image file extension does not match the file content.');
  }

  if (file.mimetype !== detected.mime) {
    throw new UploadValidationError('Image MIME type does not match the file content.');
  }

  return detected;
}

function randomFileName(extension, prefix = '') {
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  const safePrefix = String(prefix || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);

  return `${safePrefix ? `${safePrefix}-` : ''}${id}${extension}`;
}

function flattenUploadedFiles(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files).flat().filter(Boolean);
  }
  return [];
}

async function persistUploadedFiles(req, { uploadDir, filenamePrefix }) {
  const files = flattenUploadedFiles(req);
  if (!files.length) return;

  await fs.promises.mkdir(uploadDir, { recursive: true });

  const writtenPaths = [];
  try {
    for (const file of files) {
      const detected = validateImageContents(file);
      const prefix = typeof filenamePrefix === 'function' ? filenamePrefix(req, file) : filenamePrefix;
      const filename = randomFileName(detected.outputExtension, prefix);
      const filePath = path.join(uploadDir, filename);

      await fs.promises.writeFile(filePath, file.buffer, { flag: 'wx' });
      writtenPaths.push(filePath);

      file.destination = uploadDir;
      file.filename = filename;
      file.path = filePath;
      file.size = file.buffer.length;
      file.mimetype = detected.mime;
      delete file.buffer;
    }
  } catch (error) {
    await Promise.all(writtenPaths.map((filePath) => fs.promises.unlink(filePath).catch(() => {})));
    throw error;
  }
}

function sendUploadError(error, res) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Uploaded image is too large.' });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message || 'Invalid file upload.' });
  }

  if (error instanceof UploadValidationError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error('Upload processing failed:', error);
  return res.status(500).json({ message: 'Failed to process uploaded image.' });
}

function createImageUpload(options = {}) {
  const uploadDir = getSafeUploadDirectory(options.subdirectory || '');
  const maxFileSizeBytes = options.maxFileSizeBytes || DEFAULT_MAX_IMAGE_SIZE_BYTES;

  const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSizeBytes
    },
    fileFilter(_req, file, cb) {
      try {
        validateDeclaredImage(file);
        cb(null, true);
      } catch (error) {
        cb(error);
      }
    }
  });

  function wrap(middleware) {
    return (req, res, next) => {
      middleware(req, res, async (error) => {
        if (error) {
          return sendUploadError(error, res);
        }

        try {
          await persistUploadedFiles(req, {
            uploadDir,
            filenamePrefix: options.filenamePrefix
          });
          return next();
        } catch (persistError) {
          return sendUploadError(persistError, res);
        }
      });
    };
  }

  return {
    single(fieldName) {
      return wrap(multerUpload.single(fieldName));
    },
    array(fieldName, maxCount) {
      return wrap(multerUpload.array(fieldName, maxCount));
    },
    fields(fields) {
      return wrap(multerUpload.fields(fields));
    }
  };
}

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIMES,
  DEFAULT_MAX_IMAGE_SIZE_BYTES,
  SCRIPTABLE_EXTENSIONS,
  UploadValidationError,
  createImageUpload,
  detectImageType
};
