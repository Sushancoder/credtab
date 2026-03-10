"use client"

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MoreVertical, Eye, Pencil, Trash2, User, Phone, Tag, Calendar, ArrowDown, ArrowUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getTransactions } from '@/lib/transactions'
import { deleteContact, updateContact } from '@/lib/contacts'
import type { Contact, Transaction } from '@/lib/types'
import TransactionBubble from '@/components/TransactionBubble'
import TransactionSheet from '@/components/TransactionSheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

type ContactInfo = Omit<Contact, 'balance'>

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  // Sheet state (transaction)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add')
  const [sheetType, setSheetType] = useState<'gave' | 'got'>('gave')
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)

  // 3-dot menu states
  const [infoOpen, setInfoOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editType, setEditType] = useState<'customer' | 'supplier'>('customer')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Fetch contact info + transactions
  async function loadContact() {
    setLoading(true)
    setFetchError(false)

    try {
      const supabase = createClient()

      // Fetch contact details
      const { data: contactData, error } = await supabase
        .from('contacts')
        .select('id, name, phone, type, created_at')
        .eq('id', params.id)
        .single()

      if (error) {
        setFetchError(true)
        setLoading(false)
        return
      }

      if (contactData) setContact(contactData)

      // Fetch transactions
      const txns = await getTransactions(params.id)
      setTransactions(txns)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }

  // Load on mount
  useEffect(() => {
    loadContact()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  // Scroll to bottom when transactions load or new one added
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 100)
    return () => clearTimeout(timer)
  }, [transactions])

  // Calculate balance from loaded transactions
  const balance = useMemo(() => {
    return transactions.reduce((sum, t) => t.is_deleted ? sum : sum + t.amount, 0)
  }, [transactions])

  // Pair each transaction with its cumulative running balance (deleted txns don't move the needle)
  const transactionsWithBalance = useMemo(() => {
    let running = 0
    return transactions.map((t) => {
      if (!t.is_deleted) running += t.amount
      return { transaction: t, runningBalance: running }
    })
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
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_deleted: true } : t))
    )
  }

  // -- Contact Menu Actions --

  function openEditContact() {
    if (!contact) return
    setEditName(contact.name)
    setEditPhone(contact.phone || '')
    setEditType(contact.type)
    setEditError('')
    setEditOpen(true)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contact) return
    if (!editName.trim()) {
      setEditError('Name is required.')
      return
    }

    setEditLoading(true)
    setEditError('')

    const { contact: updated, error } = await updateContact(contact.id, {
      name: editName.trim(),
      phone: editPhone.trim() || undefined,
      type: editType,
    })

    if (error || !updated) {
      setEditError('Failed to update contact.')
      setEditLoading(false)
      return
    }

    setContact({ ...contact, name: updated.name, phone: updated.phone, type: updated.type })
    setEditOpen(false)
    setEditLoading(false)
  }

  async function handleDeleteContact() {
    if (!contact) return
    setDeleting(true)

    const { error } = await deleteContact(contact.id)

    if (error) {
      setDeleting(false)
      return
    }

    router.push('/')
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

  if (fetchError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center max-w-lg mx-auto gap-2">
        <p className="text-sm text-muted-foreground">Something went wrong.</p>
        <button
          onClick={loadContact}
          className="text-sm text-primary underline"
        >
          Retry
        </button>
        <button
          onClick={() => router.push('/')}
          className="text-sm text-muted-foreground underline"
        >
          Go back
        </button>
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

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors shrink-0"
                aria-label="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setInfoOpen(true)}>
                <Eye className="w-4 h-4 mr-2" />
                View Info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openEditContact}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Contact
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-rose-500 focus:text-rose-500"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Balance summary */}
        <div className="ml-11 mt-1">
          <span
            className={`text-sm font-semibold ${balance > 0
              ? 'text-emerald-600'
              : balance < 0
                ? 'text-rose-500'
                : 'text-muted-foreground'
              }`}
          >
            {balance === 0 ? 'Settled up' : formatINR(balance)}
          </span>
          {balance !== 0 && (
            <span className="text-xs text-muted-foreground ml-1.5">
              {balance > 0 ? 'Advance' : 'Due'}
            </span>
          )}
        </div>
      </header>

      {/* Transaction List (scrollable) */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 pb-24">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <p className="text-sm text-muted-foreground">
              No transactions yet.<br />Tap the buttons below to record one.
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
              {group.items.map((txn) => {
                const entry = transactionsWithBalance.find((e) => e.transaction.id === txn.id)
                return (
                  <TransactionBubble
                    key={txn.id}
                    transaction={txn}
                    onEdit={openEditSheet}
                    runningBalance={entry?.runningBalance ?? 0}
                  />
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 flex justify-center">
        <div className="w-full max-w-lg bg-background border-t border-border px-4 py-3">
          <div className="flex gap-3">
            <button
              onClick={() => openAddSheet('got')}
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowDown className="w-4 h-4" />
              Received
            </button>
            <button
              onClick={() => openAddSheet('gave')}
              className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-medium text-sm hover:bg-rose-600 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowUp className="w-4 h-4" />
              Given
            </button>
          </div>
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

      {/* View Info Dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Contact Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{contact.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{contact.phone || 'Not added'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium capitalize">{contact.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Added on</p>
                <p className="text-sm font-medium">
                  {new Date(contact.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="px-4 pt-2 pb-0">
            <SheetTitle>Edit Contact</SheetTitle>
          </SheetHeader>

          <form onSubmit={handleEditSubmit} className="px-4 pt-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="edit-contact-name">
                Name <span className="text-rose-500">*</span>
              </label>
              <Input
                id="edit-contact-name"
                placeholder="e.g. Ramesh Kumar"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="edit-contact-phone">
                Phone <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="edit-contact-phone"
                placeholder="e.g. 9876543210"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Error */}
            {editError && <p className="text-sm text-rose-500">{editError}</p>}

            {/* Type Toggle */}
            <div className="pt-2">
              <p className="text-sm font-medium mb-2">Type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditType('customer')}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${editType === 'customer'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setEditType('supplier')}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${editType === 'supplier'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                >
                  Supplier
                </button>
              </div>
            </div>

            <SheetFooter className="px-0 pb-0 pt-2">
              <Button type="submit" className="w-full" disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Update Contact'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{contact.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the contact and hide all associated transactions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={deleting}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
