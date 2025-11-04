// src/components/Modal.jsx
export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border w-full max-w-2xl p-4">
        {children}
      </div>
    </div>
  );
}
