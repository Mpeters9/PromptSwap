import BuyButton from "@/components/BuyButton";

export default function HomePage() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-3xl font-bold">PromptSwap Test</h1>
      <BuyButton promptId="1" title="Sample Prompt" price={5} />
    </div>
  );
}
