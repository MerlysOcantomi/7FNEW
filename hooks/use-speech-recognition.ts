"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  return (
    (window as unknown as Record<string, SpeechRecognitionCtor>).SpeechRecognition ??
    (window as unknown as Record<string, SpeechRecognitionCtor>).webkitSpeechRecognition ??
    null
  )
}

export interface UseSpeechRecognitionReturn {
  supported: boolean
  listening: boolean
  transcript: string
  start: (lang?: string) => void
  stop: () => void
  reset: () => void
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [supported] = useState(() => getRecognitionCtor() !== null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const stoppingRef = useRef(false)

  const stop = useCallback(() => {
    stoppingRef.current = true
    recognitionRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    stop()
    setTranscript("")
  }, [stop])

  const start = useCallback(
    (lang?: string) => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) return

      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }

      const recognition = new Ctor()
      recognition.lang = lang ?? navigator.language ?? "en-US"
      recognition.continuous = true
      recognition.interimResults = true

      let finalised = ""

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalised += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }
        setTranscript(finalised + interim)
      }

      recognition.onerror = () => {
        setListening(false)
        recognitionRef.current = null
      }

      recognition.onend = () => {
        setListening(false)
        recognitionRef.current = null

        if (!stoppingRef.current) {
          try {
            const retry = new Ctor()
            retry.lang = recognition.lang
            retry.continuous = true
            retry.interimResults = true
            retry.onresult = recognition.onresult
            retry.onerror = recognition.onerror
            retry.onend = recognition.onend
            retry.start()
            recognitionRef.current = retry
            setListening(true)
          } catch {
            /* browser blocked restart — silent fail */
          }
        }
        stoppingRef.current = false
      }

      try {
        recognition.start()
        recognitionRef.current = recognition
        stoppingRef.current = false
        setListening(true)
        setTranscript("")
      } catch {
        setListening(false)
      }
    },
    [],
  )

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  return { supported, listening, transcript, start, stop, reset }
}
