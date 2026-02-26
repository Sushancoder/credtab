import type { Transaction } from '@/lib/types'

// Formats a number as Indian Rupees (e.g. 2400 → ₹2,400)
function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))
}

// Formats timestamp to time string (e.g. "2:30 PM")
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

type Props = {
  transaction: Transaction
  onEdit: (transaction: Transaction) => void
}

export default function TransactionBubble({ transaction, onEdit }: Props) {
  const { amount, note, created_at } = transaction

  const isGave = amount > 0   // You Gave (positive)
  const isGot = amount < 0    // You Got (negative)

  return (
    <div
      className={`flex ${isGot ? 'justify-end' : 'justify-start'} px-4`}
    >
      <button
        onClick={() => onEdit(transaction)}
        className={`
          max-w-[70%] rounded-xl px-4 py-2.5 text-left space-y-1
          transition-opacity active:opacity-70 cursor-pointer
          ${isGave
            ? 'bg-rose-50 dark:bg-rose-950/30'
            : 'bg-emerald-50 dark:bg-emerald-950/30'
          }
        `}
      >
        {/* Amount */}
        <p
          className={`text-base font-semibold ${
            isGave ? 'text-rose-600' : 'text-emerald-600'
          }`}
        >
          {formatINR(amount)}
        </p>

        {/* Note */}
        {note && (
          <p className="text-sm text-foreground/80">{note}</p>
        )}

        {/* Time + Label */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatTime(created_at)}
          </span>
          <span
            className={`text-xs font-medium ${
              isGave ? 'text-rose-500' : 'text-emerald-500'
            }`}
          >
            {isGave ? 'YOU GAVE' : 'YOU GOT'}
          </span>
        </div>
      </button>
    </div>
  )
}
