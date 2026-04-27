'use client'

interface SendNowModalProps {
  open: boolean
  subject: string
  recipientCount: number
  senderName: string
  senderEmail: string
  onConfirm: () => void
  onCancel: () => void
}

export function SendNowModal({ open, subject, recipientCount, senderName, senderEmail, onConfirm, onCancel }: SendNowModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900">Send Now</h3>
        <p className="mt-2 text-sm text-gray-600">This will immediately start sending to all subscribers. This cannot be undone.</p>

        <div className="mt-4 rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subject</span>
            <span className="font-medium text-gray-900 truncate max-w-[200px]">{subject}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Recipients</span>
            <span className="font-medium text-gray-900">{recipientCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">From</span>
            <span className="font-medium text-gray-900">{senderName} &lt;{senderEmail}&gt;</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Send to {recipientCount.toLocaleString()} subscribers
          </button>
        </div>
      </div>
    </div>
  )
}
