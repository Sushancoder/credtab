"use client"

import { useState, useRef } from 'react'
import { Mic, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Contact } from '@/lib/types'
import { addContact } from '@/lib/contacts'
import { addTransaction } from '@/lib/transactions'
import { getAvatarColor } from '@/lib/avatar'
import { getVoiceLang } from '@/lib/voice-lang'

interface VoiceTransactionProps {
    contacts: Contact[]
}

export default function VoiceTransaction({ contacts }: VoiceTransactionProps) {
    const router = useRouter()
    const [isListening, setIsListening] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [extractedData, setExtractedData] = useState<any>(null)
    const [reviewDirection, setReviewDirection] = useState<'gave' | 'got'>('gave')
    const [reviewAmount, setReviewAmount] = useState<string>('')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const transcriptRef = useRef("")
    const recognitionRef = useRef<any>(null)
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const showError = (msg: string) => {
        setErrorMessage(msg)
        setTimeout(() => setErrorMessage(null), 2000)
    }

    const startListening = async () => {
        // Fix 1: Guard against double-tap starting duplicate sessions
        if (isListening || isProcessing) return

        try {
            // Fix 3: Release the MediaStream immediately after permission check so mic indicator turns off
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(t => t.stop())
        } catch (err) {
            alert('Microphone permission is required to use this feature.')
            return
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            alert('Speech recognition is not supported in this browser.')
            return
        }

        const recognition = new SpeechRecognition()
        recognitionRef.current = recognition
        recognition.continuous = true
        recognition.interimResults = true
        // Read language preference from user settings (falls back to en-IN)
        recognition.lang = getVoiceLang()

        recognition.onstart = () => {
            setIsListening(true)
            setTranscript("")
            transcriptRef.current = ""
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        }

        recognition.onresult = (event: any) => {
            // Fix 2: Accumulate ALL results from index 0 to capture full sentence in continuous mode
            let fullTranscript = ''
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript
            }
            setTranscript(fullTranscript)
            transcriptRef.current = fullTranscript

            // Reset silence timer — wait 2s after last speech before submitting
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = setTimeout(() => {
                recognition.stop()
            }, 2000)
        }

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error)
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
            setIsListening(false)
        }

        recognition.onend = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
            setIsListening(false)
            if (transcriptRef.current) {
                processVoice(transcriptRef.current)
            }
        }

        recognition.start()
    }

    const processVoice = async (text: string) => {
        setIsProcessing(true)
        try {
            const res = await fetch('/api/extract-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    contacts: contacts.map(c => ({ id: c.id, name: c.name, type: c.type }))
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to process voice')

            // Guard: if AI couldn't identify any contact, bail early
            if (!data.contactId && !data.newContactName) {
                showError("Couldn't add transaction. No contact name was understood.")
                return
            }

            setReviewDirection(data.direction === 'got' ? 'got' : 'gave')
            setReviewAmount(String(data.amount ?? ''))
            setExtractedData(data)
        } catch (error: any) {
            console.error("Voice processing error:", error)
            alert(error.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleConfirm = async () => {
        if (!extractedData) return
        setIsSaving(true)

        try {
            let finalContactId = extractedData.contactId

            // 1. Create contact if needed
            if (!finalContactId && extractedData.newContactName) {
                const { contact, error: contactError } = await addContact({
                    name: extractedData.newContactName,
                    type: extractedData.newContactType === 'supplier' ? 'supplier' : 'customer'
                })
                if (contactError || !contact) throw new Error(contactError?.message || 'Failed to create contact')
                finalContactId = contact.id
            }

            if (!finalContactId) throw new Error('No contact resolved.')

            // 2. Add Transaction
            const amount = Number(reviewAmount)
            if (!amount || isNaN(amount)) throw new Error('Please enter a valid amount.')
            const isGave = (reviewDirection === 'gave')
            
            const { error: txError } = await addTransaction({
                contact_id: finalContactId,
                amount: isGave ? amount : -amount,
                note: extractedData.note || undefined
            })

            if (txError) throw new Error(txError.message || 'Failed to add transaction')

            // Success: Close modal and refresh page to show newly added balance/transaction
            setExtractedData(null)
            router.refresh()
            // optionally we could manually reload window to refresh the layout state
            setTimeout(() => window.location.reload(), 300)

        } catch (err: any) {
            console.error(err)
            alert(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            {/* The microphone button fixed in the bottom middle */}
            <button
                onClick={startListening}
                className="fixed bottom-6 left-1/3 -translate-x-1/2 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all cursor-pointer z-20"
                aria-label="Add transaction with voice"
                title="Add transaction with voice"
            >
                <Mic className="w-6 h-6" />
            </button>

            {/* The Listening Overlay */}
            {isListening && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 transition-all duration-300">
                    <button 
                        onClick={() => {
                            if (recognitionRef.current) recognitionRef.current.stop()
                            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
                            setIsListening(false)
                        }}
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="Close voice input"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-8 animate-pulse">
                        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                            <Mic className="w-7 h-7 animate-bounce" />
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-semibold mb-3 tracking-tight">Listening...</h2>
                    
                    <p className="text-muted-foreground text-center max-w-sm h-20 overflow-y-auto text-lg">
                        {transcript || "Speak clearly into your microphone..."}
                    </p>
                </div>
            )}

            {/* The Processing Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 transition-all duration-300">
                    <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mb-6"></div>
                    <h2 className="text-2xl font-semibold mb-3 tracking-tight">Processing...</h2>
                    <p className="text-muted-foreground text-center max-w-sm text-lg">
                        Extracting transaction details...
                    </p>
                </div>
            )}

            {/* Transient Error Toast */}
            {errorMessage && (
                <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-rose-600 text-white text-sm font-medium shadow-xl text-center max-w-xs animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
                    {errorMessage}
                </div>
            )}

            {/* The Review Overlay */}
            {extractedData && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-card w-full max-w-sm rounded-[1.5rem] shadow-2xl border border-border overflow-hidden flex flex-col animate-in zoom-in-95 fade-in-0 duration-200">
                        {/* Top Section */}
                        <div className="px-6 py-5 border-b border-border bg-muted/30">
                            {(() => {
                                const reviewName = extractedData.contactId
                                    ? contacts.find(c => c.id === extractedData.contactId)?.name ?? '?'
                                    : extractedData.newContactName ?? '?'
                                const avatarColor = getAvatarColor(reviewName)
                                const initial = reviewName.charAt(0).toUpperCase()
                                return (
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className={`w-11 h-11 rounded-full ${avatarColor} flex items-center justify-center shrink-0 shadow-sm`}>
                                            <span className="text-white font-semibold text-base">{initial}</span>
                                        </div>
                                        <div className="flex flex-col items-start">
                                            <h3 className="text-lg font-bold tracking-tight text-foreground leading-tight">{reviewName}</h3>
                                            {extractedData.newContactName && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary mt-0.5">
                                                    New {extractedData.newContactType || 'Contact'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Middle Section */}
                        <div className="px-6 py-8 text-center flex flex-col items-center justify-center gap-4">
                            <div className="flex flex-col items-center gap-3">
                                {/* Direction Toggle */}
                                <div className="flex rounded-full overflow-hidden border border-border">
                                    <button
                                        onClick={() => setReviewDirection('got')}
                                        className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                                            reviewDirection === 'got'
                                                ? 'bg-emerald-500 text-white'
                                                : 'text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        You Got
                                    </button>
                                    <button
                                        onClick={() => setReviewDirection('gave')}
                                        className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                                            reviewDirection === 'gave'
                                                ? 'bg-rose-500 text-white'
                                                : 'text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        You Gave
                                    </button>
                                </div>
                                {/* Amount Input */}
                                <div className="flex items-center gap-1">
                                    <span className="text-4xl font-extrabold text-muted-foreground">₹</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={reviewAmount}
                                        onChange={e => setReviewAmount(e.target.value)}
                                        className="text-5xl font-extrabold tracking-tighter bg-transparent border-none outline-none w-44 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        style={{ fontVariantNumeric: 'tabular-nums' }}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {extractedData.note && (
                                <div className="mt-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-xl text-balance max-w-[250px] italic">
                                    "{extractedData.note}"
                                </div>
                            )}
                        </div>

                        {/* Bottom Section */}
                        <div className="grid grid-cols-2 border-t border-border mt-auto">
                            <button
                                onClick={() => setExtractedData(null)}
                                disabled={isSaving}
                                className="py-4 text-muted-foreground hover:bg-muted font-medium transition-colors active:bg-muted/80 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isSaving}
                                className="py-4 text-primary font-bold hover:bg-primary/5 transition-colors border-l border-border flex items-center justify-center gap-2 active:bg-primary/10 disabled:opacity-50"
                            >
                                {isSaving ? <span className="w-5 h-5 border-[3px] border-primary border-t-transparent rounded-full animate-spin"></span> : 'Add'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
