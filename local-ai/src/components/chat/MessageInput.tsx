import { type ChangeEvent, type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { convertAudioBlobToWav } from '@/lib/audio';
import { cn } from '@/lib/utils';
import type { AudioNoteDraft, DocumentAttachmentDraft } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useVoiceStore } from '@/stores/voiceStore';

const MESSAGE_CHARACTER_LIMIT = 2000;
const MAX_IMAGE_ATTACHMENTS = 4;
const MAX_AUDIO_ATTACHMENTS = 2;
const MAX_DOCUMENT_ATTACHMENTS = 4;
const MAX_DOCUMENT_TEXT_CHARACTERS = 20000;
const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'log']);

interface PendingImageAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

interface PendingAudioAttachment {
  id: string;
  file: File;
  audioUrl: string;
  transcript: string;
  isTranscribing: boolean;
}

interface PendingDocumentAttachment {
  id: string;
  file: File;
  extractedText: string;
}

export function MessageInput() {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparingMic, setIsPreparingMic] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImageAttachment[]>([]);
  const [pendingAudioNotes, setPendingAudioNotes] = useState<PendingAudioAttachment[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocumentAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDraggingAttachments, setIsDraggingAttachments] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImageAttachment[]>([]);
  const pendingAudioNotesRef = useRef<PendingAudioAttachment[]>([]);
  const pendingDocumentsRef = useRef<PendingDocumentAttachment[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { sendMessage, isLoading } = useChatStore();
  const settings = useSettingsStore((state) => state.settings);
  const { transcribeAudio, isTranscribing, setError } = useVoiceStore();

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    pendingAudioNotesRef.current = pendingAudioNotes;
  }, [pendingAudioNotes]);

  useEffect(() => {
    pendingDocumentsRef.current = pendingDocuments;
  }, [pendingDocuments]);

  useEffect(() => {
    return () => {
      stopStream();
      pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      pendingAudioNotesRef.current.forEach((item) => URL.revokeObjectURL(item.audioUrl));
    };
  }, []);

  const handleSubmit = () => {
    if (
      (!input.trim() &&
        pendingImages.length === 0 &&
        pendingAudioNotes.length === 0 &&
        pendingDocuments.length === 0) ||
      isLoading ||
      hasPendingAudioTranscription
    ) {
      return;
    }

    const imagesToSend = pendingImages.map((item) => item.file);
    const audioNotesToSend: AudioNoteDraft[] = pendingAudioNotes
      .filter((item) => !item.isTranscribing)
      .map((item) => ({
        file: item.file,
        transcript: item.transcript,
        mimeType: item.file.type,
      }));
    const documentsToSend: DocumentAttachmentDraft[] = pendingDocuments.map((item) => ({
      file: item.file,
      extractedText: item.extractedText,
      mimeType: item.file.type,
    }));

    void sendMessage(input.trim(), imagesToSend, audioNotesToSend, documentsToSend);
    setInput('');
    clearPendingImages();
    clearPendingAudioNotes();
    clearPendingDocuments();
    setAttachmentError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const wantsShortcutSend = event.ctrlKey || event.metaKey;
    const shouldSend =
      event.key === 'Enter' &&
      !event.shiftKey &&
      (settings.sendOnEnter ? !wantsShortcutSend : wantsShortcutSend);

    if (shouldSend) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!settings.enableVoiceInput) {
      setError('Voice input is disabled in Settings.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This device does not support microphone capture in the app.');
      return;
    }

    setIsPreparingMic(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getPreferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError('Microphone recording failed.');
        setIsRecording(false);
        setIsPreparingMic(false);
        stopStream();
      };

      recorder.onstop = () => {
        void finalizeRecording(recorder.mimeType || mimeType || 'audio/webm');
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      setError(`Unable to access the microphone. (${String(error)})`);
      stopStream();
    } finally {
      setIsPreparingMic(false);
    }
  };

  const finalizeRecording = async (mimeType: string) => {
    try {
      const audioBlob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      stopStream();

      if (audioBlob.size === 0) {
        setError('No audio was captured.');
        return;
      }

      const wavBytes = await convertAudioBlobToWav(audioBlob);
      const transcript = await transcribeAudio(wavBytes);

      if (transcript === null) {
        return;
      }

      const cleaned = transcript.trim();
      if (!cleaned) {
        setError('Whisper did not detect usable speech. Try speaking a little louder or recording a bit longer.');
        return;
      }

      const audioBytes = new Uint8Array(wavBytes.length);
      audioBytes.set(wavBytes);
      const audioFile = new File([audioBytes], `audio-note-${Date.now()}.wav`, { type: 'audio/wav' });
      addReadyAudioNote(audioFile, cleaned);
      setAttachmentError(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (error) {
      setError(`Voice transcription failed. (${String(error)})`);
    }
  };

  const stopStream = () => {
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  };

  const canUseVoiceInput = settings.enableVoiceInput;
  const hasPendingAudioTranscription = pendingAudioNotes.some((item) => item.isTranscribing);

  const handleSelectAttachments = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    void addPendingAttachments(files);
    event.target.value = '';
  };

  const addPendingAttachments = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const audioFiles = files.filter((file) => file.type.startsWith('audio/'));
    const documentFiles = files.filter(isSupportedDocumentFile);

    if (imageFiles.length + audioFiles.length + documentFiles.length !== files.length) {
      setAttachmentError('Only images, audio notes, and text-based documents can be attached right now.');
    } else {
      setAttachmentError(null);
    }

    addPendingImages(imageFiles);
    await addPendingAudioFiles(audioFiles);
    await addPendingDocuments(documentFiles);
  };

  const addPendingImages = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setPendingImages((current) => {
      const availableSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - current.length);
      const nextFiles = files.slice(0, availableSlots);

      if (nextFiles.length < files.length) {
        setAttachmentError(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images at a time.`);
      }

      const nextItems = nextFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      return [...current, ...nextItems];
    });
  };

  const addPendingAudioFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const availableSlots = Math.max(0, MAX_AUDIO_ATTACHMENTS - pendingAudioNotesRef.current.length);
    const nextFiles = files.slice(0, availableSlots);

    if (nextFiles.length < files.length) {
      setAttachmentError(`You can attach up to ${MAX_AUDIO_ATTACHMENTS} audio notes at a time.`);
    }

    for (const file of nextFiles) {
      const id = crypto.randomUUID();
      const audioUrl = URL.createObjectURL(file);

      setPendingAudioNotes((current) => [
        ...current,
        {
          id,
          file,
          audioUrl,
          transcript: '',
          isTranscribing: true,
        },
      ]);

      try {
        const wavBytes = await convertAudioBlobToWav(file);
        const transcript = await transcribeAudio(wavBytes);
        const cleaned = transcript?.trim() ?? '';

        if (!cleaned) {
          setPendingAudioNotes((current) => {
            const target = current.find((item) => item.id === id);
            if (target) {
              URL.revokeObjectURL(target.audioUrl);
            }
            return current.filter((item) => item.id !== id);
          });
          setError('Whisper did not detect usable speech in that audio note.');
          continue;
        }

        setPendingAudioNotes((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  transcript: cleaned,
                  isTranscribing: false,
                }
              : item
          )
        );
      } catch (error) {
        setPendingAudioNotes((current) => {
          const target = current.find((item) => item.id === id);
          if (target) {
            URL.revokeObjectURL(target.audioUrl);
          }
          return current.filter((item) => item.id !== id);
        });
        setError(`Audio note transcription failed. (${String(error)})`);
      }
    }
  };

  const addReadyAudioNote = (file: File, transcript: string) => {
    const audioUrl = URL.createObjectURL(file);
    setPendingAudioNotes((current) => {
      if (current.length >= MAX_AUDIO_ATTACHMENTS) {
        URL.revokeObjectURL(audioUrl);
        setAttachmentError(`You can attach up to ${MAX_AUDIO_ATTACHMENTS} audio notes at a time.`);
        return current;
      }

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          file,
          audioUrl,
          transcript,
          isTranscribing: false,
        },
      ];
    });
  };

  const addPendingDocuments = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const availableSlots = Math.max(0, MAX_DOCUMENT_ATTACHMENTS - pendingDocumentsRef.current.length);
    const nextFiles = files.slice(0, availableSlots);

    if (nextFiles.length < files.length) {
      setAttachmentError(`You can attach up to ${MAX_DOCUMENT_ATTACHMENTS} documents at a time.`);
    }

    for (const file of nextFiles) {
      try {
        const extractedText = await extractDocumentText(file);
        if (!extractedText.trim()) {
          setAttachmentError(`"${file.name}" did not contain usable text.`);
          continue;
        }

        setPendingDocuments((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            file,
            extractedText,
          },
        ]);
      } catch (error) {
        setAttachmentError(`Could not read "${file.name}" as a supported text document. (${String(error)})`);
      }
    }
  };

  const removePendingImage = (id: string) => {
    setPendingImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const removePendingAudioNote = (id: string) => {
    setPendingAudioNotes((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.audioUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const removePendingDocument = (id: string) => {
    setPendingDocuments((current) => current.filter((item) => item.id !== id));
  };

  const clearPendingImages = () => {
    setPendingImages((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const clearPendingAudioNotes = () => {
    setPendingAudioNotes((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.audioUrl));
      return [];
    });
  };

  const clearPendingDocuments = () => {
    setPendingDocuments([]);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDraggingAttachments) {
      setIsDraggingAttachments(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingAttachments(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingAttachments(false);
    void addPendingAttachments(Array.from(event.dataTransfer.files ?? []));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className={cn(
          'rounded-[1.8rem] border border-border/80 bg-[hsl(var(--panel-strong))] p-3 shadow-[var(--surface-shadow)] backdrop-blur-[22px] transition-colors',
          isDraggingAttachments && 'border-primary bg-primary/5'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {pendingImages.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2 px-1 pt-1">
            {pendingImages.map((item) => (
              <div key={item.id} className="relative overflow-hidden rounded-2xl border border-border bg-secondary/35 shadow-[var(--surface-shadow-soft)]">
                <img src={item.previewUrl} alt={item.file.name} className="h-20 w-20 object-cover" />
                <button
                  type="button"
                  onClick={() => removePendingImage(item.id)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                  aria-label={`Remove ${item.file.name}`}
                  title="Remove image"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {pendingAudioNotes.length > 0 ? (
          <div className="mb-2 space-y-2 px-1 pt-1">
            {pendingAudioNotes.map((item) => (
              <div key={item.id} className="relative rounded-2xl border border-border bg-secondary/35 p-3 shadow-[var(--surface-shadow-soft)]">
                <button
                  type="button"
                  onClick={() => removePendingAudioNote(item.id)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                  aria-label={`Remove ${item.file.name}`}
                  title="Remove audio note"
                >
                  X
                </button>
                <p className="pr-8 text-xs font-medium text-foreground">{item.file.name}</p>
                <audio controls preload="metadata" className="mt-2 w-full" src={item.audioUrl} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.isTranscribing ? 'Transcribing audio note...' : item.transcript}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {pendingDocuments.length > 0 ? (
          <div className="mb-2 space-y-2 px-1 pt-1">
            {pendingDocuments.map((item) => (
              <div key={item.id} className="relative rounded-2xl border border-border bg-secondary/35 p-3 shadow-[var(--surface-shadow-soft)]">
                <button
                  type="button"
                  onClick={() => removePendingDocument(item.id)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                  aria-label={`Remove ${item.file.name}`}
                  title="Remove document"
                >
                  X
                </button>
                <p className="pr-8 text-xs font-medium text-foreground">{item.file.name}</p>
                <p className="mt-2 line-clamp-4 text-xs text-muted-foreground">{item.extractedText}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2.5">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MESSAGE_CHARACTER_LIMIT}
              placeholder={
                canUseVoiceInput
                  ? 'Type a message, drop media or documents, or record an audio note...'
                  : 'Type a message or drop media/documents...'
              }
              disabled={isTranscribing || hasPendingAudioTranscription}
              rows={1}
              className={cn(
                'w-full resize-none rounded-[1.35rem] border border-border/85 bg-background/85 px-4 py-3.5 pr-14 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
                'focus:outline-none focus:ring-2 focus:ring-primary/35',
                'placeholder:text-muted-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />

            {input.length > 0 && (
              <span className="absolute bottom-1 right-14 text-xs text-muted-foreground">
                {input.length}/{MESSAGE_CHARACTER_LIMIT}
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,.txt,.md,.markdown,.csv,.json,.log"
            multiple
            className="hidden"
            onChange={handleSelectAttachments}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              isLoading ||
              isTranscribing ||
              hasPendingAudioTranscription ||
              (
                pendingImages.length >= MAX_IMAGE_ATTACHMENTS &&
                pendingAudioNotes.length >= MAX_AUDIO_ATTACHMENTS &&
                pendingDocuments.length >= MAX_DOCUMENT_ATTACHMENTS
              )
            }
            aria-label="Attach media"
            title="Attach image, document, or audio note"
            className={cn(
              'rounded-[1.2rem] border border-border/80 p-3 transition-all duration-150',
              'bg-background/85 text-foreground shadow-[var(--surface-shadow-soft)] hover:border-primary/20 hover:bg-accent/35 hover:text-accent-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <AttachmentIcon className="h-5 w-5" />
          </button>

          {canUseVoiceInput ? (
            <button
              onClick={() => void handleVoiceToggle()}
              disabled={isLoading || isTranscribing || isPreparingMic || hasPendingAudioTranscription}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              title={isRecording ? 'Stop recording audio note' : 'Record audio note'}
              className={cn(
                'rounded-[1.2rem] border border-border/80 p-3 transition-all duration-150',
                isRecording
                  ? 'border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/15'
                  : 'bg-background/85 text-foreground shadow-[var(--surface-shadow-soft)] hover:border-primary/20 hover:bg-accent/35 hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {isPreparingMic ? <SpinnerIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" recording={isRecording} />}
            </button>
          ) : null}

          <button
            onClick={handleSubmit}
            disabled={
              (!input.trim() &&
                pendingImages.length === 0 &&
                pendingAudioNotes.length === 0 &&
                pendingDocuments.length === 0) ||
              isLoading ||
              isTranscribing ||
              hasPendingAudioTranscription
            }
            className={cn(
              'rounded-[1.2rem] bg-primary p-3 text-primary-foreground shadow-[0_16px_30px_hsl(var(--primary)/0.2)] transition-all duration-150 hover:translate-y-[-1px] hover:bg-primary/92',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {attachmentError ? <p className="mt-2 px-1 text-xs text-amber-600">{attachmentError}</p> : null}
      {pendingImages.length > 0 || pendingAudioNotes.length > 0 || pendingDocuments.length > 0 ? (
        <p className="mt-3 px-1 text-xs text-muted-foreground">
          {[
            pendingImages.length > 0
              ? `${pendingImages.length} image${pendingImages.length === 1 ? '' : 's'}`
              : null,
            pendingAudioNotes.length > 0
              ? `${pendingAudioNotes.length} audio note${pendingAudioNotes.length === 1 ? '' : 's'}`
              : null,
            pendingDocuments.length > 0
              ? `${pendingDocuments.length} document${pendingDocuments.length === 1 ? '' : 's'}`
              : null,
          ]
            .filter(Boolean)
            .join(' and ')}{' '}
          attached. These will be copied into the active workspace when you send the message.
        </p>
      ) : null}
    </div>
  );
}

function getPreferredMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((value) => MediaRecorder.isTypeSupported(value));
}

function isSupportedDocumentFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_DOCUMENT_EXTENSIONS.has(extension);
}

async function extractDocumentText(file: File) {
  const raw = await file.text();
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= MAX_DOCUMENT_TEXT_CHARACTERS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_DOCUMENT_TEXT_CHARACTERS)}\n\n[Document truncated for prompt budget.]`;
}

function MicIcon({ className, recording = false }: { className?: string; recording?: boolean }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={recording ? 'M12 6v6m0 0v4m0-4l3-3m-3 3l-3-3M8 5a4 4 0 118 0v3a4 4 0 11-8 0V5zm-1 7a5 5 0 0010 0m-8 7h6' : 'M12 1a3 3 0 00-3 3v7a3 3 0 106 0V4a3 3 0 00-3-3zm5 10a5 5 0 01-10 0m5 5v3m-4 0h8'}
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function AttachmentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 11-7.78-7.78l9.2-9.19a3.5 3.5 0 114.95 4.95l-9.2 9.19a1.5 1.5 0 11-2.12-2.12l8.49-8.48" />
    </svg>
  );
}
