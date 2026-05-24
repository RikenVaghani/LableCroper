import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, StickyNote, Save, Clock, Type, Minus, Highlighter, Underline } from 'lucide-react'
import { cn } from '../utils/cn'

interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

const STORAGE_KEY = 'easy_my_tools_notes_v1'
const FONT_SIZE_KEY = 'easy_my_tools_notepad_font_size_v1'

export function Notepad() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return [{ id: '1', title: 'Note 1', content: '', updatedAt: Date.now() }]
      }
    }
    return [{ id: '1', title: 'Note 1', content: '', updatedAt: Date.now() }]
  })

  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || '1')
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY)
    const parsed = saved ? Number(saved) : NaN
    return Number.isFinite(parsed) ? Math.min(40, Math.max(12, parsed)) : 22
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize))
  }, [fontSize])

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0]
  const plainTextContent = (activeNote?.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  const updateNote = (content: string) => {
    setNotes(prev => prev.map(n => 
      n.id === activeNoteId 
        ? { ...n, content, updatedAt: Date.now() } 
        : n
    ))
  }

  const addNote = () => {
    const newId = Math.random().toString(36).substr(2, 9)
    const newNote: Note = {
      id: newId,
      title: `Note ${notes.length + 1}`,
      content: '',
      updatedAt: Date.now()
    }
    setNotes(prev => [...prev, newNote])
    setActiveNoteId(newId)
  }

  const deleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (notes.length === 1) {
      setNotes([{ id: '1', title: 'Note 1', content: '', updatedAt: Date.now() }])
      return
    }
    const nextNotes = notes.filter(n => n.id !== id)
    setNotes(nextNotes)
    if (activeNoteId === id) {
      setActiveNoteId(nextNotes[0].id)
    }
  }

  useEffect(() => {
    if (editorRef.current && activeNote) {
      editorRef.current.innerHTML = activeNote.content || ''
    }
  }, [activeNoteId, activeNote?.content])

  const updateActiveNoteFromEditor = () => {
    if (!editorRef.current) return
    updateNote(editorRef.current.innerHTML)
  }

  const applyInlineFormat = (command: 'underline' | 'hiliteColor', value?: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    if (command === 'hiliteColor') {
      document.execCommand('hiliteColor', false, value ?? '#fef08a')
    } else {
      document.execCommand(command, false)
    }
    updateActiveNoteFromEditor()
  }

  const saveLocalFile = () => {
    if (!activeNote) return
    const baseName = (activeNote.title || 'note').trim().replace(/[\\/:*?"<>|]/g, '_') || 'note'
    const textContent = (editorRef.current?.innerText ?? '').replace(/\r?\n/g, '\n')
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <StickyNote className="h-6 w-6 text-amber-500" />
              Online Notepad
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Private notes saved locally in your browser.
            </p>
          </div>
          <button
            onClick={addNote}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Note
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {/* Top Navigation / Tabs */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">Your Notes</p>
          <div className="flex flex-wrap gap-2">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all min-w-[140px] max-w-[200px]",
                  activeNoteId === note.id
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-semibold truncate",
                    activeNoteId === note.id ? "text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                  )}>
                    {note.title}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteNote(note.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
            <button
              onClick={addNote}
              className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2.5 text-slate-500 hover:border-sky-500 hover:text-sky-500 transition-all"
              title="Add Note"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="w-full">
          <motion.div
            key={activeNoteId}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col h-[850px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                  <Type className="h-4 w-4" />
                </div>
                <input 
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setNotes(prev => prev.map(n => n.id === activeNoteId ? { ...n, title } : n))
                  }}
                  className="bg-transparent border-none focus:ring-0 font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  placeholder="Note Title..."
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setFontSize(prev => Math.max(12, prev - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Decrease text size"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize(prev => Math.min(40, prev + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Increase text size"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyInlineFormat('hiliteColor', '#fef08a')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Highlight selected text"
                >
                  <Highlighter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyInlineFormat('underline')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Underline selected text"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Saved
                </span>
                <button
                  type="button"
                  onClick={saveLocalFile}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Save file in local device"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Local
                </button>
              </div>
            </div>
            
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={updateActiveNoteFromEditor}
              className="flex-1 p-6 bg-transparent overflow-auto focus:outline-none text-slate-700 dark:text-slate-300 leading-relaxed"
              style={{ fontSize: `${fontSize}px`, direction: 'ltr', unicodeBidi: 'plaintext', writingMode: 'horizontal-tb', whiteSpace: 'pre-wrap' }}
              data-placeholder="Start writing your note here..."
              spellCheck={false}
            />
            
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex gap-4">
                <span>{plainTextContent.length} characters</span>
                <span>{plainTextContent.split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <p>Everything stays in your browser</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
