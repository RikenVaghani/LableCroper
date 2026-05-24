import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, StickyNote, Save, Clock, Type, Minus, Bold, Italic, Underline, Highlighter } from 'lucide-react'
import { cn } from '../utils/cn'

interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

const STORAGE_KEY = 'easy_my_tools_notes_v1'
const FONT_SIZE_KEY = 'easy_my_tools_notepad_font_size_v1'

const getPlainText = (html: string) => {
  if (!html) return ''
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || doc.body.innerText || ''
  } catch {
    return html
  }
}


export function Notepad() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
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
  const editorRef = useRef<HTMLDivElement>(null)

  const savedSelectionRef = useRef<Range | null>(null)
  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
  })

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection()
      if (sel) {
        const isCollapsed = savedSelectionRef.current.collapsed
        const isFocusInEditor = editorRef.current?.contains(document.activeElement) || 
                                editorRef.current?.contains(sel.anchorNode)
        
        // Always restore if selection is not collapsed (user highlighted text)
        // If selection is just a cursor (collapsed), only restore if focus has left the editor
        if (!isCollapsed || !isFocusInEditor) {
          sel.removeAllRanges()
          sel.addRange(savedSelectionRef.current)
        }
      }
    }
  }

  const checkActiveStyles = () => {
    try {
      setActiveStyles({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    } catch {
      // ignore if command state query is not supported
    }
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize))
  }, [fontSize])

  // Listen to native document selectionchange to capture drag selection inside contenteditable
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0)
        // Check if the selection is inside our editor
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedSelectionRef.current = range.cloneRange()
          checkActiveStyles()
        }
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0]
  const activeNoteContent = activeNote?.content || ''
  const plainText = getPlainText(activeNoteContent)
  const plainTextContent = plainText.replace(/\s+/g, ' ').trim()

  const isEditorEmpty = !activeNoteContent || 
    activeNoteContent === '<br>' || 
    activeNoteContent === '<div><br></div>' || 
    activeNoteContent === '<p><br></p>' ||
    activeNoteContent.trim() === ''

  // Sync editor content and reset selection/active styles when the active note changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== activeNoteContent) {
      editorRef.current.innerHTML = activeNoteContent
    }
    savedSelectionRef.current = null
    setActiveStyles({ bold: false, italic: false, underline: false })
  }, [activeNoteId])

  const updateNote = (content: string) => {
    setNotes(prev =>
      prev.map(n =>
        n.id === activeNoteId ? { ...n, content, updatedAt: Date.now() } : n
      )
    )
  }

  const handleFormat = (command: string, value: string = '') => {
    restoreSelection()

    try {
      document.execCommand('styleWithCSS', false, 'true')
    } catch (e) {
      // ignore
    }

    if (command === 'hiliteColor') {
      document.execCommand('backColor', false, value)
    } else {
      document.execCommand(command, false, value)
    }

    if (editorRef.current) {
      updateNote(editorRef.current.innerHTML)
    }

    saveSelection()
  }

  const addNote = () => {
    const newId = Math.random().toString(36).slice(2, 11)
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

  const saveLocalFile = () => {
    if (!activeNote) return
    const baseName = (activeNote.title || 'note').trim().replace(/[\\/:*?"<>|]/g, '_') || 'note'
    const plainTextStr = getPlainText(activeNote.content)
    const textContent = plainTextStr.replace(/\r?\n/g, '\n')
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
              Simple notes saved locally in your browser.
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
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your Notes</p>
            <button
              onClick={addNote}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              title="Add new note"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all min-w-[140px] max-w-[200px]',
                  activeNoteId === note.id
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'text-sm font-semibold truncate',
                    activeNoteId === note.id ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
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
              className="group relative flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2.5 hover:border-amber-500 hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-all min-w-[100px] text-slate-500 hover:text-amber-600 dark:hover:text-amber-400"
              title="Add Note"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-semibold">New</span>
            </button>
          </div>
        </div>

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
                  lang="en-US"
                  spellCheck
                  dir="ltr"
                  style={{
                    direction: 'ltr',
                    unicodeBidi: 'normal',
                    textAlign: 'left'
                  }}
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
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Saved
                </span>
                <button
                  type="button"
                  onClick={saveLocalFile}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Save file on your local device"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Local
                </button>
              </div>
            </div>

            {/* Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-slate-50/30 dark:bg-slate-800/30 backdrop-blur-sm">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleFormat('bold')
                  checkActiveStyles()
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  activeStyles.bold
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                )}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleFormat('italic')
                  checkActiveStyles()
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  activeStyles.italic
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                )}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleFormat('underline')
                  checkActiveStyles()
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  activeStyles.underline
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                )}
                title="Underline"
              >
                <Underline className="h-4 w-4" />
              </button>

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1.5" />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('hiliteColor', '#fef08a')}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title="Highlight Yellow"
              >
                <Highlighter className="h-4 w-4 text-amber-500" />
              </button>
            </div>

            {/* Editable Content Area */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder-visible={isEditorEmpty ? 'true' : 'false'}
              onInput={(e) => updateNote(e.currentTarget.innerHTML)}
              onKeyUp={checkActiveStyles}
              onMouseUp={checkActiveStyles}
              className="flex-1 p-6 bg-transparent overflow-auto focus:outline-none text-slate-700 dark:text-slate-300 leading-relaxed min-h-[300px] relative max-w-none"
              style={{
                fontSize: `${fontSize}px`,
                direction: 'ltr',
                unicodeBidi: 'normal',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              data-placeholder="Start writing your note here..."
              lang="en-US"
              spellCheck
              dir="ltr"
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
