import React from 'react';
import { Host } from '../types';
import { SftpPanel } from './SftpPanel';

interface SftpExplorerProps {
  host: Host;
  onClose: () => void;
}

export const SftpExplorer: React.FC<SftpExplorerProps> = ({ host, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <SftpPanel host={host} onClose={onClose} isEmbedded={false} />
      </div>
    </div>
  );
};
