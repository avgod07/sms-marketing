import React from "react";
import { Input } from "./input";

// Format for display: (XXX) XXX-XXXX
export function formatPhoneNumber(value: string): string {
  const phoneNumber = value.replace(/\D/g, "");
  const cleaned = phoneNumber.startsWith("1") ? phoneNumber.slice(1) : phoneNumber;
  if (cleaned.length === 0) return "";
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

// Normalize for backend: +1XXXXXXXXXX
export function normalizePhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  return `+1${cleaned}`;
}

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };
  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      placeholder="(555) 123-4567"
      maxLength={14}
      inputMode="tel"
      autoComplete="tel"
    />
  );
}; 