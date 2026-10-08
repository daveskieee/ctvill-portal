/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Receipt } from 'lucide-react';

export interface RecordDisbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const RecordDisbursementModal: React.FC<RecordDisbursementModalProps> = ({
  isOpen,
  onClose,
  title = 'Record Contractor Disbursement',
  subtitle = 'Log invoice billing linked to verified roll-call audit',
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">{title}</h2>
              {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 pt-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default RecordDisbursementModal;
