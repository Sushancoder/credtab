"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Truck, CalendarDays, LogOut, Mic } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getVoiceLang, setVoiceLang, type VoiceLang } from '@/lib/voice-lang'
import { Button } from '@/components/ui/button'

type ProfileData = {
    name: string
    email: string
    avatar: string | null
    memberSince: string
    totalCustomers: number
    totalSuppliers: number
}

export default function ProfilePage() {
    const router = useRouter()
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [loggingOut, setLoggingOut] = useState(false)
    const [voiceLang, setVoiceLangState] = useState<VoiceLang>('en-IN')

    useEffect(() => {
        setVoiceLangState(getVoiceLang())
    }, [])

    useEffect(() => {
        async function load() {
            const supabase = createClient()

            // Get user info from auth
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get contact counts
            const { count: customerCount } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('is_deleted', false)
                .eq('type', 'customer')

            const { count: supplierCount } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('is_deleted', false)
                .eq('type', 'supplier')

            setProfile({
                name: user.user_metadata?.full_name ?? 'User',
                email: user.email ?? '',
                avatar: user.user_metadata?.avatar_url ?? null,
                memberSince: new Date(user.created_at).toLocaleDateString('en-IN', {
                    month: 'short',
                    year: 'numeric',
                }),
                totalCustomers: customerCount ?? 0,
                totalSuppliers: supplierCount ?? 0,
            })

            setLoading(false)
        }
        load()
    }, [])

    async function handleLogout() {
        setLoggingOut(true)
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    function handleLangChange(lang: VoiceLang) {
        setVoiceLang(lang)
        setVoiceLangState(lang)
    }

    return (
        <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">

            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-lg font-semibold">Profile</h1>
            </header>

            {loading ? (
                // Skeleton
                <div className="flex flex-col items-center py-12 animate-pulse">
                    <div className="w-20 h-20 rounded-full bg-muted mb-4" />
                    <div className="h-5 w-36 bg-muted rounded mb-2" />
                    <div className="h-4 w-48 bg-muted rounded" />
                </div>
            ) : profile && (
                <>
                    {/* Avatar + Info */}
                    <div className="flex flex-col items-center py-8">
                        {profile.avatar ? (
                            <img
                                src={profile.avatar}
                                alt={profile.name}
                                className="w-20 h-20 rounded-full mb-4"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4">
                                <span className="text-primary-foreground text-2xl font-bold">
                                    {profile.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <h2 className="text-lg font-semibold">{profile.name}</h2>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                    </div>

                    {/* Stats */}
                    <div className="px-4 space-y-1">
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">Total Customers</span>
                            </div>
                            <span className="text-sm font-medium">{profile.totalCustomers}</span>
                        </div>

                        <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Truck className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">Total Suppliers</span>
                            </div>
                            <span className="text-sm font-medium">{profile.totalSuppliers}</span>
                        </div>

                        <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">Member since</span>
                            </div>
                            <span className="text-sm font-medium">{profile.memberSince}</span>
                        </div>
                    </div>

                    {/* Voice Language */}
                    <div className="px-4 mt-1">
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Mic className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <span className="text-sm">Voice Language</span>
                                    <p className="text-xs text-muted-foreground">Used for voice transactions</p>
                                </div>
                            </div>
                            <div className="flex rounded-full overflow-hidden border border-border text-xs font-semibold">
                                <button
                                    onClick={() => handleLangChange('en-IN')}
                                    className={`px-3 py-1.5 transition-colors ${
                                        voiceLang === 'en-IN'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    English
                                </button>
                                <button
                                    onClick={() => handleLangChange('hi-IN')}
                                    className={`px-3 py-1.5 transition-colors ${
                                        voiceLang === 'hi-IN'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    हिंदी
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <div className="mt-auto px-4 py-6">
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            {loggingOut ? 'Signing out...' : 'Sign Out'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
