"use client"

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
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
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Determine direction: "gave" or "got"
  const direction = mode === 'add'
    ? type!
    : transaction!.amount > 0 ? 'gave' : 'got'

  // Pre-fill fields when editing, reset when closing
  useEffect(() => {
    if (open && mode === 'edit' && transaction) {
      setAmount(String(Math.abs(transaction.amount)))
      setNote(transaction.note ?? '')
    }
    if (!open) {
      setAmount('')
      setNote('')
      setError('')
      setLoading(false)
      setDeleting(false)
    }
  }, [open, mode, transaction])

  // Build title
  const title = mode === 'add'
    ? `You ${direction === 'gave' ? 'Gave to' : 'Got from'} ${contactName}`
    : 'Edit Transaction'

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
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="px-4 pt-2 pb-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-4">
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
              onChange={(e) => setNote(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Direction indicator (display only) */}
          <div className="flex items-center gap-2 pt-1">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                direction === 'gave' ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {direction === 'gave' ? 'You Gave (Credit)' : 'You Got (Payment)'}
            </span>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-rose-500">{error}</p>}

          {/* Submit */}
          <SheetFooter className="px-0 pb-0 pt-2 flex-col gap-3">
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
