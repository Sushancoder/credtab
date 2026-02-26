"use client"

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getTransactions } from '@/lib/transactions'
import type { Transaction } from '@/lib/types'
import TransactionBubble from '@/components/TransactionBubble'
import TransactionSheet from '@/components/TransactionSheet'

// Format number as ₹ INR
function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))
}

// Format date for group headers (e.g. "20 Feb 2026")
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Group transactions by date
function groupByDate(transactions: Transaction[]) {
  const groups: { date: string; items: Transaction[] }[] = []
  let currentDate = ''

  for (const txn of transactions) {
    const date = formatDate(txn.created_at)
    if (date !== currentDate) {
      currentDate = date
      groups.push({ date, items: [txn] })
    } else {
      groups[groups.length - 1].items.push(txn)
    }
  }

  return groups
}

type ContactInfo = {
  id: string
  name: string
  type: 'customer' | 'supplier'
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add')
  const [sheetType, setSheetType] = useState<'gave' | 'got'>('gave')
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)

  // Fetch contact info + transactions on mount
  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Fetch contact details
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, name, type')
        .eq('id', params.id)
        .single()

      if (contactData) setContact(contactData)

      // Fetch transactions
      const txns = await getTransactions(params.id)
      setTransactions(txns)
      setLoading(false)
    }
    load()
  }, [params.id])

  // Scroll to bottom when transactions load or new one added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transactions])

  // Calculate balance from loaded transactions
  const balance = useMemo(() => {
    return transactions.reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  // Group transactions by date for display
  const grouped = useMemo(() => groupByDate(transactions), [transactions])

  // -- Sheet Actions --

  function openAddSheet(type: 'gave' | 'got') {
    setSheetMode('add')
    setSheetType(type)
    setEditingTxn(null)
    setSheetOpen(true)
  }

  function openEditSheet(txn: Transaction) {
    setSheetMode('edit')
    setEditingTxn(txn)
    setSheetOpen(true)
  }

  function handleAdded(txn: Transaction) {
    setTransactions((prev) => [...prev, txn])
  }

  function handleUpdated(updated: Transaction) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    )
  }

  function handleDeleted(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center max-w-lg mx-auto">
        <p className="text-sm text-muted-foreground">Contact not found.</p>
        <button
          onClick={() => router.push('/')}
          className="text-sm text-primary mt-2 underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">

      {/* Header */}
      <header className="px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{contact.name}</h1>
          </div>
        </div>

        {/* Balance summary */}
        <div className="ml-11 mt-1">
          <span
            className={`text-sm font-semibold ${
              balance > 0
                ? 'text-rose-500'
                : balance < 0
                  ? 'text-emerald-600'
                  : 'text-muted-foreground'
            }`}
          >
            {balance === 0 ? 'Settled up' : formatINR(balance)}
          </span>
          {balance !== 0 && (
            <span className="text-xs text-muted-foreground ml-1.5">
              {balance > 0 ? 'You will get' : 'You will give'}
            </span>
          )}
        </div>
      </header>

      {/* Transaction List (scrollable) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3 pb-24">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <p className="text-sm text-muted-foreground">
              No transactions yet.{'\n'}Tap the buttons below to record one.
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date} className="space-y-3">
              {/* Date Divider */}
              <div className="flex items-center justify-center py-2">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>

              {/* Bubbles */}
              {group.items.map((txn) => (
                <TransactionBubble
                  key={txn.id}
                  transaction={txn}
                  onEdit={openEditSheet}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3 z-10">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={() => openAddSheet('gave')}
            className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-medium text-sm hover:bg-rose-600 active:scale-[0.98] transition-all"
          >
            YOU GAVE
          </button>
          <button
            onClick={() => openAddSheet('got')}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 active:scale-[0.98] transition-all"
          >
            YOU GOT
          </button>
        </div>
      </div>

      {/* Transaction Sheet (Add / Edit) */}
      {sheetOpen && (
        sheetMode === 'add' ? (
          <TransactionSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            mode="add"
            type={sheetType}
            contactId={contact.id}
            contactName={contact.name}
            onAdded={handleAdded}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ) : editingTxn ? (
          <TransactionSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            mode="edit"
            transaction={editingTxn}
            contactId={contact.id}
            contactName={contact.name}
            onAdded={handleAdded}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ) : null
      )}
    </div>
  )
}
