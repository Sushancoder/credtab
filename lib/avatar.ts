/**
 * Generates a consistent Tailwind background color class based on a name string.
 * The same name will always produce the same color — no randomness.
 */
export function getAvatarColor(name: string): string {
    const colors = [
        'bg-rose-500',
        'bg-orange-500',
        'bg-amber-500',
        'bg-emerald-500',
        'bg-teal-500',
        'bg-cyan-500',
        'bg-blue-500',
        'bg-violet-500',
        'bg-purple-500',
        'bg-pink-500',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}
