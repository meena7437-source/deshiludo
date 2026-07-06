type Props = {
  text: string;
};

export default function PrimaryButton({ text }: Props) {
  return (
    <button className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-3 rounded-xl transition-all duration-300">
      {text}
    </button>
  );
}