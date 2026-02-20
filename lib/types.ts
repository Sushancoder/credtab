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
