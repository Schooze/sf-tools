import React, { useState } from 'react';
import { REGISTERS, FIRMWARE_COMMIT } from '../../lib/config-model';
import { button, input } from '../common/DeviceUI';
export const ProtocolModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6">
      <div className="bg-surface border border-border rounded-2xl max-w-5xl w-full max-h-[85vh] overflow-auto p-6 space-y-4 text-xs">
        <div className="flex justify-between">
          <h2 className="text-base text-white font-semibold">SF-Motion 0.3.0 Protocol Reference</h2>
          <button className={button} onClick={onClose}>
            Close
          </button>
        </div>
        <p className="font-mono text-blue-300 select-text">
          A5 A5 | payload length (u8) | type (u8) | node (u8) | register (u8) | data
        </p>
        <p className="text-sf-muted">
          Length includes type, node, register and data. Little-endian values. No CRC or checksum.
          Types: 0 Response, 1 Read, 2 Write, 3 Enable stream, 4 Disable stream, 5 Streaming, 6
          Event. Writes return a signed status byte (0 success, negative failure). Events carry
          their code in the register byte.
        </p>
        <p className="text-sf-subtle">
          Maximum 10 streaming channels per node. Register 92 is a finite cogging acquisition.
          Schema pinned to {FIRMWARE_COMMIT.slice(0, 7)}.
        </p>
        <input
          aria-label="Search registers"
          className={input}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search register name or address"
        />
        <table className="w-full text-left">
          <thead className="text-sf-muted">
            <tr>
              {['Address', 'Register', 'Format', 'Access', 'Streaming', 'Notes'].map((h) => (
                <th className="p-2 border-b border-border" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGISTERS.filter((r) => (r.address + ' ' + r.name).includes(search.toLowerCase())).map(
              (r) => (
                <tr key={r.address} className="border-b border-border/50">
                  <td className="p-2 text-blue-300 font-mono">{r.address}</td>
                  <td className="p-2 text-white font-mono">{r.name}</td>
                  <td className="p-2 text-sf-muted">{r.format ?? 'Action'}</td>
                  <td className="p-2 text-sf-muted">
                    {r.read ? 'R' : ''}
                    {r.write ? 'W' : ''}
                  </td>
                  <td className="p-2 text-sf-muted">{r.streaming ? 'Yes' : '—'}</td>
                  <td className="p-2 text-sf-subtle">{r.note ?? ''}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
