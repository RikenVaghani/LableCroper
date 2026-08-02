import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Loader2, LockOpen, Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface UnlockPDFProps {
  files: File[];
  onDownload: (blob: Blob, name: string) => void;
}

export function UnlockPDF({ files, onDownload }: UnlockPDFProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDownload = async () => {
    if (!files[0]) return;
    setIsProcessing(true);
    setError('');
    setSuccess(false);
    try {
      const arrayBuffer = await files[0].arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { password } as any);
      
      const bytes = await pdf.save({ useObjectStreams: false });
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      
      setSuccess(true);
      setTimeout(() => {
        onDownload(blob, `unlocked_${files[0].name}`);
      }, 1000);
    } catch (err: any) {
      console.error('Error unlocking PDF:', err);
      if (err.message?.includes('password')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError('Failed to unlock PDF. The file might not be encrypted or is corrupted.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-6 space-y-6 text-center">
        <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">This PDF is password protected</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Enter the password to permanently unlock this document.</p>
        </div>

        <div className="text-left space-y-2">
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter PDF password"
              className={cn(
                "w-full pl-4 pr-10 py-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 transition-all",
                error ? "border-red-500 focus:ring-red-500 animate-[shake_0.5s_ease-in-out]" : "border-slate-300 dark:border-slate-600 focus:ring-orange-500"
              )}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-red-500 pl-1">{error}</p>}
        </div>
      </div>

      <div className="text-center">
         <p className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> Your file never leaves your device
         </p>
      </div>

      <div className="flex justify-center mt-8">
        <button
          onClick={handleDownload}
          disabled={isProcessing || !password}
          className="inline-flex h-16 w-72 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-xl font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          {isProcessing ? (
            <><Loader2 className="h-6 w-6 animate-spin" /> Unlocking...</>
          ) : success ? (
            <><CheckCircle2 className="h-6 w-6" /> Password removed!</>
          ) : (
            <><LockOpen className="h-6 w-6" /> Remove Password</>
          )}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}} />
    </div>
  );
}
