"use client"

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Camera, X, ScanText, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExtractedLedger } from '@/lib/import-types'

const MAX_IMAGES = 3

type UploadedImage = {
    file: File
    previewUrl: string
    base64: string
    mimeType: string
}

type Step = 'upload' | 'processing'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            // result is like "data:image/jpeg;base64,XXXX" — strip the prefix
            const result = reader.result as string
            resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [step, setStep] = useState<Step>('upload')
    const [images, setImages] = useState<UploadedImage[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // ── Image picker handler ─────────────────────────────────────────────────
    async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? [])
        if (!files.length) return

        const remaining = MAX_IMAGES - images.length
        const toProcess = files.slice(0, remaining)

        const newImages: UploadedImage[] = await Promise.all(
            toProcess.map(async (file) => ({
                file,
                previewUrl: URL.createObjectURL(file),
                base64: await fileToBase64(file),
                mimeType: file.type,
            }))
        )

        setImages((prev) => [...prev, ...newImages])
        // Reset input so the same file can be re-selected if removed
        e.target.value = ''
    }

    function removeImage(index: number) {
        setImages((prev) => {
            URL.revokeObjectURL(prev[index].previewUrl)
            return prev.filter((_, i) => i !== index)
        })
    }

    // ── Drag-and-drop handlers ───────────────────────────────────────────────
    function handleDragOver(e: React.DragEvent) {
        e.preventDefault()
        e.stopPropagation()
        if (!isDragging) setIsDragging(true)
    }

    function handleDragLeave(e: React.DragEvent) {
        // Only clear when leaving the actual drop zone, not a child element
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setIsDragging(false)
    }

    async function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith('image/')
        )
        if (!files.length) return

        const remaining = MAX_IMAGES - images.length
        const toProcess = files.slice(0, remaining)

        const newImages: UploadedImage[] = await Promise.all(
            toProcess.map(async (file) => ({
                file,
                previewUrl: URL.createObjectURL(file),
                base64: await fileToBase64(file),
                mimeType: file.type,
            }))
        )

        setImages((prev) => [...prev, ...newImages])
    }

    // ── Scan / call API ──────────────────────────────────────────────────────
    async function handleScan() {
        if (images.length === 0) return
        setError(null)
        setStep('processing')

        try {
            const res = await fetch('/api/extract-ledger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    images: images.map((img) => ({
                        base64: img.base64,
                        mimeType: img.mimeType,
                    })),
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error ?? 'Unknown error')
            }

            const extracted: ExtractedLedger = await res.json()

            // Store result in sessionStorage so the review page can pick it up
            sessionStorage.setItem('import_extracted', JSON.stringify(extracted))
            router.push('/import/review')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
            setStep('upload')
        }
    }

    // ── Processing screen ────────────────────────────────────────────────────
    if (step === 'processing') {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8 max-w-lg mx-auto">
                {/* Animated scan icon */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-primary/10 animate-ping [animation-delay:0.3s]" />
                    <div className="relative z-10 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                        <ScanText className="w-6 h-6 text-primary-foreground" />
                    </div>
                </div>

                <div className="text-center space-y-1.5">
                    <p className="text-base font-semibold">Reading your ledger...</p>
                    <p className="text-sm text-muted-foreground">
                        This may take a few seconds.
                    </p>
                </div>

                {/* Image count indicator */}
                <div className="flex gap-2">
                    {images.map((_, i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-primary animate-pulse"
                            style={{ animationDelay: `${i * 0.2}s` }}
                        />
                    ))}
                </div>
            </div>
        )
    }

    // ── Upload screen ────────────────────────────────────────────────────────
    return (
        <div
            className="min-h-screen bg-background flex flex-col max-w-lg mx-auto relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag-over overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-none pointer-events-none">
                    <ImagePlus className="w-10 h-10 text-primary" />
                    <p className="text-sm font-semibold text-primary">Drop your photos here</p>
                    <p className="text-xs text-muted-foreground">
                        {MAX_IMAGES - images.length} slot{MAX_IMAGES - images.length !== 1 ? 's' : ''} remaining
                    </p>
                </div>
            )}

            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <h1 className="text-base font-semibold leading-tight">Import from Ledger</h1>
                    <p className="text-xs text-muted-foreground">Upload photos of your bahi khata</p>
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 flex flex-col px-4 py-6 gap-6">

                {/* Instructions card */}
                <div className="rounded-xl bg-muted/60 border border-border px-4 py-3 space-y-1.5">
                    <p className="text-sm font-medium flex items-center gap-2">
                        <ScanText className="w-4 h-4 shrink-0 text-muted-foreground" />
                        How it works
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 pl-6 list-disc">
                        <li>Take up to 3 clear photos of your ledger pages</li>
                        <li>AI will read names, amounts, and dates automatically</li>
                        <li>You can review and edit everything before saving</li>
                    </ul>
                </div>

                {/* Image grid */}
                <div className="grid grid-cols-3 gap-3">
                    {images.map((img, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
                            <Image
                                src={img.previewUrl}
                                alt={`Ledger page ${i + 1}`}
                                fill
                                className="object-cover"
                            />
                            {/* Remove button */}
                            <button
                                onClick={() => removeImage(i)}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-background transition-colors"
                                aria-label={`Remove image ${i + 1}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                            {/* Page number badge */}
                            <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm text-[10px] font-medium">
                                Page {i + 1}
                            </div>
                        </div>
                    ))}

                    {/* Add more slot */}
                    {images.length < MAX_IMAGES && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 hover:bg-muted/60 transition-colors"
                            aria-label="Add photo"
                        >
                            <ImagePlus className="w-5 h-5 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground font-medium">
                                {images.length === 0 ? 'Add photo' : 'Add more'}
                            </span>
                        </button>
                    )}
                </div>

                {/* Photo count */}
                {images.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center -mt-3">
                        {images.length} of {MAX_IMAGES} photos added
                    </p>
                )}

                {/* Error */}
                {error && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 px-3 py-2.5">
                        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                    </div>
                )}

                {/* Empty state — no images yet */}
                {images.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            <Camera className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-sm font-medium">No photos yet</p>
                            <p className="text-xs text-muted-foreground">
                                Tap the box above or the button below to get started
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
            />

            {/* Footer buttons */}
            <div className="sticky bottom-0 bg-background border-t border-border px-4 pt-3 pb-8 flex flex-col gap-2">
                {/* Open camera / gallery */}
                {images.length < MAX_IMAGES && (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Camera className="w-4 h-4 mr-2" />
                        {images.length === 0 ? 'Take / Choose Photo' : 'Add Another Photo'}
                    </Button>
                )}

                {/* Scan */}
                <Button
                    className="w-full"
                    disabled={images.length === 0}
                    onClick={handleScan}
                >
                    <ScanText className="w-4 h-4 mr-2" />
                    Scan Now
                </Button>
            </div>
        </div>
    )
}
