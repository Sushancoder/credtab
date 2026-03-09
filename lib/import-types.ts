/**
 * Types used throughout the ledger import (scan) feature.
 *
 * Flow:
 *   User uploads images  →  API extracts `ExtractedLedger`
 *   →  UI converts to `ReviewLedger` (adds client-only fields like `isNew`, `localId`)
 *   →  User edits & confirms  →  bulk insert contacts + transactions
 */

// ─── Raw output from Gemini ──────────────────────────────────────────────────

export type ExtractedTransaction = {
    /** 'gave' = you gave money (positive amount, due), 'got' = you received money (negative, advance) */
    direction: 'gave' | 'got'
    amount: number
    /** ISO date string (YYYY-MM-DD) or null if not found in image */
    date: string | null
    note: string | null
}

export type ExtractedContact = {
    name: string
    /** Phone number if visible in the ledger, otherwise null */
    phone: string | null
    /** 'customer' | 'supplier' — AI best-guess, user can change */
    type: 'customer' | 'supplier'
    transactions: ExtractedTransaction[]
}

export type ExtractedLedger = {
    contacts: ExtractedContact[]
}




// ─── Review-time types (what the UI works with) ───────────────────────────────

export type ReviewTransaction = ExtractedTransaction & {
    /** Stable local ID for React keys and row deletion */
    localId: string
    /** Today's date as ISO string, used as default when date is null */
    date: string
}

export type ReviewContact = {
    localId: string
    name: string
    phone: string | null
    type: 'customer' | 'supplier'
    /** true if this contact name does not match any existing contact in the DB */
    isNew: boolean
    /** If not new, the ID of the matched existing contact */
    existingContactId?: string
    transactions: ReviewTransaction[]
}

export type ReviewLedger = {
    contacts: ReviewContact[]
}
