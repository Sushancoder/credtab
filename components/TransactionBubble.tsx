import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import type { Transaction } from '@/lib/types'

// Formats a number as Indian Rupees (e.g. 2400 → ₹2,400)
function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))
}

// Formats timestamp to time string (e.g. "2:30 PM").
// Returns null if the time is exactly 00:00:00 UTC (date-only entries).
function formatTime(dateStr: string): string | null {
  const d = new Date(dateStr)
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return null
  }
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatBalance(balance: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(balance))
}

type Props = {
  transaction: Transaction
  onEdit: (transaction: Transaction) => void
  runningBalance: number
}

export default function TransactionBubble({ transaction, onEdit, runningBalance }: Props) {
  const { amount, note, created_at, is_deleted } = transaction

  const isGave = amount > 0
  const isGot = amount < 0

  // --- Deleted transaction: greyed out, not clickable ---
  if (is_deleted) {
    return (
      <div className={`flex flex-col ${isGave ? 'items-end' : 'items-start'} px-4 gap-0.5`}>
        <div className="max-w-[70%] rounded-xl px-4 py-2.5 bg-muted/50 border border-border/50 space-y-1 opacity-60">
          {/* Deleted label */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Trash2 className="w-3 h-3 shrink-0" />
            <span className="text-xs font-medium">Payment Deleted</span>
          </div>
          {/* Strikethrough amount */}
          <p className="text-sm text-muted-foreground line-through">
            {formatINR(amount)}
          </p>
          {/* Time */}
          {formatTime(created_at) && (
            <span className="text-xs text-muted-foreground">
              {formatTime(created_at)}
            </span>
          )}
        </div>
      </div>
    )
  }

  // --- Normal transaction bubble ---
  return (
    <div className={`flex flex-col ${isGave ? 'items-end' : 'items-start'} px-4 gap-0.5`}>
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
        {/* Amount + Arrow */}
        <div className={`flex items-center gap-1.5 ${isGave ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isGave
            ? <ArrowUp className="w-3.5 h-3.5 shrink-0" />
            : <ArrowDown className="w-3.5 h-3.5 shrink-0" />
          }
          <p className="text-base font-semibold">
            {formatINR(amount)}
          </p>
        </div>

        {/* Note */}
        {note && (
          <p className="text-sm text-foreground/80">{note}</p>
        )}

        {/* Time */}
        {formatTime(created_at) && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatTime(created_at)}
            </span>
          </div>
        )}
      </button>

      {/* Running balance below the bubble */}
      {runningBalance !== 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {formatBalance(runningBalance)}{' '}
          <span className={runningBalance > 0 ? 'text-emerald-600' : 'text-rose-500'}>
            {runningBalance > 0 ? 'Advance' : 'Due'}
          </span>
        </p>
      )}
      {runningBalance === 0 && (
        <p className="text-xs text-muted-foreground px-1">Settled</p>
      )}
    </div>
  )
}
