"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, ArrowDown, ArrowUp, Plus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getContacts, bulkAddContacts } from '@/lib/contacts'
import { bulkAddTransactions } from '@/lib/transactions'
import { getAvatarColor } from '@/lib/avatar'
import type { Contact } from '@/lib/types'
import type { ExtractedLedger, ReviewLedger, ReviewContact, ReviewTransaction } from '@/lib/import-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
    return new Date().toISOString().split('T')[0]
}

function buildReviewLedger(extracted: ExtractedLedger, existing: Contact[]): ReviewLedger {
    const existingMap = new Map(
        existing.map((c) => [c.name.toLowerCase().trim(), c])
    )

    return {
        contacts: extracted.contacts.map((c) => {
            const match = existingMap.get(c.name.toLowerCase().trim())
            return {
                localId: crypto.randomUUID(),
                name: c.name,
                phone: c.phone ?? null,
                type: (c.type === 'customer' || c.type === 'supplier') ? c.type : 'customer',
                isNew: !match,
                existingContactId: match?.id,
                transactions: c.transactions.map((t) => ({
                    localId: crypto.randomUUID(),
                    direction: t.direction,
                    amount: t.amount,
                    date: t.date ?? todayISO(),
                    note: t.note ? t.note.slice(0, 500) : null,
                })),
            }
        }),
    }
}

function totalTransactions(ledger: ReviewLedger) {
    return ledger.contacts.reduce((sum, c) => sum + c.transactions.length, 0)
}

// ─── Validation ───────────────────────────────────────────────────────────────

type TxErrors = { amount?: string; note?: string }
type ContactErrors = { name?: string; transactions: Record<string, TxErrors> }
type LedgerErrors = Record<string, ContactErrors>

function validateLedger(ledger: ReviewLedger): LedgerErrors {
    const errors: LedgerErrors = {}
    for (const c of ledger.contacts) {
        const ce: ContactErrors = { transactions: {} }
        if (!c.name.trim()) ce.name = 'Name is required'
        for (const tx of c.transactions) {
            const txErr: TxErrors = {}
            if (!tx.amount || tx.amount <= 0) txErr.amount = 'Enter an amount greater than 0'
            if (tx.note && tx.note.length > 500) txErr.note = 'Note must be 500 characters or fewer'
            if (Object.keys(txErr).length > 0) ce.transactions[tx.localId] = txErr
        }
        if (ce.name || Object.keys(ce.transactions).length > 0) {
            errors[c.localId] = ce
        }
    }
    return errors
}

function hasErrors(errors: LedgerErrors) {
    return Object.keys(errors).length > 0
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type TransactionRowProps = {
    tx: ReviewTransaction
    errors?: TxErrors
    onChange: (field: keyof ReviewTransaction, value: string | number) => void
    onDelete: () => void
}

function TransactionRow({ tx, errors, onChange, onDelete }: TransactionRowProps) {
    const isGave = tx.direction === 'gave'

    return (
        <div className="flex flex-col gap-2 py-3 border-t border-border first:border-t-0">
            {/* Row 1: Direction toggle + Amount */}
            <div className="flex items-center gap-2">
                {/* Direction toggle */}
                <button
                    type="button"
                    onClick={() => onChange('direction', isGave ? 'got' : 'gave')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${isGave
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        }`}
                    title="Tap to flip direction"
                >
                    {isGave
                        ? <ArrowUp className="w-3 h-3" />
                        : <ArrowDown className="w-3 h-3" />
                    }
                    {isGave ? 'Gave' : 'Got'}
                </button>

                {/* Amount */}
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input
                        type="number"
                        min={0}
                        step="any"
                        value={tx.amount}
                        onChange={(e) => onChange('amount', parseFloat(e.target.value) || 0)}
                        className={`pl-7 h-9 text-sm ${errors?.amount ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
                        placeholder="0"
                    />
                    {errors?.amount && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{errors.amount}</p>
                    )}
                </div>

                {/* Delete */}
                <button
                    type="button"
                    onClick={onDelete}
                    className="w-8 h-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    aria-label="Delete transaction"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Row 2: Date + Note */}
            <div className="flex items-center gap-2 pl-0">
                <Input
                    type="date"
                    value={tx.date}
                    onChange={(e) => onChange('date', e.target.value)}
                    className="h-9 text-sm flex-1"
                />
                <div className="flex-1 flex flex-col gap-0.5">
                    <Input
                        type="text"
                        value={tx.note ?? ''}
                        onChange={(e) => onChange('note', e.target.value.slice(0, 500))}
                        placeholder="Note (optional)"
                        maxLength={500}
                        className={`h-9 text-sm ${errors?.note ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
                    />
                    {(tx.note?.length ?? 0) > 0 && (
                        <p className={`text-[10px] text-right tabular-nums ${(tx.note?.length ?? 0) >= 500 ? 'text-rose-500' : 'text-muted-foreground'
                            }`}>
                            {tx.note?.length ?? 0} / 500
                        </p>
                    )}
                    {errors?.note && (
                        <p className="text-[10px] text-rose-500">{errors.note}</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────

type ContactCardProps = {
    contact: ReviewContact
    index: number
    errors?: ContactErrors
    onUpdateContact: (field: keyof ReviewContact, value: string) => void
    onUpdateTransaction: (txLocalId: string, field: keyof ReviewTransaction, value: string | number) => void
    onDeleteTransaction: (txLocalId: string) => void
    onDeleteContact: () => void
    onAddTransaction: () => void
}

function ContactCard({
    contact,
    index,
    errors,
    onUpdateContact,
    onUpdateTransaction,
    onDeleteTransaction,
    onDeleteContact,
    onAddTransaction,
}: ContactCardProps) {
    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Contact header */}
            <div className="px-4 pt-4 pb-3 space-y-3">
                {/* Name row */}
                <div className="flex items-start gap-2">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white mt-0.5 ${getAvatarColor(contact.name || '')}`}>
                        {(contact.name.trim().charAt(0) || '?').toUpperCase()}
                    </div>

                    <div className="flex-1 space-y-2">
                        {/* Name + new badge */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    value={contact.name}
                                    onChange={(e) => onUpdateContact('name', e.target.value)}
                                    placeholder="Contact name"
                                    className={`h-9 text-sm font-medium ${errors?.name ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
                                />
                                {errors?.name && (
                                    <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>
                                )}
                            </div>
                            {contact.isNew && (
                                <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                                    new
                                </span>
                            )}
                        </div>

                        {/* Phone */}
                        <Input
                            value={contact.phone ?? ''}
                            onChange={(e) => onUpdateContact('phone', e.target.value)}
                            placeholder="Phone (optional)"
                            type="tel"
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Delete contact */}
                    <button
                        type="button"
                        onClick={onDeleteContact}
                        className="w-8 h-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors mt-0.5"
                        aria-label="Remove contact"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-2">
                    {(['customer', 'supplier'] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => onUpdateContact('type', t)}
                            className={`py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${contact.type === t
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground border-border hover:bg-muted'
                                }`}
                        >
                            {t === 'customer' ? 'Customer' : 'Supplier'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transaction list */}
            <div className="px-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                    Transactions ({contact.transactions.length})
                </p>
                {contact.transactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No transactions</p>
                ) : (
                    contact.transactions.map((tx) => (
                        <TransactionRow
                            key={tx.localId}
                            tx={tx}
                            errors={errors?.transactions[tx.localId]}
                            onChange={(field, value) => onUpdateTransaction(tx.localId, field, value)}
                            onDelete={() => onDeleteTransaction(tx.localId)}
                        />
                    ))
                )}

                {/* Add transaction */}
                <button
                    type="button"
                    onClick={onAddTransaction}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add transaction
                </button>
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
    const router = useRouter()
    const [ledger, setLedger] = useState<ReviewLedger | null>(null)
    const [existingContacts, setExistingContacts] = useState<Contact[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [tipsOpen, setTipsOpen] = useState(false)

    useEffect(() => {
        async function init() {
            const raw = sessionStorage.getItem('import_extracted')
            if (!raw) {
                router.replace('/import')
                return
            }

            let extracted: ExtractedLedger
            try {
                extracted = JSON.parse(raw)
            } catch {
                setLoadError('Scan data was corrupted. Please go back and try again.')
                return
            }

            const existing = await getContacts()
            setExistingContacts(existing)
            setLedger(buildReviewLedger(extracted, existing))
        }
        init()
    }, [router])

    // ── Updaters ─────────────────────────────────────────────────────────────

    function updateContact(contactLocalId: string, field: keyof ReviewContact, value: string) {
        setLedger((prev) => {
            if (!prev) return prev
            return {
                contacts: prev.contacts.map((c) => {
                    if (c.localId !== contactLocalId) return c
                    
                    const updated = { ...c, [field]: value }
                    
                    // Dynamically check if contact already exists when renaming
                    if (field === 'name') {
                        const match = existingContacts.find(ex => ex.name.toLowerCase().trim() === value.toLowerCase().trim())
                        updated.isNew = !match
                        updated.existingContactId = match?.id
                    }
                    
                    return updated
                }),
            }
        })
    }

    function updateTransaction(
        contactLocalId: string,
        txLocalId: string,
        field: keyof ReviewTransaction,
        value: string | number
    ) {
        setLedger((prev) => {
            if (!prev) return prev
            return {
                contacts: prev.contacts.map((c) =>
                    c.localId !== contactLocalId
                        ? c
                        : {
                            ...c,
                            transactions: c.transactions.map((t) =>
                                t.localId === txLocalId ? { ...t, [field]: value } : t
                            ),
                        }
                ),
            }
        })
    }

    function deleteTransaction(contactLocalId: string, txLocalId: string) {
        setLedger((prev) => {
            if (!prev) return prev
            return {
                contacts: prev.contacts.map((c) =>
                    c.localId !== contactLocalId
                        ? c
                        : { ...c, transactions: c.transactions.filter((t) => t.localId !== txLocalId) }
                ),
            }
        })
    }

    function deleteContact(contactLocalId: string) {
        setLedger((prev) => {
            if (!prev) return prev
            return { contacts: prev.contacts.filter((c) => c.localId !== contactLocalId) }
        })
    }

    function addTransaction(contactLocalId: string) {
        const newTx: ReviewTransaction = {
            localId: crypto.randomUUID(),
            direction: 'gave',
            amount: 0,
            date: todayISO(),
            note: null,
        }
        setLedger((prev) => {
            if (!prev) return prev
            return {
                contacts: prev.contacts.map((c) =>
                    c.localId === contactLocalId
                        ? { ...c, transactions: [...c.transactions, newTx] }
                        : c
                ),
            }
        })
    }

    // ── Confirm & bulk insert ─────────────────────────────────────────────
    async function handleConfirm() {
        if (!ledger) return
        setSubmitting(true)
        setSubmitError(null)

        try {
            // 1. Insert only brand-new contacts
            const newContacts = ledger.contacts.filter((c) => c.isNew)
            const { contacts: created, error: contactError } = await bulkAddContacts(
                newContacts.map((c) => ({ name: c.name, phone: c.phone ?? undefined, type: c.type }))
            )
            if (contactError) throw new Error('Failed to create contacts.')

            // 2. Build localId → DB contact_id map
            //    For new contacts: match by index (insertion order is preserved by Supabase),
            //    which safely handles duplicate names without any name-based lookup.
            const idMap = new Map<string, string>()
            newContacts.forEach((reviewContact, i) => {
                if (created[i]) idMap.set(reviewContact.localId, created[i].id)
            })
            // For existing contacts: use the already-resolved existingContactId
            ledger.contacts
                .filter((c) => !c.isNew && c.existingContactId)
                .forEach((c) => idMap.set(c.localId, c.existingContactId!))

            // 3. Build transaction rows with data-type conversions
            const txRows = ledger.contacts.flatMap((c) => {
                const contactId = idMap.get(c.localId)
                if (!contactId) return []
                return c.transactions.map((t) => ({
                    contact_id: contactId,
                    // direction → signed amount
                    amount: t.direction === 'gave' ? Math.abs(t.amount) : -Math.abs(t.amount),
                    note: t.note || null,
                    // Parse YYYY-MM-DD manually as LOCAL time to avoid UTC midnight shift
                    created_at: (() => {
                        const [y, m, d] = t.date.split('-').map(Number)
                        return new Date(y, m - 1, d).toISOString()
                    })(),
                }))
            })

            // 4. Bulk insert transactions
            const { error: txError } = await bulkAddTransactions(txRows)
            if (txError) throw new Error('Failed to save transactions.')

            // 5. Clean up session storage and navigate to done
            sessionStorage.removeItem('import_extracted')
            router.replace('/import/done')
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
            setSubmitting(false)
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    if (loadError) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-8 max-w-lg mx-auto text-center">
                <p className="text-sm text-rose-500">{loadError}</p>
                <Button variant="outline" onClick={() => router.replace('/import')}>Go Back</Button>
            </div>
        )
    }

    if (!ledger) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center max-w-lg mx-auto">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        )
    }

    const txCount = totalTransactions(ledger)
    const errors = validateLedger(ledger)

    return (
        <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">

            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                    <h1 className="text-base font-semibold leading-tight">Review & Edit</h1>
                    <p className="text-xs text-muted-foreground">
                        {ledger.contacts.length} contacts · {txCount} transactions
                    </p>
                </div>
            </header>

            {/* Info banner */}
            <div className="mx-4 mt-3 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                    Review the data below. Edit or delete anything before importing. Contacts marked <strong>new</strong> will be created.
                </p>
            </div>

            {/* Tips panel */}
            <div className="mx-4 mt-2 rounded-lg border border-border overflow-hidden">
                <button
                    type="button"
                    onClick={() => setTipsOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                    <span>💡 Tips for reviewing</span>
                    <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${tipsOpen ? 'rotate-180' : ''}`}
                    />
                </button>
                {tipsOpen && (
                    <ul className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border">
                        <li className="text-xs text-muted-foreground flex gap-2">
                            <span className="shrink-0">🔵</span>
                            <span>Contacts marked <strong className="text-foreground">new</strong> will be created fresh. Existing ones will just get new transactions added.</span>
                        </li>
                        <li className="text-xs text-muted-foreground flex gap-2">
                            <span className="shrink-0">🔁</span>
                            <span>Tap the <strong className="text-foreground">Gave / Got</strong> pill on a transaction to flip its direction.</span>
                        </li>
                        <li className="text-xs text-muted-foreground flex gap-2">
                            <span className="shrink-0">✏️</span>
                            <span>You can edit contact names, phone numbers, amounts, dates, and notes before importing.</span>
                        </li>
                        <li className="text-xs text-muted-foreground flex gap-2">
                            <span className="shrink-0">🗑️</span>
                            <span>Use the trash icon to remove a contact or transaction you don&apos;t want to import.</span>
                        </li>
                    </ul>
                )}
            </div>

            {/* Contact list */}
            <div className="flex-1 flex flex-col gap-3 px-4 py-4 pb-32">
                {ledger.contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <p className="text-sm text-muted-foreground">No contacts found.</p>
                        <Button variant="outline" size="sm" onClick={() => router.back()}>
                            Go back and re-scan
                        </Button>
                    </div>
                ) : (
                    ledger.contacts.map((contact, i) => (
                        <ContactCard
                            key={contact.localId}
                            contact={contact}
                            index={i}
                            errors={errors[contact.localId]}
                            onUpdateContact={(field, value) => updateContact(contact.localId, field, value)}
                            onUpdateTransaction={(txId, field, value) =>
                                updateTransaction(contact.localId, txId, field, value)
                            }
                            onDeleteTransaction={(txId) => deleteTransaction(contact.localId, txId)}
                            onDeleteContact={() => deleteContact(contact.localId)}
                            onAddTransaction={() => addTransaction(contact.localId)}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-background border-t border-border px-4 pt-3 pb-8 space-y-2">
                {submitError && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 px-3 py-2">
                        <p className="text-xs text-rose-600 dark:text-rose-400">{submitError}</p>
                    </div>
                )}
                <Button
                    className="w-full"
                    disabled={ledger.contacts.length === 0 || hasErrors(errors) || submitting}
                    onClick={handleConfirm}
                >
                    {submitting ? 'Importing...' : 'Confirm & Import'}
                </Button>
            </div>
        </div>
    )
}
