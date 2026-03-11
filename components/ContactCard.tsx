import Link from 'next/link'
import type { Contact } from '@/lib/types'
import { getAvatarColor } from '@/lib/avatar'


// Formats a number as Indian Rupees (e.g. 2400 → ₹2,400)
function formatINR(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(Math.abs(amount))
}

type Props = {
    contact: Contact
}

export default function ContactCard({ contact }: Props) {
    const { id, name, balance } = contact
    const initial = name.charAt(0).toUpperCase()
    const avatarColor = getAvatarColor(name)

    const isPositive = balance > 0  // they owe you
    const isNegative = balance < 0  // you owe them
    const isZero = balance === 0    // settled

    return (
        <Link
            href={`/contact/${id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors"
        >
            {/* Initials Avatar */}
            <div
                className={`w-11 h-11 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}
            >
                <span className="text-white font-semibold text-base">{initial}</span>
            </div>

            {/* Contact Name */}
            <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{name}</p>
            </div>

            {/* Balance */}
            <div className="text-right shrink-0">
                <p
                    className={`font-semibold text-sm ${isPositive
                        ? 'text-emerald-600'
                        : isNegative
                            ? 'text-rose-500'
                            : 'text-muted-foreground'
                        }`}
                >
                    {isZero ? '₹0' : formatINR(balance)}
                </p>
                <p className="text-xs text-muted-foreground">
                    {isPositive ? 'Advance' : isNegative ? 'Due' : 'Settled'}
                </p>
            </div>
        </Link>
    )
}
