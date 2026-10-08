/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, FileSpreadsheet } from 'lucide-react';

export interface ChangeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
}

export const ChangeOrderModal: React.FC<ChangeOrderModalProps> = ({
  isOpen,
  onClose,
  title = 'Raise Scope Change Order',
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full space-y-4 animate-scaleUp overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-800">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            {title}
          </h4>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ChangeOrderModal;
