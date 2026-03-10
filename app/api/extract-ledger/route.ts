import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import type { ExtractedLedger } from '@/lib/import-types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// ─── Response schema we ask Gemini to conform to ─────────────────────────────
const LEDGER_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        contacts: {
            type: Type.ARRAY,
            description: 'All contacts (people/businesses) found in the ledger image(s)',
            items: {
                type: Type.OBJECT,
                properties: {
                    name: {
                        type: Type.STRING,
                        description: 'Full name or business name of the contact',
                    },
                    phone: {
                        type: Type.STRING,
                        description: 'Phone or mobile number if visible next to the contact name, otherwise null',
                    },
                    type: {
                        type: Type.STRING,
                        description: 'Either "customer" (someone who owes you) or "supplier" (someone you owe)',
                    },
                    transactions: {
                        type: Type.ARRAY,
                        description: 'All transactions listed under this contact',
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                direction: {
                                    type: Type.STRING,
                                    description:
                                        '"gave" if the ledger owner gave money / extended credit to the contact. "got" if the ledger owner received money / was paid by the contact.',
                                },
                                amount: {
                                    type: Type.NUMBER,
                                    description: 'Absolute numeric value of the transaction (always positive)',
                                },
                                date: {
                                    type: Type.STRING,
                                    description:
                                        'ISO 8601 date string (YYYY-MM-DD) if a date is visible, otherwise null',
                                },
                                note: {
                                    type: Type.STRING,
                                    description: 'Any accompanying note, item name, reason for the transaction, or any other miscellaneous information visible near the transaction (e.g. payment method, "partial", "advance", balance carried forward, instalments, cheque number, remarks). Combine all extra details into a single readable string. null only if absolutely nothing is written.',
                                },
                            },
                            propertyOrdering: ['direction', 'amount', 'date', 'note'],
                        },
                    },
                },
                propertyOrdering: ['name', 'phone', 'type', 'transactions'],
            },
        },
    },
    propertyOrdering: ['contacts'],
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert at reading Indian handwritten account ledgers (also called "bahi khata" or "udhar khata").
The ledger may be written in English, Hindi, Hinglish, or a mix of all three.

Your job is to extract all contacts and their transactions from the provided image(s).

Rules:
- A "contact" is a person or business mentioned in the ledger.
- For each contact, extract every transaction associated with them.
- If a phone number or mobile number appears next to a contact name, extract it. Otherwise set "phone" to null.
- "direction" must be "gave" if the ledger owner gave money or extended credit to the contact (i.e., the contact owes money — a debit entry). Use "got" if the ledger owner received money from the contact (i.e., a payment was received — a credit entry).
- "amount" must always be a positive number.
- Dates may be written in various formats (e.g., "5/3", "5 March", "5 Mar 25") — convert to YYYY-MM-DD. If no year is specified, use the current year.
- If a date is illegible or absent, set "date" to null.
- "note" should capture the accompanying note, item name, or reason AND any extra/miscellaneous details visible near the transaction — for example: payment method (cash/UPI/cheque), cheque number, "partial payment", :
- If any data point (name, amount, date, phone, note, type) is illegible, unclear, smudged, or not present in the image, leave that field empty (null) rather than guessing or filling it with an assumed value. Never fabricate data.
- If multiple images are provided, treat them as pages of the same ledger and consolidate results.`

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const images: { base64: string; mimeType: string }[] = body.images

        if (!images || images.length === 0 || images.length > 3) {
            return NextResponse.json({ error: 'Provide 1 to 3 images.' }, { status: 400 })
        }

        // Build the content parts array: system prompt text + all image parts
        const imageParts = images.map((img) => ({
            inlineData: {
                data: img.base64,
                mimeType: img.mimeType,
            },
        }))

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: SYSTEM_PROMPT },
                        ...imageParts,
                        { text: 'Extract all contacts and transactions from the ledger image(s) above.' },
                    ],
                },
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: LEDGER_SCHEMA,
            },
        })

        const raw = response.text?.trim()
        if (!raw) {
            return NextResponse.json({ error: 'Gemini returned an empty response.' }, { status: 500 })
        }

        const extracted: ExtractedLedger = JSON.parse(raw)

        // Gemini responseSchema may return "null" as a literal string for nullable fields.
        // Sanitize them to actual null before returning.
        for (const contact of extracted.contacts) {
            if (!contact.phone || contact.phone === 'null') contact.phone = null
            for (const tx of contact.transactions) {
                if (!tx.date || tx.date === 'null') tx.date = null
                if (!tx.note || tx.note === 'null') tx.note = null
            }
        }

        return NextResponse.json(extracted)
    } catch (err) {
        console.error('[extract-ledger] Error:', err)
        return NextResponse.json(
            { error: 'Failed to extract ledger data. Please try again.' },
            { status: 500 }
        )
    }
}
