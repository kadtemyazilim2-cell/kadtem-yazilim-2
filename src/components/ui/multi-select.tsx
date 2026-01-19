import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
// import { Separator } from "@/components/ui/separator";

export interface MultiSelectOption {
    label: string;
    value: string;
}

export interface MultiSelectProps {
    options: MultiSelectOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
    searchPlaceholder?: string;
    vertical?: boolean; // [NEW]
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Seçiniz...",
    className,
    searchPlaceholder = "Ara...",
    vertical = false, // [NEW]
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");

    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((item) => item !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const handleSelectAll = () => {
        if (selected.length === options.length) {
            onChange([]);
        } else {
            onChange(options.map((o) => o.value));
        }
    };

    const handleClear = () => {
        onChange([]);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-auto min-h-10 py-1 px-2", className)}
                >
                    <div className={cn("flex gap-1 max-w-[calc(100%-20px)]", vertical ? "flex-col items-start" : "flex-wrap items-center")}>
                        {selected.length === 0 && (
                            <span className="text-muted-foreground font-normal text-xs">{placeholder}</span>
                        )}
                        {selected.length > 0 && selected.length <= 3 ? (
                            selected.map((val) => {
                                const label = options.find(o => o.value === val)?.label || val;
                                return (
                                    <Badge key={val} variant="secondary" className="mr-1 mb-0.5 text-[10px] px-1 py-0 h-5">
                                        {label}
                                        <span
                                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleSelect(val);
                                            }}
                                        >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                        </span>
                                    </Badge>
                                );
                            })
                        ) : selected.length > 3 ? (
                            <Badge variant="secondary" className="mr-1 mb-0.5 text-[10px] px-1 py-0 h-5">
                                {selected.length} seçili
                            </Badge>
                        ) : null}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <div className="flex flex-col gap-2 p-2">
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 text-xs"
                    />
                    <div className="flex items-center justify-between text-xs px-1">
                        <span
                            className="cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                            onClick={handleSelectAll}
                        >
                            {selected.length === options.length ? 'Hepsini Kaldır' : 'Hepsini Seç'}
                        </span>
                        <span
                            className="cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                            onClick={handleClear}
                        >
                            Temizle
                        </span>
                    </div>

                    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <span className="text-xs text-muted-foreground text-center py-2">Sonuç bulunamadı.</span>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                    onClick={() => handleSelect(option.value)}
                                >
                                    <Checkbox
                                        id={`ms-${option.value}`}
                                        checked={selected.includes(option.value)}
                                        onCheckedChange={() => handleSelect(option.value)}
                                    />
                                    <label
                                        htmlFor={`ms-${option.value}`}
                                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer pointer-events-none"
                                    >
                                        {option.label}
                                    </label>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
