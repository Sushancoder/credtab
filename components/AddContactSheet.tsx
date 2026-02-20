"use client"

import { useState, useEffect } from 'react'
import { addContact } from '@/lib/contacts'
import type { Contact, NewContact } from '@/lib/types'
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
    defaultType: 'customer' | 'supplier'
    onSuccess: (contact: Contact) => void
}

export default function AddContactSheet({
    open,
    onOpenChange,
    defaultType,
    onSuccess,
}: Props) {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [type, setType] = useState<'customer' | 'supplier'>(defaultType)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Sync the type toggle when the active tab changes
    useEffect(() => {
        setType(defaultType)
    }, [defaultType])

    // Reset form when sheet closes
    useEffect(() => {
        if (!open) {
            setName('')
            setPhone('')
            setError('')
            setLoading(false)
        }
    }, [open])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) {
            setError('Name is required.')
            return
        }

        setLoading(true)
        setError('')

        const data: NewContact = {
            name: name.trim(),
            phone: phone.trim() || undefined,
            type,
        }

        const { contact, error: addError } = await addContact(data)

        if (addError || !contact) {
            setError('Failed to add contact. Please try again.')
            setLoading(false)
            return
        }

        // Pass the new contact (with balance 0) back to the parent
        onSuccess({ ...contact, balance: 0 })
        onOpenChange(false)
        setLoading(false)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl pb-8">
                <SheetHeader className="px-4 pt-2 pb-0">
                    <SheetTitle>Add Contact</SheetTitle>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="contact-name">
                            Name <span className="text-rose-500">*</span>
                        </label>
                        <Input
                            id="contact-name"
                            placeholder="e.g. Ramesh Kumar"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                            autoComplete="off"
                        />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="contact-phone">
                            Phone <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <Input
                            id="contact-phone"
                            placeholder="e.g. 9876543210"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            autoComplete="off"
                        />
                    </div>

                    {/* Error */}
                    {error && <p className="text-sm text-rose-500">{error}</p>}

                    {/* Type Toggle */}
                    <div className="pt-2">
                        <p className="text-sm font-medium mb-2">Type</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setType('customer')}
                                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'customer'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-border hover:bg-muted'
                                    }`}
                            >
                                Customer
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('supplier')}
                                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'supplier'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-border hover:bg-muted'
                                    }`}
                            >
                                Supplier
                            </button>
                        </div>
                    </div>

                    <SheetFooter className="px-0 pb-0 pt-2">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Contact'}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    )
}
