import { ExternalLink } from 'lucide-react'

export function TheCube() {
  return (
    <div className="w-full max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The Cube puzzle loaded from the official web version.
        </p>
        <a
          href="https://bsehovac.github.io/the-cube/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Open Fullscreen
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-black">
        <iframe
          src="https://bsehovac.github.io/the-cube/"
          title="The Cube"
          className="h-[70vh] w-full"
          loading="lazy"
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
