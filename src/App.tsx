import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { LabelCropper } from './pages/LabelCropper'
import { PDFTools } from './pages/PDFTools'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/LableCroper" element={<LabelCropper />} />
        <Route path="/PDFTools" element={<PDFTools />} />
        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
