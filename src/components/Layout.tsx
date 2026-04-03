import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../utils/cn'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#f0f9ff,_#f8fafc_45%,_#ffffff)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="h-10 w-10 rounded-xl bg-sky-600 p-2 shadow-sm">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Easymytools" className="h-full w-full object-contain brightness-0 invert" />
            </div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">Easymytools</h1>
              <p className="text-xs text-slate-500">Simple tools for label and PDF processing</p>
            </div>
          </Link>

          <nav className="flex w-full gap-2 sm:w-auto">
            <Link
              to="/LableCroper"
              className={cn(
                'flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition text-center sm:flex-none',
                currentPath === '/LableCroper'
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
              )}
            >
              Label Cropper
            </Link>
            <Link
              to="/PDFTools"
              className={cn(
                'flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition text-center sm:flex-none',
                currentPath === '/PDFTools'
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
              )}
            >
              PDF Tools
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-5">
        {children}
      </main>

      {/* <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 text-center text-sm text-slate-600 sm:px-6">
          Best Result in Fit to Page Position in Thermal Printer.  |  Copyright © {new Date().getFullYear()} Riken Vaghani. All rights reserved.
        </div>
      </footer> */}

      <footer className="mt-auto border-t border-slate-200 bg-white/50 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm font-medium text-slate-900">
              CodeSpire <span className="text-blue-600">Technology</span>
            </p>

            <div className="flex flex-col items-center gap-1 md:items-end">
              <p className="text-xs leading-relaxed text-slate-500">
                © {new Date().getFullYear()} Riken V. & Satyam N.
                <span className="mx-2 text-slate-300">|</span>
                Special thanks to <span className="font-medium text-slate-700">Pratham D.</span>
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">
                Optimized for Thermal Printer in Fit-to-Page Mode
              </p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
