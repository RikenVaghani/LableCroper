import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sun, Moon, Gamepad2, StickyNote } from 'lucide-react'
import { cn } from '../utils/cn'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const currentPath = location.pathname

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light'
    }
    return 'light'
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#f0f9ff,_#f8fafc_45%,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_45%,_#000000)] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="h-10 w-10 rounded-xl bg-sky-600 shadow-sm">
              <img src="/logo.jpg" alt="Easymytools" className="rounded-xl h-full w-full object-contain " />
            </div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">EasyMyTools</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Simple tools for label and PDF processing</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <nav className="flex gap-2">
              <Link
                to="/LabelCropper"
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-semibold transition text-center',
                  currentPath === '/LabelCropper'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-300'
                )}
              >
                Label Cropper
              </Link>
              <Link
                to="/PDFTools"
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-semibold transition text-center',
                  currentPath === '/PDFTools'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-300'
                )}
              >
                PDF Tools
              </Link>
              {/* noteped */}
              <Link
                to="/Notepad"
                title="Notepad"
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-semibold transition text-center flex items-center gap-2',
                  currentPath === '/Notepad'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300'
                )}
              >
                <StickyNote className="h-4 w-4" />
              </Link>
              {/* games  */}
              <Link
                to="/Games"
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-semibold transition text-center flex items-center gap-2',
                  currentPath === '/Games'
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-300'
                )}
              >
                <Gamepad2 className="h-4 w-4" />
                {/* <span className="hidden sm:inline">Games</span> */}
              </Link>
            </nav>

            <button
              onClick={toggleTheme}
              className="group relative h-10 w-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300 transition-all hover:border-sky-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              aria-label="Toggle theme"
            >
              <Sun className="h-full w-full rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute left-[7px] top-[7px] h-[24px] w-[24px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-5">
        {children}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 lg:grid-cols-4">

            {/* Brand Section */}
            <div className="md:col-span-2">
              <a href="https://codespire.in/" target="_blank" rel="noopener noreferrer" className="group">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  CodeSpire Technology
                </h3>
              </a>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
                Delivering Easy-to-use E-Tools and Custom software architecture.
                Expertly crafted for modern performance.
              </p>
            </div>

            {/* Credits Section */}
            {/* <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Developed By
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-default">R V.</li>
                <li className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-default">S N.</li>
                <li className="pt-2">
                  <span className="text-xs italic text-slate-400 dark:text-slate-500">
                    Special thanks: <span className="text-slate-500 dark:text-slate-300">Pratham Dhanani</span>
                  </span>
                </li>
              </ul>
            </div> */}

            {/* Contact/Action Section (Added for "Good Look") */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Connect
              </h4>
              <div className="mt-2">
                <a href="mailto:rikenvaghani@gmail.com" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Contact Us &rarr;
                </a>
                <br />
                <br />
                <p> Any Suggation and feedback send Please <a href="mailto:rikenvaghani@gmail.com" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Get in touch &rarr;
                </a> </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              &copy; {new Date().getFullYear()} CodeSpire Technology. All rights reserved.   & Developed by <a href="https://codespire.in/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors">CodeSpire Technology</a>
            </p>
            <div className="flex gap-6 text-xs text-slate-500 dark:text-slate-400">
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>


    </div>
  )
}
