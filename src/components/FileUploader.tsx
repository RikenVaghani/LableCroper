import { useCallback } from 'react'
import { useDropzone, type Accept } from 'react-dropzone'
import { Upload, AlertCircle } from 'lucide-react'
import { cn } from '../utils/cn'

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  className?: string
  multiple?: boolean
  title?: string
  activeTitle?: string
  description?: string
  hint?: string
  accept?: Accept
  rejectionMessage?: string
}

export function FileUploader({
  onFileSelect,
  className,
  multiple = false,
  title = 'Upload Shipping Labels',
  activeTitle = 'Drop your shipping labels here',
  description = 'Drag & drop your PDF file here, or click to browse.',
  hint = 'Supports Flipkart, Meesho & more',
  accept = {
    'application/pdf': ['.pdf']
  },
  rejectionMessage = 'Please upload a valid PDF file'
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        acceptedFiles.forEach(file => onFileSelect(file))
      }
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxFiles: multiple ? undefined : 1,
    multiple
  })

  return (
    <div className={cn('mx-auto w-full max-w-2xl', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'group relative flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm transition-all duration-300 ease-in-out',
          isDragActive ? 'scale-[1.02] border-sky-500 bg-sky-50/60 dark:bg-sky-900/40' : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800',
          isDragReject && 'border-red-500 bg-red-50/50 dark:bg-red-900/20'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center px-4 pb-6 pt-5 text-center">
          <div
            className={cn(
              'mb-1 rounded-full p-3 transition-colors duration-300 ',
              isDragActive ? 'bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/40 group-hover:text-sky-500 dark:group-hover:text-sky-400'
            )}
          >
            <Upload className="h-8 w-8" />
          </div>

          <p className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">{isDragActive ? activeTitle : title}</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {description}
            <br />
            <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>
          </p>
        </div>

        {fileRejections.length > 0 && (
          <div className="absolute bottom-4 left-0 right-0 mx-auto flex w-max items-center rounded-full bg-red-100 dark:bg-red-900/60 px-4 py-2 text-sm text-red-600 dark:text-red-400 shadow-sm">
            <AlertCircle className="mr-2 h-4 w-4" />
            {rejectionMessage}
          </div>
        )}
      </div>
    </div>
  )
}
