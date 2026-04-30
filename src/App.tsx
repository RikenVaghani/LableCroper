import { lazy, Suspense } from 'react'
import { Analytics } from '@vercel/analytics/react';
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Loader2 } from 'lucide-react'

// Code splitting for faster initial load
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })))
const LabelCropper = lazy(() => import('./pages/LabelCropper').then(m => ({ default: m.LabelCropper })))
const PDFTools = lazy(() => import('./pages/PDFTools').then(m => ({ default: m.PDFTools })))
const Games = lazy(() => import('./pages/Games').then(m => ({ default: m.Games })))
const Notepad = lazy(() => import('./pages/Notepad').then(m => ({ default: m.Notepad })))

const LoadingFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
  </div>
)

function App() {
  return (
    <>
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/LabelCropper" element={<LabelCropper />} />
            <Route path="/PDFTools" element={<PDFTools />} />
            <Route path="/Games" element={<Games />} />
            <Route path="/Notepad" element={<Notepad />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
      <Analytics />
    </>
  )
}

export default App
