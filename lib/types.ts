export type Contact = {
    id: string
    name: string
    phone: string | null
    type: 'customer' | 'supplier'
    created_at: string
    balance: number
}

export type NewContact = {
    name: string
    phone?: string
    type: 'customer' | 'supplier'
}

export type Transaction = {
    id: string
    contact_id: string
    amount: number       // positive = You Gave, negative = You Got
    note: string | null
    created_at: string
}

export type NewTransaction = {
    contact_id: string
    amount: number
    note?: string
}
