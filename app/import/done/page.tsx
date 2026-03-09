"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REDIRECT_DELAY_MS = 3000

export default function ImportDonePage() {
    const router = useRouter()

    // Auto-redirect to home after a short delay
    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace('/')
        }, REDIRECT_DELAY_MS)
        return () => clearTimeout(timer)
    }, [router])

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8 max-w-lg mx-auto text-center">

            {/* Success icon */}
            <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-950/40 animate-ping repeat-2" />
                <div className="relative z-10 w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
                <h1 className="text-lg font-semibold">Import Successful!</h1>
                <p className="text-sm text-muted-foreground">
                    Your ledger data has been saved. Redirecting you back to the home screen...
                </p>
            </div>

            {/* Redirect progress hint */}
            <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse"
                        style={{ animationDelay: `${i * 0.3}s` }}
                    />
                ))}
            </div>

            {/* Manual go home button (in case they don't want to wait) */}
            <Button
                variant="outline"
                onClick={() => router.replace('/')}
                className="mt-2"
            >
                Go to Home
            </Button>
        </div>
    )
}
