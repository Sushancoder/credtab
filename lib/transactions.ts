import { createClient } from '@/lib/supabase/client'
import type { Transaction, NewTransaction } from '@/lib/types'

/**
 * Fetch all transactions for a specific contact, newest first.
 * Includes soft-deleted transactions so they can be shown greyed out.
 */
export async function getTransactions(contactId: string): Promise<Transaction[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select('id, contact_id, amount, note, created_at, is_deleted')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true }) // oldest first (chat style, scroll down for newest)
    .order('id', { ascending: true })         // stable tiebreaker for same-timestamp rows

  if (error || !data) {
    console.error('Error fetching transactions:', error)
    return []
  }

  // Convert numeric string amounts to numbers
  return data.map((t) => ({
    ...t,
    amount: Number(t.amount),
    is_deleted: t.is_deleted ?? false,
  }))
}

/**
 * Add a new transaction.
 * user_id is fetched from the session, not passed from frontend.
 */
export async function addTransaction(data: NewTransaction) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { transaction: null, error: { message: 'Not authenticated' } }

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      contact_id: data.contact_id,
      amount: data.amount,
      note: data.note?.trim() || null,
    })
    .select('id, contact_id, amount, note, created_at, is_deleted')
    .single()

  if (error || !transaction) {
    return { transaction: null, error }
  }

  return {
    transaction: { ...transaction, amount: Number(transaction.amount), is_deleted: false },
    error: null,
  }
}

/**
 * Update an existing transaction's amount and/or note.
 * Only the owner can update (enforced by RLS).
 */
export async function updateTransaction(
  id: string,
  data: { amount: number; note?: string }
) {
  const supabase = createClient()

  const { data: transaction, error } = await supabase
    .from('transactions')
    .update({
      amount: data.amount,
      note: data.note?.trim() || null,
    })
    .eq('id', id)
    .select('id, contact_id, amount, note, created_at, is_deleted')
    .single()

  if (error || !transaction) {
    return { transaction: null, error }
  }

  return {
    transaction: { ...transaction, amount: Number(transaction.amount), is_deleted: false },
    error: null,
  }
}

/**
 * Soft delete a transaction — sets is_deleted = true.
 * The row stays in the DB but won't appear in queries.
 */
export async function deleteTransaction(id: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('transactions')
    .update({ is_deleted: true })
    .eq('id', id)

  return { error }
}

/**
 * Bulk-insert multiple transactions in a single DB round-trip.
 *
 * IMPORTANT — callers must handle the two data-type conversions before calling this:
 *   1. direction + amount → signed amount:
 *        direction === 'gave' ? +amount : -amount
 *   2. date string (YYYY-MM-DD) → ISO timestamp:
 *        new Date(date).toISOString()
 */
export type BulkTransaction = {
  contact_id: string
  amount: number          // already signed: positive = gave, negative = got
  note: string | null
  created_at: string      // full ISO timestamp
}

export async function bulkAddTransactions(transactions: BulkTransaction[]) {
  if (transactions.length === 0) return { error: null }

  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not authenticated' } }

  const rows = transactions.map((t) => ({
    user_id: user.id,
    contact_id: t.contact_id,
    amount: t.amount,
    note: t.note?.trim() || null,
    created_at: t.created_at,
  }))

  const { error } = await supabase.from('transactions').insert(rows)
  return { error }
}

