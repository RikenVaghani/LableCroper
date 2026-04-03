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

      <footer className="border-t border-slate-200 bg-slate-50/50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Brand Section */}
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-lg font-bold text-slate-900">CodeSpire Technology</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-600">
                Delivering high-precision thermal printing solutions and custom software architecture.
              </p>
            </div>

            {/* Credits Section */}
            <div className="text-sm">
              <h4 className="font-semibold text-slate-900">Developed By</h4>
              <ul className="mt-2 space-y-1 text-slate-600">
                <li>R V.</li>
                <li>S N.</li>
                <li className="pt-2 text-xs italic text-slate-400">Special thanks: Pratham D.</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-200 pt-8 text-center">
            <p className="text-xs font-medium text-blue-600 mb-2">
              ✓ Best Result in Fit to Page Position in Thermal Printer
            </p>
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} CodeSpire Technology. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
