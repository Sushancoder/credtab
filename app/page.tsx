"use client"

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, UserRound, ChevronRight } from 'lucide-react'
import { getContacts } from '@/lib/contacts'
import type { Contact } from '@/lib/types'
import ContactCard from '@/components/ContactCard'
import AddContactSheet from '@/components/AddContactSheet'

export default function HomePage() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer')
    const [search, setSearch] = useState('')
    const [sheetOpen, setSheetOpen] = useState(false)

    // Fetch all contacts on mount
    useEffect(() => {
        async function load() {
            const data = await getContacts()
            setContacts(data)
            setLoading(false)
        }
        load()
    }, [])

    // All contacts in the active tab (unfiltered by search)
    const tabContacts = useMemo(() => {
        return contacts.filter((c) => c.type === activeTab)
    }, [contacts, activeTab])

    // Net balance across all contacts in the active tab
    const netBalance = useMemo(() => {
        return tabContacts.reduce((sum, c) => sum + c.balance, 0)
    }, [tabContacts])

    // Filter by active tab first, then by search query
    const filtered = useMemo(() => {
        return tabContacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase().trim()))
    }, [tabContacts, search])

    // Called by AddContactSheet after a successful insert
    function handleContactAdded(newContact: Contact) {
        setContacts((prev) => [newContact, ...prev])
    }

    return (
        <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative">

            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
                <div className="flex items-center gap-2">
                    <img src="/logo.svg" alt="CredTab Logo" className="w-6 h-6" />
                    <h1 className="text-lg font-semibold tracking-tight">CredTab</h1>
                </div>
                <Link
                    href="/profile"
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    aria-label="Profile"
                >
                    <UserRound className="w-4 h-4 text-muted-foreground" />
                </Link>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-border px-4 sticky top-[53px] bg-background z-10">
                {(['customer', 'supplier'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setSearch('') }}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 capitalize transition-colors ${activeTab === tab
                            ? 'border-primary text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {tab === 'customer' ? 'Customers' : 'Suppliers'}
                    </button>
                ))}
            </div>

            {/* Net Balance Card */}
            {!loading && tabContacts.length > 0 && (
                <div className="mx-4 mt-3 mb-1 px-4 py-3 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground">Net Balance</span>
                        <span className="text-xs text-muted-foreground">
                            <UserRound className="inline w-3 h-3 mr-1 -mt-0.5" />
                            {tabContacts.length} {tabContacts.length === 1 ? 'Account' : 'Accounts'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="text-right">
                            <p
                                className={`text-sm font-bold ${netBalance > 0
                                    ? 'text-emerald-600'
                                    : netBalance < 0
                                        ? 'text-rose-500'
                                        : 'text-muted-foreground'
                                    }`}
                            >
                                {netBalance === 0
                                    ? '₹0'
                                    : new Intl.NumberFormat('en-IN', {
                                        style: 'currency',
                                        currency: 'INR',
                                        maximumFractionDigits: 0,
                                    }).format(Math.abs(netBalance))}
                            </p>
                            {netBalance !== 0 && (
                                <p className={`text-xs ${netBalance > 0 ? 'text-emerald-600' : 'text-rose-500'
                                    }`}>
                                    {netBalance > 0 ? 'You Get' : 'You Give'}
                                </p>
                            )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="px-4 py-3">
                <input
                    type="text"
                    placeholder={`Search ${activeTab === 'customer' ? 'customers' : 'suppliers'}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-muted outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 transition-shadow"
                />
            </div>

            {/* Contact List */}
            <div className="flex-1 divide-y divide-border pb-24">
                {loading ? (
                    // Skeleton rows while loading
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                            <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
                            <div className="flex-1">
                                <div className="h-4 bg-muted rounded w-36" />
                            </div>
                            <div className="space-y-2 text-right">
                                <div className="h-4 bg-muted rounded w-16" />
                                <div className="h-3 bg-muted rounded w-12 ml-auto" />
                            </div>
                        </div>
                    ))
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <UserRound className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {search
                                ? `No results for "${search}"`
                                : `No ${activeTab === 'customer' ? 'customers' : 'suppliers'} yet.\nTap + to add one.`}
                        </p>
                    </div>
                ) : (
                    filtered.map((contact) => (
                        <ContactCard key={contact.id} contact={contact} />
                    ))
                )}
            </div>

            {/* Floating Action Button */}
            <button
                id="add-contact-fab"
                onClick={() => setSheetOpen(true)}
                className="fixed bottom-6 right-6 h-12 px-5 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                aria-label="Add contact"
            >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">
                    {activeTab === 'customer' ? 'Add Customer' : 'Add Supplier'}
                </span>
            </button>

            {/* Add Contact Sheet */}
            <AddContactSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                defaultType={activeTab}
                onSuccess={handleContactAdded}
            />
        </div>
    )
}