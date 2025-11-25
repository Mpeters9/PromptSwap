'use client';

type DownloadButtonProps = {
  text: string;
  filename: string;
  label?: string;
};

export default function DownloadButton({ text, filename, label = 'Download' }: DownloadButtonProps) {
  const handleClick = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
    >
      {label}
    </button>
  );
}
