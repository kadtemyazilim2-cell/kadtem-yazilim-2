import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SimpleRichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}

export function SimpleRichTextEditor({ value, onChange, className, placeholder }: SimpleRichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);

    // Sync external value changes to internal textContent, but ONLY if they are different.
    // This is crucial to prevent cursor jumping.
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            // Only update if the content is drastically different to avoid loop
            // But for simple "controlled" input, we need to be careful.
            // If the user is typing, we shouldn't touch innerHTML.
            // We assume that if document.activeElement is this editor, the change CAME FROM HERE, so we skip.
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = value;
            }
        }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const newValue = e.currentTarget.innerHTML;
        onChange(newValue);
    };

    const execCmd = (command: string) => {
        document.execCommand(command, false, '');
        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    };

    return (
        <div className={cn("border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", className)}>
            <div className="flex items-center gap-1 p-1 border-b bg-muted/20">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => execCmd('bold')}
                    title="Kalın"
                >
                    <span className="font-bold">B</span>
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => execCmd('underline')}
                    title="Altı Çizili"
                >
                    <span className="underline">U</span>
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => execCmd('italic')}
                    title="İtalik"
                >
                    <span className="italic font-serif">I</span>
                </Button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                className="min-h-[200px] p-3 focus:outline-none max-h-[400px] overflow-y-auto"
                onInput={handleInput}
                style={{ whiteSpace: 'pre-wrap' }}
                suppressContentEditableWarning
                data-placeholder={placeholder}
            />
        </div>
    );
}
