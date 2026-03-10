"use client"

import { useState, useEffect } from 'react'
import { Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { addTransaction, updateTransaction, deleteTransaction } from '@/lib/transactions'
import type { Transaction } from '@/lib/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
} & (
    | { mode: 'add'; type: 'gave' | 'got'; transaction?: never }
    | { mode: 'edit'; transaction: Transaction; type?: never }
  )

// Callbacks after success
type Callbacks = {
  onAdded: (transaction: Transaction) => void
  onUpdated: (transaction: Transaction) => void
  onDeleted: (transactionId: string) => void
}

export default function TransactionSheet({
  open,
  onOpenChange,
  mode,
  type,
  transaction,
  contactId,
  contactName,
  onAdded,
  onUpdated,
  onDeleted,
}: Props & Callbacks) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [direction, setDirection] = useState<'gave' | 'got'>(
    mode === 'add' ? type! : transaction!.amount > 0 ? 'gave' : 'got'
  )
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill fields when editing, reset when closing
  useEffect(() => {
    if (open && mode === 'edit' && transaction) {
      setAmount(String(Math.abs(transaction.amount)))
      setNote(transaction.note ?? '')
      setDirection(transaction.amount > 0 ? 'gave' : 'got')
    }
    if (open && mode === 'add') {
      setDirection(type!)
    }
    if (!open) {
      setAmount('')
      setNote('')
      setError('')
      setLoading(false)
      setDeleting(false)
    }
  }, [open, mode, transaction, type])

  // Build title — updates live as direction changes
  const title = `You ${direction === 'gave' ? 'Gave to' : 'Got from'} ${contactName}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const numAmount = parseFloat(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Enter a valid amount.')
      return
    }

    setLoading(true)
    setError('')

    // Apply sign: positive for "gave", negative for "got"
    const signedAmount = direction === 'gave' ? numAmount : -numAmount

    if (mode === 'add') {
      const { transaction: newTxn, error: addError } = await addTransaction({
        contact_id: contactId,
        amount: signedAmount,
        note: note.trim() || undefined,
      })

      if (addError || !newTxn) {
        setError('Failed to save. Please try again.')
        setLoading(false)
        return
      }

      onAdded(newTxn)
    } else {
      const { transaction: updatedTxn, error: updateError } = await updateTransaction(
        transaction!.id,
        { amount: signedAmount, note: note.trim() || undefined }
      )

      if (updateError || !updatedTxn) {
        setError('Failed to update. Please try again.')
        setLoading(false)
        return
      }

      onUpdated(updatedTxn)
    }

    onOpenChange(false)
    setLoading(false)
  }

  async function handleDelete() {
    if (!transaction) return

    setDeleting(true)
    const { error: delError } = await deleteTransaction(transaction.id)

    if (delError) {
      setError('Failed to delete. Please try again.')
      setDeleting(false)
      return
    }

    onDeleted(transaction.id)
    onOpenChange(false)
    setDeleting(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl flex flex-col max-h-[90dvh]">
        <SheetHeader className="px-4 pt-2 pb-0 shrink-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="txn-amount">
                Amount <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  id="txn-amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  autoFocus
                  min="0"
                  step="any"
                  autoComplete="off"
                  inputMode="decimal"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="txn-note">
                Note <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="txn-note"
                placeholder="e.g. Monthly stock payment"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                autoComplete="off"
                maxLength={500}
                inputMode="text"
              />
              {note.length > 0 && (
                <p className={`text-xs text-right tabular-nums ${note.length >= 500 ? 'text-rose-500' : 'text-muted-foreground'
                  }`}>
                  {note.length} / 500
                </p>
              )}
            </div>

            {/* Direction toggle — edit mode only */}
            {mode === 'edit' && (
              <div className="grid grid-cols-2 rounded-xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDirection('got')}
                  className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${direction === 'got'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Received
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('gave')}
                  className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-border ${direction === 'gave'
                    ? 'bg-rose-500 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Given
                </button>
              </div>
            )}

            {/* Error */}
            {error && <p className="text-sm text-rose-500">{error}</p>}
          </div>

          {/* Sticky footer — always visible above keyboard */}
          <SheetFooter className="px-4 pt-3 pb-8 shrink-0 flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || deleting}
            >
              {loading
                ? 'Saving...'
                : mode === 'add'
                  ? 'Save'
                  : 'Update Transaction'
              }
            </Button>

            {/* Delete option (edit mode only) */}
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || loading}
                className="flex items-center justify-center gap-2 text-sm text-rose-500 hover:text-rose-600 transition-colors py-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete this transaction'}
              </button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
