"use client"

import { AlertTriangle } from "lucide-react"

export default function ConfirmModal({
  title, body, confirmLabel = "Delete", onConfirm, onCancel,
}: {
  title: string
  body: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="overlay" onMouseDown={onCancel}>
      <div className="modal confirm-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-body confirm-body">
          <div className="confirm-icon"><AlertTriangle size={18} /></div>
          <div>
            <h2 className="confirm-title">{title}</h2>
            <p className="confirm-text">{body}</p>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn danger solid" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
