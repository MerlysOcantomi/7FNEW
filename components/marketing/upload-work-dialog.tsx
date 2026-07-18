"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, ImagePlus, X } from "lucide-react"
import { SmartModal } from "@/components/smart-modal"
import type { BeautyMarketingMessages } from "@modules/marketing/i18n"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_CLASS, LABEL_CLASS } from "./marketing-ui"

export interface UploadedWorkDraft {
  imageUrl: string
  fileName: string
  clientName: string
  service: string
  style: string
  beforeAfter: boolean
  notesForFreya: string
}

/**
 * "Upload photos" — frontend upload flow prepared to connect to a real storage
 * backend later. Select one or several images (mobile also offers the camera),
 * preview them, optionally add client/service/style/before-after/notes, and
 * confirm. Images travel as object URLs for now; the `UploadedWorkDraft`
 * contract is the seam where the future upload API plugs in. Nothing is
 * hardcoded inside the component.
 */
export function UploadWorkDialog({
  messages,
  open,
  onClose,
  onConfirm,
}: {
  messages: BeautyMarketingMessages
  open: boolean
  onClose: () => void
  onConfirm: (drafts: UploadedWorkDraft[]) => void
}) {
  const t = messages.upload
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [images, setImages] = useState<{ url: string; name: string }[]>([])
  const [clientName, setClientName] = useState("")
  const [service, setService] = useState("")
  const [style, setStyle] = useState("")
  const [beforeAfter, setBeforeAfter] = useState(false)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setImages([])
      setClientName("")
      setService("")
      setStyle("")
      setBeforeAfter(false)
      setNotes("")
      setError(null)
    }
  }, [open])

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const next: { url: string; name: string }[] = []
    let rejected = false
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) {
        rejected = true
        continue
      }
      next.push({ url: URL.createObjectURL(file), name: file.name })
    }
    setError(rejected ? t.errorType : null)
    if (next.length > 0) setImages((prev) => [...prev, ...next])
  }

  function removeImage(url: string) {
    URL.revokeObjectURL(url)
    setImages((prev) => prev.filter((img) => img.url !== url))
  }

  function handleConfirm() {
    if (images.length === 0) {
      setError(t.errorEmpty)
      return
    }
    onConfirm(
      images.map((img) => ({
        imageUrl: img.url,
        fileName: img.name,
        clientName: clientName.trim(),
        service: service.trim(),
        style: style.trim(),
        beforeAfter,
        notesForFreya: notes.trim(),
      })),
    )
  }

  return (
    <SmartModal open={open} onClose={onClose} title={t.title} size="lg">
      <div className="flex flex-col gap-4 p-5">
        {/* Pickers — camera capture (mobile) + gallery. */}
        <div className="grid grid-cols-2 gap-2">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <button type="button" onClick={() => cameraInputRef.current?.click()} className={BTN_SECONDARY}>
            <Camera size={14} strokeWidth={2} aria-hidden="true" />
            {t.takePhoto}
          </button>
          <button type="button" onClick={() => galleryInputRef.current?.click()} className={BTN_SECONDARY}>
            <ImagePlus size={14} strokeWidth={2} aria-hidden="true" />
            {t.fromGallery}
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary-light)]">{t.selectHint}</p>

        {/* Previews */}
        {images.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="list">
            {images.map((img) => (
              <li key={img.url} className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-dark)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(img.url)}
                  aria-label={t.removeImageAria(img.name)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{ background: "color-mix(in srgb, var(--text-primary-light) 60%, transparent)" }}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Optional metadata for Freya */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="upload-client" className={LABEL_CLASS}>
              {t.clientLabel}
            </label>
            <input
              id="upload-client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={INPUT_CLASS}
              placeholder={t.clientPlaceholder}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="upload-service" className={LABEL_CLASS}>
              {t.serviceLabel}
            </label>
            <input
              id="upload-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className={INPUT_CLASS}
              placeholder={t.servicePlaceholder}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="upload-style" className={LABEL_CLASS}>
              {t.styleLabel}
            </label>
            <input
              id="upload-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className={INPUT_CLASS}
              placeholder={t.stylePlaceholder}
            />
          </div>
          <div className="flex items-end pb-1.5">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[var(--text-primary-light)]">
              <input
                type="checkbox"
                checked={beforeAfter}
                onChange={(e) => setBeforeAfter(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent-primary)]"
              />
              {t.beforeAfterLabel}
            </label>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="upload-notes" className={LABEL_CLASS}>
              {t.notesLabel}
            </label>
            <textarea
              id="upload-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${INPUT_CLASS} resize-none`}
              placeholder={t.notesPlaceholder}
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-[12px] font-medium" style={{ color: "var(--inbox-urgency)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-[var(--border-dark)] pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            {t.cancel}
          </button>
          <button type="button" onClick={handleConfirm} className={BTN_PRIMARY}>
            {t.confirm}
          </button>
        </div>
      </div>
    </SmartModal>
  )
}
