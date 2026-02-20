import { createClient } from '@/lib/supabase/client'
import type { Contact, NewContact } from '@/lib/types'

/**
 * Fetch all contacts for the current user, merged with their balance.
 * Two queries are made: one for contacts, one for balances from the view.
 * They are merged in JS using a Map for O(n) performance.
 */
export async function getContacts(): Promise<Contact[]> {
    const supabase = createClient()

    // 1. Fetch all non-deleted contacts, newest first
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, name, phone, type, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

    if (error || !contacts) {
        console.error('Error fetching contacts:', error)
        return []
    }

    // 2. Fetch balances from the view (only contacts that have transactions)
    const { data: balances } = await supabase
        .from('contact_balances')
        .select('contact_id, balance')

    // 3. Build a quick-lookup map: contact_id → balance
    const balanceMap = new Map(
        (balances ?? []).map((b) => [b.contact_id, Number(b.balance)])
    )

    // 4. Merge: attach balance to each contact (default 0 if no transactions yet)
    return contacts.map((c) => ({
        ...c,
        balance: balanceMap.get(c.id) ?? 0,
    }))
}

/**
 * Add a new contact for the current user.
 * user_id is NOT passed from the frontend — Supabase injects it via RLS.
 */
export async function addContact(data: NewContact) {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { contact: null, error: { message: 'Not authenticated' } }

    const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
            name: data.name.trim(),
            phone: data.phone?.trim() || null,
            type: data.type,
            user_id: user.id,
        })
        .select('id, name, phone, type, created_at')
        .single()

    return { contact, error }
}
