const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// Lazy initialize S3 Client to avoid errors if AWS variables are missing and S3 is not used
let s3ClientInstance = null;
const getS3Client = () => {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      region: process.env.AWS_DEFAULT_REGION,
    });
  }
  return s3ClientInstance;
};

/**
 * Helper to generate a configured Multer uploader instance.
 *
 * @param {Object} options Configuration options
 * @param {string|Function} options.destination Target directory path or function returning the path
 * @param {string|Function} [options.prefix] Prefix for the filename or function returning the prefix
 * @param {number} [options.limitSize] File size limit in bytes (default: 10MB)
 * @param {boolean} [options.onlyImages] Restrict uploads to images only (default: false)
 * @param {Function} [options.fileFilter] Custom file filter function
 * @returns {multer.Multer} Configured Multer instance
 */
const createUploader = (options = {}) => {
  const {
    destination,
    prefix,
    limitSize = 10 * 1024 * 1024,
    onlyImages = false,
    fileFilter
  } = options;

  const useAWS = process.env.USE_AWS_STORAGE === 'true';
  let storage;

  if (useAWS) {
    const s3Storage = multerS3({
      s3: getS3Client(),
      bucket: process.env.AWS_BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        let uploadPath = typeof destination === 'function' ? destination(req, file) : destination;
        uploadPath = uploadPath || 'uploads';

        const absoluteCwd = path.resolve(process.cwd());
        const absolutePath = path.resolve(process.cwd(), uploadPath);
        let relativePath = path.relative(absoluteCwd, absolutePath).replace(/\\/g, '/');

        let filePrefix = typeof prefix === 'function' ? prefix(req, file) : prefix;
        filePrefix = filePrefix || file.fieldname;

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `${filePrefix}-${uniqueSuffix}${path.extname(file.originalname)}`;

        cb(null, `${relativePath}/${filename}`);
      }
    });

    // Intercept/wrap S3 storage _handleFile to inject filename for compatibility with existing controllers
    const originalHandleFile = s3Storage._handleFile;
    s3Storage._handleFile = function (req, file, cb) {
      originalHandleFile.call(this, req, file, (err, info) => {
        if (!err && info) {
          info.filename = path.basename(info.key);
        }
        cb(err, info);
      });
    };

    storage = s3Storage;
  } else {
    storage = multer.diskStorage({
      destination: (req, file, cb) => {
        let uploadPath = typeof destination === 'function' ? destination(req, file) : destination;
        uploadPath = uploadPath || 'uploads';

        // Resolve relative path to root directory
        if (!path.isAbsolute(uploadPath)) {
          uploadPath = path.resolve(process.cwd(), uploadPath);
        }

        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        let filePrefix = typeof prefix === 'function' ? prefix(req, file) : prefix;
        filePrefix = filePrefix || file.fieldname;

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${filePrefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    });
  }

  const defaultFileFilter = (req, file, cb) => {
    if (fileFilter) {
      return fileFilter(req, file, cb);
    }

    if (onlyImages) {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    } else {
      cb(null, true);
    }
  };

  return multer({
    storage,
    limits: {
      fileSize: limitSize
    },
    fileFilter: defaultFileFilter
  });
};

module.exports = createUploader;
