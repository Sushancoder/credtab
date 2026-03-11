import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const VOICE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        contactId: {
            type: Type.STRING,
            description: 'The exact ID of the contact if the spoken name matches one of the provided existing contacts. Null if no match.',
        },
        newContactName: {
            type: Type.STRING,
            description: 'If the name does not match any existing contact, provide the raw extracted name here. Null if contactId is matched.',
        },
        newContactType: {
            type: Type.STRING,
            description: 'If a new contact, guess if it is a "customer" (someone who owes money) or "supplier" (someone who is owed money). Determine from context.'
        },
        amount: {
            type: Type.NUMBER,
            description: 'The absolute numeric value of the transaction. Must always be positive.',
        },
        direction: {
            type: Type.STRING,
            description: '"gave" if the user gave money/extended credit, "got" if the user received money/was paid.',
        },
        note: {
            type: Type.STRING,
            description: 'Any accompanying note, reason, or miscellaneous information mentioned (e.g. "for lunch", "partial payment"). Null if none.',
        },
    },
    propertyOrdering: ['contactId', 'newContactName', 'newContactType', 'amount', 'direction', 'note'],
}

const SYSTEM_PROMPT = `You are an expert financial assistant processing voice-to-text transcripts for a ledger app.
The user is dictating a transaction(which you'll receive as text).
Your job is to extract the details into structured JSON.

Rules:
- You will receive the transcript and an array of existing contacts ({ id, name, type }).
- "contactId": If the spoken name closely matches an existing contact from the provided list, return exactly that contact's "id". Otherwise, set this to null.
- "newContactName": If it's a new name not in the list, extract the name cleanly. Null if "contactId" is provided.
- Contact type: Customer by default(when unspecified)
- "amount": The absolute value (number).
- "direction": "gave" if the user gave money to the contact (debit). "got" if the user received money from the contact (credit).
- "note": Additional details mentioned (e.g., "for lunch", "partial payment", "cement stock").
- If any of the data is missing or unclear (e.g. no amount specified), return null for those fields or infer from context if blindingly obvious. Do not hallucinate.`

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { text, contacts } = body

        if (!text) {
            return NextResponse.json({ error: 'Provide a voice transcript text.' }, { status: 400 })
        }

        const userPrompt = `Existing Contacts context:\n${JSON.stringify(contacts, null, 2)}\n\nUser Voice Transcript:\n"${text}"\n\nExtract the transaction details.`

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: SYSTEM_PROMPT }, { text: userPrompt }],
                },
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: VOICE_SCHEMA,
            },
        })

        const raw = response.text?.trim()
        if (!raw) {
            return NextResponse.json({ error: 'Gemini returned an empty response.' }, { status: 500 })
        }

        const extracted = JSON.parse(raw)

        // Sanitize string "null" from Gemini if it happens
        if (extracted.contactId === 'null') extracted.contactId = null
        if (extracted.newContactName === 'null') extracted.newContactName = null
        if (extracted.newContactType === 'null') extracted.newContactType = null
        if (extracted.note === 'null') extracted.note = null

        return NextResponse.json(extracted)
    } catch (err) {
        console.error('[extract-voice] Error:', err)
        return NextResponse.json(
            { error: 'Failed to extract transaction from voice. Please try again.' },
            { status: 500 }
        )
    }
}
