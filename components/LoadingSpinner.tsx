export default function LoadingSpinner() {
  return (
    <div className="flex w-full justify-center py-10">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
    </div>
  );
}
