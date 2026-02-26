import { createClient } from '@/lib/supabase/client'
import type { Transaction, NewTransaction } from '@/lib/types'

/**
 * Fetch all transactions for a specific contact, newest first.
 * Only returns non-deleted transactions.
 */
export async function getTransactions(contactId: string): Promise<Transaction[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select('id, contact_id, amount, note, created_at')
    .eq('contact_id', contactId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true }) // oldest first (chat style, scroll down for newest)

  if (error || !data) {
    console.error('Error fetching transactions:', error)
    return []
  }

  // Convert numeric string amounts to numbers
  return data.map((t) => ({
    ...t,
    amount: Number(t.amount),
  }))
}

/**
 * Add a new transaction.
 * user_id is fetched from the session, not passed from frontend.
 */
export async function addTransaction(data: NewTransaction) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { transaction: null, error: {message: 'Not authenticated'}}

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      contact_id: data.contact_id,
      amount: data.amount,
      note: data.note?.trim() || null,
    })
    .select('id, contact_id, amount, note, created_at')
    .single()

  if (error || !transaction) {
    return { transaction: null, error }
  }

  return {
    transaction: { ...transaction, amount: Number(transaction.amount) },
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
    .select('id, contact_id, amount, note, created_at')
    .single()

  if (error || !transaction) {
    return { transaction: null, error }
  }

  return {
    transaction: { ...transaction, amount: Number(transaction.amount) },
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
