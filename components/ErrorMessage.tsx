type ErrorMessageProps = {
  message: string;
  className?: string;
};

export default function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={`mb-4 rounded-md bg-red-100 px-4 py-2 text-center text-sm font-medium text-red-700 ${className}`}
    >
      {message}
    </div>
  );
}
