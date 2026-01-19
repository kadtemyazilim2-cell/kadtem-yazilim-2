import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTurkishLower(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLocaleLowerCase('tr-TR');
}

export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';

  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}
