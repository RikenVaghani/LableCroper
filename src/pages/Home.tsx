import { Link } from 'react-router-dom'
import { Scissors, FileText, ArrowRight, Gamepad2 } from 'lucide-react'
import { motion } from 'framer-motion'

export function Home() {
  const tools = [
    {
      title: 'Label Cropper for E-commerce',
      description: 'Automatically crop and process shipping labels for Flipkart, Meesho, and Amazon. Supports dynamic invoice detection and Amazon description extraction.',
      icon: <Scissors className="h-8 w-8 text-sky-600" />,
      path: '/LableCroper',
      color: 'bg-sky-50'
    },
    {
      title: 'PDF Tools',
      description: 'Essential PDF utilities: merge multiple documents, split pages, or convert PDF pages to high-quality images.',
      icon: <FileText className="h-8 w-8 text-indigo-600" />,
      path: '/PDFTools',
      color: 'bg-indigo-50'
    },
    {
      title: 'Mini Games',
      description: 'Take a break with fun classics: Tic Tac Toe, Snake, Block Breaker, and more. Perfect for a quick relaxation between tasks.',
      icon: <Gamepad2 className="h-8 w-8 text-purple-600" />,
      path: '/Games',
      color: 'bg-purple-50'
    }
  ]

  return (
    <div className="space-y-8 py-4 sm:py-8">
      <section className="text-center space-y-4">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-4xl">
          Everything You Need for <span className="text-sky-600 dark:text-sky-400">PDFs & Labels</span>
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Professional tools designed for e-commerce sellers and PDF management. Fast, secure, and entirely in your browser.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {tools.map((tool, index) => (
          <motion.div
            key={tool.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              to={tool.path}
              className="group relative block h-full overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all hover:border-sky-300 dark:hover:border-sky-600 hover:shadow-md dark:hover:shadow-sky-900/10"
            >
              <div className={`mb-6 inline-flex rounded-2xl ${tool.color} dark:bg-slate-800 p-4`}>
                {tool.icon}
              </div>
              <h3 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {tool.title}
              </h3>
              <p className="mb-6 text-slate-600 dark:text-slate-400 leading-relaxed">
                {tool.description}
              </p>
              <div className="flex items-center font-bold text-sky-600 dark:text-sky-400">
                Explore Tool
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      
      <section className="rounded-3xl bg-slate-900 dark:bg-slate-800 p-8 text-white text-center">
        <h3 className="text-xl font-bold mb-2">Private & Secure</h3>
        <p className="text-slate-400 dark:text-slate-500 max-w-lg mx-auto">
          All processing happens locally in your browser. Your files are never uploaded to our servers, ensuring 100% privacy and data security.
        </p>
      </section>
    </div>
  )
}
