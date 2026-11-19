/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';

export const uploadRouter = Router();

// Persistent disk storage directory for uploaded assets
export const UPLOADS_DIR = path.resolve(process.cwd(), 'server', 'uploads');

// Ensure upload directory exists on initialization
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Disallowed executable / dangerous file extensions
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.pl', '.cgi', 
  '.py', '.rb', '.jar', '.vbs', '.msi', '.com', '.scr', '.pif'
]);

// Configure Multer Disk Storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${uniqueSuffix}_${baseName}${ext}`);
  }
});

// 50 MB limit matches project documents & CAD drawing capacity
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type ${ext} is restricted for security reasons.`));
    }
    cb(null, true);
  }
});

// Apply authentication to upload operations
uploadRouter.use('/upload', requireAuth);

/**
 * POST /api/upload
 * Single file upload handler. Saves to disk and returns lightweight relative URL.
 */
uploadRouter.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File size exceeds maximum allowable limit of 50 MB.'
          });
        }
        return res.status(400).json({ error: err.message || 'File upload failed.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file was provided in the upload request.' });
      }

      const relativeUrl = `/uploads/${req.file.filename}`;
      return res.json({
        success: true,
        url: relativeUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    });
  }
);

/**
 * POST /api/upload/multiple
 * Multi-file batch upload handler.
 */
uploadRouter.post(
  '/upload/multiple',
  (req: Request, res: Response) => {
    upload.array('files', 10)(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'One or more files exceed the maximum allowable limit of 50 MB.'
          });
        }
        return res.status(400).json({ error: err.message || 'File upload failed.' });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'No files provided.' });
      }

      const results = files.map((file) => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      }));

      return res.json({
        success: true,
        count: results.length,
        files: results
      });
    });
  }
);

/**
 * POST /api/upload/base64
 * Decodes base64 data URLs (e.g. from canvas or avatars) and saves to persistent disk,
 * returning lightweight `/uploads/<filename>` instead of bloating database.
 */
uploadRouter.post('/upload/base64', async (req: Request, res: Response) => {
  try {
    const { dataUrl, filename } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Valid dataUrl string required.' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid data URL format.' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'Payload exceeds 50 MB limit.' });
    }

    let ext = '.png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('pdf')) ext = '.pdf';

    const safeBaseName = (filename || 'capture')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeBaseName}${ext}`;
    const destinationPath = path.join(UPLOADS_DIR, uniqueName);

    await fs.promises.writeFile(destinationPath, buffer);

    return res.json({
      success: true,
      url: `/uploads/${uniqueName}`,
      filename: uniqueName,
      size: buffer.length,
      mimeType
    });
  } catch (error: any) {
    console.error('Base64 upload error:', error);
    return res.status(500).json({ error: 'Failed to process base64 upload.' });
  }
});
