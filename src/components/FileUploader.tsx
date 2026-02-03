import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, AlertCircle } from 'lucide-react'
import { cn } from '../utils/cn'

interface FileUploaderProps {
    onFileSelect: (file: File) => void;
    className?: string;
    multiple?: boolean;
}

export function FileUploader({ onFileSelect, className, multiple = false }: FileUploaderProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            // Pass one by one or handle array? props say onFileSelect takes one file.
            // Changing this to support external array handling
            acceptedFiles.forEach(file => onFileSelect(file));
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        },
        maxFiles: multiple ? undefined : 1,
        multiple: multiple
    });

    return (
        <div className={cn("w-full max-w-2xl mx-auto", className)}>
            <div
                {...getRootProps()}
                className={cn(
                    "relative group cursor-pointer flex flex-col items-center justify-center w-full h-64 rounded-3xl border-2 border-dashed transition-all duration-300 ease-in-out bg-white/50 backdrop-blur-sm",
                    isDragActive ? "border-indigo-500 bg-indigo-50/50 scale-[1.02]" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50",
                    isDragReject && "border-red-500 bg-red-50/50",
                )}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                    <div className={cn(
                        "p-4 rounded-full mb-4 transition-colors duration-300",
                        isDragActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"
                    )}>
                        <Upload className="w-8 h-8" />
                    </div>

                    <p className="mb-2 text-xl font-semibold text-slate-700">
                        {isDragActive ? "Drop your shipping labels here" : "Upload Shipping Labels"}
                    </p>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                        Drag & drop your PDF file here, or click to browse.
                        <br />
                        <span className="text-xs text-slate-400 mt-1 block">Supports Flipkart, Meesho & more</span>
                    </p>
                </div>

                {fileRejections.length > 0 && (
                    <div className="absolute bottom-4 left-0 right-0 mx-auto w-max px-4 py-2 bg-red-100 text-red-600 rounded-full text-sm flex items-center shadow-sm animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Please upload a valid PDF file
                    </div>
                )}
            </div>
        </div>
    )
}
