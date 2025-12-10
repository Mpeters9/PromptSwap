'use client';

import { useEffect, useState } from 'react';

import { Button } from './ui/button';

type CopyButtonProps = {
  value: string;
  label: string;
  copiedLabel?: string;
  size?: 'sm' | 'default';
};

export default function CopyButton({
  value,
  label,
  copiedLabel = 'Copied',
  size = 'default',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy text', error);
    }
  };

  const sizeClass = size === 'sm' ? 'text-[11px]' : 'text-sm';

  return (
    <Button
      type="button"
      variant="secondary"
      size={size === 'sm' ? 'sm' : 'default'}
      onClick={handleCopy}
      className={sizeClass}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
