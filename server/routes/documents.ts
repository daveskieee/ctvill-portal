/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { broadcastChange } from '../events';

export const documentsRouter = Router();

export const SEED_DOCUMENTS = [
  {
    id: 'doc-arch-finishes-v2',
    title: 'Architectural Floor Plan & Interior Finishes Schedule v2.pdf',
    category: 'ARCHITECTURAL',
    fileUrl: '/documents/Architectural_Floor_Plan_Interior_Finishes_v2.pdf',
    fileSize: '12.4 MB',
    version: '2.0',
    status: 'APPROVED',
    uploadedBy: 'Ar. Jonathan Dela Cruz',
    notes: 'Architectural layout, ceiling reflected plan, and material specifications schedule.'
  },
  {
    id: 'doc-mepfs-singleline',
    title: 'MEPFS Single Line Diagram & Load Calculations.dwg',
    category: 'STRUCTURAL_PLAN', // mapped to MEPFS & Engineering
    fileUrl: '/documents/MEPFS_Single_Line_Diagram_Load_Calc.dwg',
    fileSize: '18.6 MB',
    version: '1.4',
    status: 'APPROVED',
    uploadedBy: 'Engr. Carlos Mendoza',
    notes: 'Electrical single-line diagram, HVAC load calculations, and sanitary plumbing layout.'
  },
  {
    id: 'doc-boq-prj4693',
    title: 'Detailed Bill of Quantities (BOQ) - PRJ-4693.xlsx',
    category: 'SPECIFICATIONS', // mapped to Excel Schedules & BOQ
    fileUrl: '/documents/Detailed_BOQ_PRJ_4693.xlsx',
    fileSize: '4.8 MB',
    version: '3.1',
    status: 'APPROVED',
    uploadedBy: 'Engr. Ricardo Ramos',
    notes: 'Full itemized turnkey fit-out bill of quantities with materials breakdown and labor costings.'
  },
  {
    id: 'doc-permit-barangay-clearance',
    title: 'Barangay & City Hall Building Clearance Endorsement.pdf',
    category: 'LGU_CLEARANCE', // mapped to Permits & Clearances
    fileUrl: '/documents/Barangay_City_Hall_Clearance_Endorsement.pdf',
    fileSize: '2.1 MB',
    version: '1.0',
    status: 'APPROVED',
    uploadedBy: 'Mauro R. Principe Jr.',
    notes: 'Approved local government building clearance and zoning endorsement certificate.'
  }
];

export async function ensureSeedDocuments() {
  try {
    for (const seed of SEED_DOCUMENTS) {
      const existing = await prisma.projectDocument.findFirst({
        where: {
          OR: [
            { id: seed.id },
            { title: seed.title },
            { category: seed.category }
          ]
        }
      });
      if (!existing) {
        await prisma.projectDocument.create({
          data: {
            id: seed.id,
            title: seed.title,
            category: seed.category as any,
            fileUrl: seed.fileUrl,
            fileSize: seed.fileSize,
            version: seed.version,
            status: seed.status as any,
            uploadedBy: seed.uploadedBy,
            notes: seed.notes
          }
        });
      }
    }
  } catch (err) {
    console.warn('ensureSeedDocuments warning:', err);
  }
}

// GET /api/documents or /documents
documentsRouter.get('/documents', async (req: Request, res: Response) => {
  try {
    await ensureSeedDocuments();
    const docs = await prisma.projectDocument.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET / when mounted under /api/documents
documentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    await ensureSeedDocuments();
    const docs = await prisma.projectDocument.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/documents
documentsRouter.post('/documents', async (req: Request, res: Response) => {
  const { title, category, fileUrl, fileSize, version, status, uploadedBy, notes } = req.body;
  try {
    const doc = await prisma.projectDocument.create({
      data: {
        title,
        category: category || 'CAD_DRAWING',
        fileUrl,
        fileSize: fileSize || '2.4 MB',
        version: version || '1.0',
        status: status || 'APPROVED',
        uploadedBy: uploadedBy || 'Ar. Jonathan Dela Cruz',
        notes,
      }
    });

    broadcastChange('documents');
    res.json(doc);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

documentsRouter.post('/', async (req: Request, res: Response) => {
  const { title, category, fileUrl, fileSize, version, status, uploadedBy, notes } = req.body;
  try {
    const doc = await prisma.projectDocument.create({
      data: {
        title,
        category: category || 'CAD_DRAWING',
        fileUrl,
        fileSize: fileSize || '2.4 MB',
        version: version || '1.0',
        status: status || 'APPROVED',
        uploadedBy: uploadedBy || 'Ar. Jonathan Dela Cruz',
        notes,
      }
    });

    broadcastChange('documents');
    res.json(doc);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default documentsRouter;
